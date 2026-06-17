# Personal Remote Development Environment

This repository contains Terraform configuration to instantly spin up a powerful, pre-configured development Virtual Machine (VM) on Google Cloud Platform (GCP). 

It automatically provisions a fully working development environment that includes Zsh, Oh My Zsh, Docker, Node.js (via NVM), Bun, and OpenCode, then automatically clones your chosen repository so you can get to work immediately.

## Why We Use This

**The main use case is remote development while traveling.**

When traveling, working from a coffee shop, or using a lightweight laptop, local development can be frustrating:
*   **Battery Drain:** Running Docker, compilers, and heavy IDEs locally drains laptop batteries incredibly fast.
*   **Hardware Constraints:** A travel laptop might not have the CPU or RAM to handle large codebases or heavy local services.
*   **Security:** Keeping sensitive source code and data on a cloud VM minimizes risk if your travel laptop is lost or stolen.
*   **Bandwidth Limitations:** Running `npm install`, `docker pull`, or downloading large datasets on hotel WiFi can take forever. The VM sits on Google's backbone network with gigabit speeds.

By using this setup, you can connect to the remote VM via SSH or **VS Code Remote - SSH**. Your local machine simply acts as a thin client (just rendering text and UI), while all the heavy lifting (compiling, running services, downloading dependencies) happens on the cloud VM.

## Features

*   **Automated Provisioning:** Creates a GCP Ubuntu 22.04 LTS VM with a fast SSD.
*   **Secure SSH Access:** Automatically injects your local SSH key for passwordless entry via firewall rules.
*   **Developer Tooling Ready-to-Go:**
    *   **Zsh & Oh My Zsh:** Set as default shell with pre-configured plugins (`git`, `docker`, `docker-compose`, `node`, `npm`, `nvm`, `bun`).
    *   **Docker & Docker Compose:** Pre-installed, and your user is added to the `docker` group for passwordless access.
    *   **JavaScript Ecosystem:** Automatically installs Node.js (via NVM) and Bun.
    *   **AI Pair Programmer:** Installs `opencode` CLI tools automatically.
*   **GitHub Ready:** A startup script automatically generates a dedicated `ed25519` SSH key on the VM for GitHub access and configures `~/.ssh/config`.
*   **Automatic Repo Cloning:** If you configure a repository URL, it will be automatically cloned into `~/workspace` upon startup.
*   **Cost-Efficient:** You can easily stop the VM from the GCP console when you're not working to save costs (paying only for the disk), and start it back up when you need it.

## Prerequisites

1.  **Google Cloud Platform Account:** You need an active GCP account and a Project created.
2.  **Google Cloud CLI (`gcloud`):** Installed and authenticated locally (`gcloud auth application-default login`).
3.  **Terraform:** Installed on your local machine.
4.  **SSH Key:** An existing SSH key on your local machine (e.g., `~/.ssh/id_rsa.pub` or `~/.ssh/id_ed25519.pub`).

## Usage

### 1. Setup Configuration

Navigate to the `terraform/` directory:

```bash
cd terraform
```

Copy the example variables file:

```bash
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` and fill in your details:
*   `project_id`: Your Google Cloud Project ID.
*   `ssh_user`: Your local username (this is what you will use to log in).
*   `ssh_pub_key_path`: The path to your local public SSH key.
*   `repo_to_clone`: (Optional) The Git repository URL you want to immediately start working on (e.g., `git@github.com:username/repo.git`).

### 2. Deploy the VM

Initialize Terraform (downloads the required GCP provider):

```bash
terraform init
```

Preview the resources that will be created:

```bash
terraform plan
```

Apply the configuration to create the VM:

```bash
terraform apply
```

Type `yes` when prompted. 

### 3. Connect

Once Terraform finishes, it will output the public IP address of your new VM. 

**Using SSH:**
```bash
ssh <your_ssh_user>@<vm_public_ip>
```

**Using VS Code:**
1. Install the **Remote - SSH** extension in VS Code.
2. Click the remote indicator in the bottom-left corner and select **Connect to Host...**.
3. Enter `ssh <your_ssh_user>@<vm_public_ip>`.
4. Open the `/home/<your_ssh_user>/workspace` folder and start coding!

### 4. Setting up GitHub (One-Time)

When you first log in, a brand new SSH key will have been generated for you automatically at `~/.ssh/github_ed25519.pub`.

Run this command on the VM to view the key:
```bash
cat ~/.ssh/github_ed25519.pub
```
Add this key to your GitHub account (Settings > SSH and GPG keys > New SSH key). Since the startup script already added `github.com` to your `known_hosts`, your VM will be completely ready to push and pull code!

### 5. Tear Down

When your trip is over and you no longer need the environment, you can destroy all resources to completely stop incurring charges:

```bash
cd terraform
terraform destroy
```