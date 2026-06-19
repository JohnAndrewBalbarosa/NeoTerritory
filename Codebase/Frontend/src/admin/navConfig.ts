// Project Manager dashboard navigation configuration. Extracted from AdminApp
// so the nav structure is unit-testable. These are DISPLAY/labelling values
// only — tab ids equal the original route ids (no page is removed or renamed at
// the route level), and nothing here performs authorization. Existing route
// guards + role checks remain the sole source of truth for access.

import type { ComponentType } from 'react';
import {
  IconLayers, IconBeaker, IconShield, IconCheckSquare, IconClipboard, IconCode, IconBook,
} from '../components/icons/Icons';
import type { IconProps } from '../components/icons/Icons';

export type AdminTab =
  | 'overview' | 'runs' | 'complexity' | 'users' | 'reviews' | 'ai' | 'logs' | 'catalogs'
  | 'invites' | 'joinRequests' | 'featureReleases'
  | 'instructor-students' | 'instructor-modules' | 'instructor-questions' | 'courses';

// Navigation reorganized around the project-based learning workflow. Section
// labels and the Students→Interns rename are DISPLAY changes only — route/tab
// ids are unchanged so every existing page stays reachable.
export type AdminSection = 'Dashboard' | 'Learner Monitoring' | 'Learning Content' | 'Code Analysis' | 'Research & Admin Tools';

// UI-only visibility flag for the secondary research/admin utilities. NOT
// authorization — the existing route guards + role checks stay authoritative.
export const SHOW_RESEARCH_ADMIN_TOOLS = true;

export interface TabDef {
  id: AdminTab;
  label: string;
  icon: ComponentType<IconProps>;
  section: AdminSection;
  // When true, the tab is only shown for the original-devs org (thesis team).
  // This is the pre-existing UI-visibility behavior, unchanged by this refactor.
  originalDevsOnly?: boolean;
}

export const TABS: ReadonlyArray<TabDef> = [
  { id: 'overview',        label: 'Overview',        icon: IconLayers,      section: 'Dashboard' },
  { id: 'instructor-students',  label: 'Interns',    icon: IconShield,      section: 'Learner Monitoring' },
  { id: 'instructor-modules',   label: 'Modules',    icon: IconLayers,      section: 'Learning Content' },
  { id: 'instructor-questions', label: 'Questions',  icon: IconClipboard,   section: 'Learning Content' },
  { id: 'courses',              label: 'Courses',    icon: IconBook,        section: 'Learning Content' },
  { id: 'runs',            label: 'Analysis Runs',   icon: IconLayers,      section: 'Code Analysis' },
  { id: 'logs',            label: 'Logs',            icon: IconClipboard,   section: 'Research & Admin Tools' },
  { id: 'reviews',         label: 'Reviews',         icon: IconCheckSquare, section: 'Research & Admin Tools', originalDevsOnly: true },
  { id: 'users',           label: 'Users',           icon: IconShield,      section: 'Research & Admin Tools' },
  { id: 'invites',         label: 'Invites',         icon: IconCheckSquare, section: 'Research & Admin Tools' },
  { id: 'joinRequests',    label: 'Join requests',   icon: IconShield,      section: 'Research & Admin Tools' },
  { id: 'ai',              label: 'AI configuration', icon: IconCode,       section: 'Research & Admin Tools' },
  { id: 'catalogs',        label: 'Pattern groups',  icon: IconBeaker,      section: 'Research & Admin Tools' },
  { id: 'complexity',      label: 'Complexity',      icon: IconBeaker,      section: 'Research & Admin Tools', originalDevsOnly: true },
  { id: 'featureReleases', label: 'Feature releases',icon: IconCode,        section: 'Research & Admin Tools', originalDevsOnly: true },
];

export const SECTION_ORDER: AdminSection[] = ['Dashboard', 'Learner Monitoring', 'Learning Content', 'Code Analysis', 'Research & Admin Tools'];

export const TAB_SECTION_MAP: Record<AdminTab, AdminSection> = TABS.reduce((acc, tab) => {
  acc[tab.id] = tab.section;
  return acc;
}, {} as Record<AdminTab, AdminSection>);

export const SECTION_CHILDREN: Record<AdminSection, AdminTab[]> = SECTION_ORDER.reduce((acc, section) => {
  acc[section] = TABS.filter((tab) => tab.section === section).map((tab) => tab.id);
  return acc;
}, {} as Record<AdminSection, AdminTab[]>);
