variable "project_id" {
  description = "Your Google Cloud Project ID"
  type        = string
}

variable "region" {
  description = "The GCP region to deploy to"
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "The GCP zone to deploy to"
  type        = string
  default     = "us-central1-a"
}

variable "ssh_user" {
  description = "The local username on your computer (will be created on the VM)"
  type        = string
}

variable "ssh_pub_key_path" {
  description = "Path to your public SSH key on your local machine"
  type        = string
  default     = "~/.ssh/id_rsa.pub"
}

variable "machine_type" {
  description = "The GCP machine type"
  type        = string
  default     = "e2-standard-2" # 2 vCPUs, 8GB RAM recommended for VS Code Remote
}

variable "disk_size_gb" {
  description = "The size of the boot disk in GB"
  type        = number
  default     = 50
}

variable "repo_to_clone" {
  description = "Optional Git repository URL to clone on startup (e.g., git@github.com:username/repo.git)"
  type        = string
  default     = ""
}
