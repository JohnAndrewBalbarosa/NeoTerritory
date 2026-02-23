#!/bin/bash
# === FILE: test-multiple-users.sh ===

NUM_USERS=3

echo "🧪 Simulating $NUM_USERS users requesting C++ isolated sessions..."

for i in $(seq 1 $NUM_USERS); do
    # Gagawa tayo ng dynamic ID per loop iteration
    DYNAMIC_USER_ID="dev-student-$i"
    
    echo "▶️ Provisioning container for $DYNAMIC_USER_ID..."
    
    sed "s/{{user_id}}/$DYNAMIC_USER_ID/g" Infrastructure/session-orchestration/k8s/templates/user-session-pod.yaml | kubectl apply -f -
    sed "s/{{user_id}}/$DYNAMIC_USER_ID/g" Infrastructure/session-orchestration/k8s/templates/user-routing.yaml | kubectl apply -f -
done

echo ""
echo "✅ Done requesting! Titignan natin kung sabay-sabay silang nag-spin up:"
sleep 3 # Bigyan natin si Kubernetes ng 3 seconds para mag-process
kubectl get pods