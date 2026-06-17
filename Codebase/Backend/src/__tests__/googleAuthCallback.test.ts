import { afterEach, describe, expect, it } from 'vitest';
import {
  AUTH_CALLBACK_CONTENT_SECURITY_POLICY,
  buildFrontendCallbackRedirectHtml,
  resolveFrontendCallbackOrigin,
} from '../routes/googleAuth';

const originalEnv = {
  PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL,
  SITE_URL: process.env.SITE_URL,
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
};

afterEach(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('resolveFrontendCallbackOrigin', () => {
  it('uses the configured public frontend origin before fallback values', () => {
    process.env.PUBLIC_BASE_URL = 'https://app.example.com/admin';
    process.env.SITE_URL = 'https://site.example.com';
    process.env.FRONTEND_ORIGIN = 'https://frontend.example.com';
    process.env.CORS_ORIGIN = 'https://cors.example.com';

    expect(resolveFrontendCallbackOrigin()).toBe('https://app.example.com');
  });

  it('falls back to the production frontend origin when env values are blank or unusable', () => {
    process.env.PUBLIC_BASE_URL = '';
    process.env.SITE_URL = 'not a url';
    process.env.FRONTEND_ORIGIN = '';
    process.env.CORS_ORIGIN = '*';

    expect(resolveFrontendCallbackOrigin()).toBe('https://neoterritory.vercel.app');
  });
});

describe('buildFrontendCallbackRedirectHtml', () => {
  it('preserves query params and the Supabase URL fragment in browser JavaScript', () => {
    const html = buildFrontendCallbackRedirectHtml('https://app.example.com');

    expect(html).toContain('"https://app.example.com"');
    expect(html).toContain("new URL('/auth/callback', frontendOrigin)");
    expect(html).toContain('target.search = window.location.search');
    expect(html).toContain('target.hash = window.location.hash');
  });
});

describe('AUTH_CALLBACK_CONTENT_SECURITY_POLICY', () => {
  it('allows the tiny inline browser handoff script while keeping the page isolated', () => {
    expect(AUTH_CALLBACK_CONTENT_SECURITY_POLICY).toContain("script-src 'unsafe-inline'");
    expect(AUTH_CALLBACK_CONTENT_SECURITY_POLICY).toContain("default-src 'none'");
    expect(AUTH_CALLBACK_CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'");
  });
});
