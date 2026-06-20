import { describe, it, expect } from 'vitest';
import { isThemedSurfacePath } from '../useTheme';

// Light/Dark mode is scoped to the Studio and the Project Manager (admin)
// dashboard ONLY. isThemedSurfacePath decides whether the stored theme is
// painted on a hard page load; it must return true for those surfaces and
// false for every public page so light styling never leaks onto the landing,
// auth, or other marketing pages.
describe('isThemedSurfacePath', () => {
  it('themes the studio surfaces', () => {
    expect(isThemedSurfacePath('/studio')).toBe(true);
    expect(isThemedSurfacePath('/studio/anything')).toBe(true);
    expect(isThemedSurfacePath('/app')).toBe(true);
    expect(isThemedSurfacePath('/student-studio')).toBe(true);
  });

  it('themes the project manager (admin) dashboard, including the /admin.html bundle', () => {
    expect(isThemedSurfacePath('/admin')).toBe(true);
    expect(isThemedSurfacePath('/admin.html')).toBe(true);
    expect(isThemedSurfacePath('/admin/login')).toBe(true);
  });

  it('never themes public pages', () => {
    for (const p of [
      '/',
      '/learn',
      '/about',
      '/patterns',
      '/patterns/learn',
      '/tour',
      '/docs',
      '/student-learning/login',
      '/pm/login',
      '/onboarding',
      '/intern-dashboard',
    ]) {
      expect(isThemedSurfacePath(p)).toBe(false);
    }
  });
});
