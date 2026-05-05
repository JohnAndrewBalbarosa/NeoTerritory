#!/usr/bin/env bash
# Pre-deploy checks: SSH reachable, Lightsail firewall, remote Node.js.

verify_ssh_link() {
  echo "-- Verifying SSH connection to $SSH_TARGET --"
  if ! ssh $SSH_OPTS "$SSH_TARGET" "echo 'Link OK'" >/dev/null 2>&1; then
    echo "ERROR: Cannot reach $SSH_TARGET. Check your IP/Key/Firewall." >&2
    return 1
  fi
  echo "Link established."
}

open_lightsail_ports() {
  [ -z "${AWS_LIGHTSAIL_INSTANCE_NAME:-}" ] && return 0
  if ! command -v aws >/dev/null 2>&1; then
    echo "i AWS CLI not found, skipping firewall auto-open."
    return 0
  fi
  local region="${AWS_LIGHTSAIL_REGION:-ap-southeast-1}"
  echo "-- Opening Lightsail ports 80, 443 on '$AWS_LIGHTSAIL_INSTANCE_NAME' --"
  if aws lightsail put-instance-public-ports \
       --region "$region" \
       --instance-name "$AWS_LIGHTSAIL_INSTANCE_NAME" \
       --port-infos "fromPort=22,toPort=22,protocol=tcp" \
                    "fromPort=80,toPort=80,protocol=tcp" \
                    "fromPort=443,toPort=443,protocol=tcp" \
       >/dev/null 2>&1; then
    echo "Firewall updated."
  else
    echo "Firewall update failed (check credentials)."
  fi
}

ensure_remote_node() {
  echo "-- Verifying remote Node.js environment --"
  if ssh $SSH_OPTS "$SSH_TARGET" "bash -l -c 'command -v node && command -v npm'" >/dev/null 2>&1; then
    echo "Remote Node.js environment OK."
    return 0
  fi
  echo "Remote server is missing Node.js or npm." >&2
  if ask_yes "Would you like to run provisioning (lightsail-launch.sh) now? [y/N]"; then
    echo "-> Provisioning $SSH_TARGET..."
    scp $SSH_OPTS "$ROOT_DIR/scripts/lightsail-launch.sh" "$SSH_TARGET:/tmp/lightsail-launch.sh"
    ssh $SSH_OPTS "$SSH_TARGET" "sudo bash /tmp/lightsail-launch.sh"
    echo "Provisioning complete."
  else
    echo "Cannot proceed without Node.js." >&2
    return 1
  fi
}
