import { describe, it, expect } from 'vitest';
import { TABS, SECTION_ORDER, SECTION_CHILDREN, SHOW_RESEARCH_ADMIN_TOOLS } from '../navConfig';

// These tests pin the PM dashboard navigation reorganization: the workflow
// section grouping, the Students→Interns rename, and — critically — that every
// pre-existing route/tab id is still present (no page was removed) and that the
// research/admin visibility flag is a plain UI constant, not authorization.

const ORIGINAL_TAB_IDS = [
  'runs', 'complexity', 'users', 'reviews', 'ai', 'logs', 'catalogs', 'invites',
  'joinRequests', 'featureReleases', 'instructor-students', 'instructor-modules',
  'instructor-questions', 'courses',
];

describe('PM dashboard navConfig', () => {
  it('preserves every original route/tab id (no dashboard page removed)', () => {
    const ids = new Set(TABS.map((t) => t.id));
    for (const id of ORIGINAL_TAB_IDS) expect(ids.has(id as never)).toBe(true);
  });

  it('adds an Overview tab as the Dashboard section', () => {
    const overview = TABS.find((t) => t.id === 'overview');
    expect(overview).toBeTruthy();
    expect(overview?.section).toBe('Dashboard');
  });

  it('renames the Students tab label to "Interns" (route id unchanged)', () => {
    const interns = TABS.find((t) => t.id === 'instructor-students');
    expect(interns?.label).toBe('Interns');
    expect(interns?.section).toBe('Learner Monitoring');
    expect(TABS.some((t) => t.label === 'Students')).toBe(false);
  });

  it('organizes navigation around the learning workflow sections', () => {
    expect(SECTION_ORDER).toEqual([
      'Dashboard', 'Learner Monitoring', 'Learning Content', 'Code Analysis', 'Research & Admin Tools',
    ]);
  });

  it('places content + analysis tabs in their workflow sections', () => {
    expect(SECTION_CHILDREN['Learning Content']).toEqual(
      expect.arrayContaining(['instructor-modules', 'instructor-questions', 'courses']),
    );
    expect(SECTION_CHILDREN['Code Analysis']).toContain('runs');
  });

  it('centralizes research/admin utilities under one section', () => {
    const research = SECTION_CHILDREN['Research & Admin Tools'];
    for (const id of ['logs', 'reviews', 'users', 'invites', 'joinRequests', 'ai', 'catalogs', 'complexity', 'featureReleases']) {
      expect(research).toContain(id);
    }
  });

  it('exposes a plain UI visibility flag (not an authorization mechanism)', () => {
    // It is a boolean constant only; it gates display, never access. Route guards
    // and role checks remain the authoritative access control.
    expect(typeof SHOW_RESEARCH_ADMIN_TOOLS).toBe('boolean');
  });

  it('keeps the original-devs-only visibility flags unchanged for thesis-cohort tabs', () => {
    const odOnly = TABS.filter((t) => t.originalDevsOnly).map((t) => t.id).sort();
    expect(odOnly).toEqual(['complexity', 'featureReleases', 'reviews']);
  });
});
