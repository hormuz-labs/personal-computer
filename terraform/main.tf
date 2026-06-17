terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

# Firewall rule to allow SSH access
resource "google_compute_firewall" "allow_ssh" {
  name    = "allow-ssh-dev-vm"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  # For better security, replace 0.0.0.0/0 with your actual IP address e.g., ["203.0.113.50/32"]
  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["dev-machine"]
}

# The Virtual Machine
resource "google_compute_instance" "dev_vm" {
  name         = "personal-dev-vm"
  machine_type = var.machine_type
  zone         = var.zone

  tags = ["dev-machine"]

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2204-lts"
      size  = var.disk_size_gb
      type  = "pd-ssd"
    }
  }

  network_interface {
    network = "default"
    access_config {
      # Leaving this empty assigns an ephemeral public IP
    }
  }

  # Injects your local SSH key into the VM so you can log in without a password
  metadata = {
    ssh-keys = "${var.ssh_user}:${file(var.ssh_pub_key_path)}"
  }

  # Startup script to automatically install tools and configure the environment
  metadata_startup_script = <<-EOT
    #!/bin/bash
    USER_HOME="/home/${var.ssh_user}"
    SSH_DIR="$USER_HOME/.ssh"

    # Update system and install dependencies
    apt-get update
    apt-get install -y git curl wget zsh build-essential

    # Install Docker & Docker Compose
    if ! command -v docker &> /dev/null; then
      curl -fsSL https://get.docker.com -o get-docker.sh
      sh get-docker.sh
    fi

    # Wait for the user home directory to be created by the OS login/metadata scripts
    sleep 10 

    if [ -d "$USER_HOME" ]; then
      # Change default shell to zsh
      chsh -s $(which zsh) ${var.ssh_user}

      # Add user to docker group
      usermod -aG docker ${var.ssh_user}

      # Create .ssh directory if it doesn't exist
      sudo -u ${var.ssh_user} mkdir -p "$SSH_DIR"
      sudo -u ${var.ssh_user} chmod 700 "$SSH_DIR"

      # Generate an ed25519 SSH key for GitHub if it doesn't already exist
      if [ ! -f "$SSH_DIR/github_ed25519" ]; then
        sudo -u ${var.ssh_user} ssh-keygen -t ed25519 -C "gcp-dev-vm" -f "$SSH_DIR/github_ed25519" -N ""
        
        # Configure SSH to use this key specifically for GitHub
        sudo -u ${var.ssh_user} touch "$SSH_DIR/config"
        sudo -u ${var.ssh_user} bash -c "cat >> $SSH_DIR/config <<SSH_CONFIG_EOF
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/github_ed25519
  StrictHostKeyChecking no
SSH_CONFIG_EOF"
        
        sudo -u ${var.ssh_user} chmod 600 "$SSH_DIR/config"
      fi

      # Install developer tools (Oh My Zsh, NVM, Node, Bun, OpenCode)
      sudo -u ${var.ssh_user} bash -c '
        export HOME="/home/${var.ssh_user}"
        
        # Oh My Zsh
        if [ ! -d "$HOME/.oh-my-zsh" ]; then
          sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended
          # Configure plugins
          sed -i "s/plugins=(git)/plugins=(git docker docker-compose node npm nvm bun)/g" "$HOME/.zshrc"
        fi
        
        # NVM & Node LTS
        if [ ! -d "$HOME/.nvm" ]; then
          curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
          export NVM_DIR="$HOME/.nvm"
          [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
          nvm install --lts
        fi
        
        # Bun
        if [ ! -d "$HOME/.bun" ]; then
          curl -fsSL https://bun.sh/install | bash
        fi
        
        # OpenCode
        if ! command -v opencode &> /dev/null; then
          curl -fsSL https://opencode.ai/install | bash
        fi
      '

      # Clone the repository if provided
      if [ -n "${var.repo_to_clone}" ]; then
        sudo -u ${var.ssh_user} bash -c '
          export HOME="/home/${var.ssh_user}"
          mkdir -p "$HOME/workspace"
          
          # Add GitHub to known hosts
          ssh-keyscan -t ed25519 github.com >> "$HOME/.ssh/known_hosts" 2>/dev/null
          
          if [ ! -d "$HOME/workspace/$(basename ${var.repo_to_clone} .git)" ]; then
            cd "$HOME/workspace" && git clone ${var.repo_to_clone}
          fi
        '
      fi
    fi
  EOT

  # Allow the VM to be stopped without destroying it (e.g. changing machine type later)
  allow_stopping_for_update = true
}
