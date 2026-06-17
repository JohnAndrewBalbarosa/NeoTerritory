const path = require('path');

// AWS backend origin (public IP, port 80 — see D88/D89). Override via Vercel env.
const AWS_BACKEND_ORIGIN = process.env.AWS_BACKEND_ORIGIN || 'http://122.248.192.49';

// Single source of UI: import the existing Vite app's src verbatim (D89).
const FRONTEND_SRC = path.resolve(__dirname, '../Frontend/src');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Allow importing/compiling TS/TSX from outside this app's root (../Frontend/src).
  experimental: {
    externalDir: true,
  },

  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = config.resolve.alias || {};
    // Shared component/CSS/store/api source.
    config.resolve.alias['@frontend'] = FRONTEND_SRC;
    // This app's own root (route files import `@/components/...`).
    config.resolve.alias['@'] = __dirname;

    // Support Vite-style `?raw` imports (e.g. learningContent.ts and PatternAtlas
    // import C++ samples as source strings: `import src from '....cpp?raw'`). Vite
    // resolves `?raw` natively; webpack needs an explicit asset/source rule so the
    // default export is the file's text. Mirrors Vite behaviour exactly.
    config.module = config.module || { rules: [] };
    config.module.rules = config.module.rules || [];
    config.module.rules.push({
      resourceQuery: /raw/,
      type: 'asset/source',
    });
    // Dedupe React to a SINGLE app-level copy so cross-tree imports from
    // ../Frontend/src don't pull a second react/react-dom from
    // ../Frontend/node_modules ("invalid hook call"). We must NOT alias the bare
    // `react`/`react-dom` specifiers — Next 14 App Router's server runtime relies on
    // its own vendored React canary (which provides React.cache); a blunt alias to
    // stable react@18.3 breaks prerender with "r.cache is not a function". Forcing
    // only the resolve ROOTS keeps Next's framework React intact while making the
    // shared client components resolve this app's single copy.
    config.resolve.modules = [
      path.resolve(__dirname, 'node_modules'),
      ...(config.resolve.modules || ['node_modules']),
    ];
    return config;
  },

  // Server-side proxy to AWS. An HTTPS Vercel page cannot fetch the plain-HTTP AWS box
  // (mixed content), so these are fetched server-side; the browser only sees HTTPS. This
  // also removes any CORS requirement and keeps client.ts relative paths unchanged.
  // afterFiles lets real App Router pages, especially /auth/callback, win before the
  // broad /auth proxy. The callback must run in the browser to keep the Supabase URL
  // fragment intact.
  async rewrites() {
    return {
      afterFiles: [
        { source: '/api/:path*', destination: `${AWS_BACKEND_ORIGIN}/api/:path*` },
        { source: '/auth/:path*', destination: `${AWS_BACKEND_ORIGIN}/auth/:path*` },
        { source: '/health', destination: `${AWS_BACKEND_ORIGIN}/health` },
      ],
    };
  },
};

module.exports = nextConfig;
