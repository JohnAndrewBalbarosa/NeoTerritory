// Backwards-compat shim. The real schemas live in
// `Codebase/Backend/src/payloadValidator/` (organised per-domain). New
// code should import from `../payloadValidator` directly; this file
// stays around so older route files keep compiling without an
// import-path sweep.
export * from '../payloadValidator';
