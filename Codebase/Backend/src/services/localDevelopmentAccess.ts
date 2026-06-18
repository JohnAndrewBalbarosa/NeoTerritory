export function isLocalTestInternEnabled(environment = process.env.NODE_ENV): boolean {
  return environment !== 'production';
}
