import { describe, it, expect } from 'vitest';
import { TABS, SECTION_ORDER, SECTION_CHILDREN, SHOW_RESEARCH_ADMIN_TOOLS, SECONDARY_TOOLS_SECTION } from '../navConfig';

// These tests pin the SOP-1 PM navigation: the four workflow groups
// (Dashboard / Project Learning / Learning Content / Secondary Tools), the
// Students→Interns and Courses→Course Plan renames, and — critically — that
// every pre-existing route/tab id is still present (no page removed) and that
// the secondary-tools visibility flag is a plain UI constant, not authorization.

const ORIGINAL_TAB_IDS = [
  'runs', 'complexity', 'users', 'reviews', 'ai', 'logs', 'catalogs', 'invites',
  'joinRequests', 'featureReleases', 'instructor-students', 'instructor-modules',
  'instructor-questions', 'courses',
];

describe('PM dashboard navConfig (SOP-1)', () => {
  it('preserves every original route/tab id (no dashboard page removed)', () => {
    const ids = new Set(TABS.map((t) => t.id));
    for (const id of ORIGINAL_TAB_IDS) expect(ids.has(id as never)).toBe(true);
  });

  it('adds an Overview tab in the Dashboard group', () => {
    const overview = TABS.find((t) => t.id === 'overview');
    expect(overview).toBeTruthy();
    expect(overview?.section).toBe('Dashboard');
  });

  it('groups the normal PM workflow into Project Learning + Learning Content', () => {
    // "Interns" now points to the real records tab (intern-records), not the
    // instructor analytics cluster.
    const interns = TABS.find((t) => t.id === 'intern-records');
    expect(interns?.label).toBe('Interns');
    expect(interns?.section).toBe('Project Learning');
    expect(TABS.some((t) => t.label === 'Students')).toBe(false);

    const coursePlan = TABS.find((t) => t.id === 'courses');
    expect(coursePlan?.label).toBe('Course Plan');
    expect(coursePlan?.section).toBe('Project Learning');

    // The existing instructor-analytics cluster is relocated to Secondary Tools
    // as "In-Module Analytics" (process metrics, not formal results).
    const analytics = TABS.find((t) => t.id === 'instructor-students');
    expect(analytics?.label).toBe('In-Module Analytics');
    expect(analytics?.section).toBe('Secondary Tools');

    expect(SECTION_CHILDREN['Learning Content']).toEqual(
      expect.arrayContaining(['instructor-modules', 'instructor-questions']),
    );
  });

  it('keeps intern-detail out of the sidebar (opened via state, not URL)', () => {
    expect(TABS.some((t) => t.id === 'intern-detail')).toBe(false);
  });

  it('orders the four SOP-1 groups with Secondary Tools last', () => {
    expect(SECTION_ORDER).toEqual([
      'Dashboard', 'Project Learning', 'Learning Content', 'Secondary Tools',
    ]);
    expect(SECTION_ORDER[SECTION_ORDER.length - 1]).toBe(SECONDARY_TOOLS_SECTION);
  });

  it('places code-analysis + research/admin utilities under Secondary Tools', () => {
    const secondary = SECTION_CHILDREN['Secondary Tools'];
    for (const id of ['runs', 'logs', 'reviews', 'users', 'invites', 'joinRequests', 'ai', 'catalogs', 'complexity', 'featureReleases']) {
      expect(secondary).toContain(id);
    }
  });

  it('exposes a plain UI visibility flag (not an authorization mechanism)', () => {
    expect(typeof SHOW_RESEARCH_ADMIN_TOOLS).toBe('boolean');
  });

  it('keeps the original-devs-only visibility flags unchanged for thesis-cohort tabs', () => {
    const odOnly = TABS.filter((t) => t.originalDevsOnly).map((t) => t.id).sort();
    expect(odOnly).toEqual(['complexity', 'featureReleases', 'reviews']);
  });
});
