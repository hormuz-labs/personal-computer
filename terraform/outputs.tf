output "vm_public_ip" {
  value       = google_compute_instance.dev_vm.network_interface.0.access_config.0.nat_ip
  description = "The public IP address of your new dev machine"
}

output "ssh_connection_command" {
  value       = "ssh ${var.ssh_user}@${google_compute_instance.dev_vm.network_interface.0.access_config.0.nat_ip}"
  description = "Command to SSH into your new machine"
}

output "github_key_instructions" {
  value       = "Once connected, run: cat ~/.ssh/github_ed25519.pub and add the output to your GitHub account settings."
  description = "Instructions for adding the generated key to GitHub"
}
