// Ambient types for Vite-style `?raw` imports (C++ samples imported as source strings by
// the shared Frontend/src code, e.g. learningContent.ts and PatternAtlas.tsx). Vite ships
// these declarations via `vite/client`; the Next app does not include vite types, so we
// declare them here. The webpack `asset/source` rule in next.config.js provides the runtime
// value (the file's text); this just gives TypeScript the matching string type. See D89.
declare module '*?raw' {
  const content: string;
  export default content;
}
