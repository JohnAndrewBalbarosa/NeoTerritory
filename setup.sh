#!/bin/bash
# === FILE: deploy-neoterritory.sh ===

# Para huminto agad ang script kung may mag-error na command
set -e 

echo "🚀 Starting Minikube Cluster..."
minikube start --driver=docker

echo "🔗 Connecting to Minikube's Internal Docker Daemon..."
eval $(minikube docker-env)

echo "🛠️ Building Neoterritory C++ Image (with network=host fix)..."
# Nandito yung --network=host na nag-solve ng internet issue natin
docker build --network=host -t neoterritory:latest -f Infrastructure/session-orchestration/docker/Dockerfile .

echo "📦 Deploying 1-Hour Session Pod to Kubernetes..."
# I-de-deploy niya lahat ng YAML files sa loob ng k8s folder
kubectl apply -f Infrastructure/session-orchestration/k8s/templates/

echo "✅ Deployment Triggered! Checking Pod status..."
kubectl get pods

echo ""
echo "🎉 Done! Para ma-access ang microservice, i-run ang command na ito sa terminal:"
echo "kubectl port-forward pod/neoterritory-session-user123 8080:8080"