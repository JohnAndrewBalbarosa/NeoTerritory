const LOCAL_DEV_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export function isLocalRuntimeHost(): boolean {
  if (typeof window === 'undefined') return false;
  return LOCAL_DEV_HOSTS.has(window.location.hostname);
}

export function isLocalDevRuntime(): boolean {
  return isLocalRuntimeHost();
}
