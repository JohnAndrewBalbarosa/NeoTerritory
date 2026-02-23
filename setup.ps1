# === FILE: setup-k8s.ps1 ===
Write-Host "Sinisimulan ang pag-setup ng Kubernetes at Minikube sa loob ng WSL2..." -ForegroundColor Cyan

# 1. I-download ang Minikube sa loob ng WSL
Write-Host "Dinadownload ang Minikube..."
wsl bash -c "curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64"

# 2. I-install ang Minikube (gamit ang root user para walang password prompt)
Write-Host "Ini-install ang Minikube..."
wsl -u root bash -c "install minikube-linux-amd64 /usr/local/bin/minikube"
wsl bash -c "rm minikube-linux-amd64" # Cleanup

# 3. I-download ang Kubectl sa loob ng WSL
Write-Host "Dinadownload ang Kubectl..."
wsl bash -c "curl -LO 'https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl'"

# 4. I-install ang Kubectl
Write-Host "Ini-install ang Kubectl..."
wsl -u root bash -c "install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl"
wsl bash -c "rm kubectl" # Cleanup

Write-Host "Success! Naka-install na ang Minikube at Kubectl sa WSL mo." -ForegroundColor Green