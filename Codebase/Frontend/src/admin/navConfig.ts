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
  | 'instructor-students' | 'instructor-modules' | 'instructor-questions' | 'courses'
  // SOP-1 PM record tabs. `intern-detail` + `assessment-cycle-detail` are hidden
  // (not in TABS): opened from their list via AdminApp state, no URL routing.
  | 'intern-records' | 'intern-detail' | 'assessments' | 'assessment-cycle-detail'
  // Learning Content management tabs (real content/question views, NOT analytics).
  | 'modules' | 'question-bank';

// Navigation reorganized around the SOP-1 project-based learning-support
// workflow. The first three groups are the normal PM flow; Secondary Tools holds
// the less-prominent technical/research utilities (collapsed by default). Section
// labels + the Students→Interns / Courses→Course Plan renames are DISPLAY changes
// only — tab ids equal the original route ids, so every existing page stays
// reachable and no route guard or permission is touched.
export type AdminSection = 'Dashboard' | 'Project Learning' | 'Learning Content' | 'Secondary Tools';

// Name of the de-emphasized, collapsible group holding the technical/research
// utilities (code analysis, logs, users, AI config, research pages).
export const SECONDARY_TOOLS_SECTION: AdminSection = 'Secondary Tools';

// UI-only visibility flag for the secondary tools group. NOT authorization — the
// existing route guards + role checks stay authoritative.
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
  // Dashboard
  { id: 'overview',        label: 'Overview',        icon: IconLayers,      section: 'Dashboard' },
  // Project Learning (normal PM workflow): course plan, intern records, formal
  // assessments, and the in-module learning-process analytics (process metrics
  // that support the learning workflow — distinct from formal results).
  { id: 'courses',              label: 'Course Plan', icon: IconBook,       section: 'Project Learning' },
  { id: 'intern-records',       label: 'Interns',    icon: IconShield,      section: 'Project Learning' },
  { id: 'assessments',          label: 'Assessments', icon: IconClipboard,  section: 'Project Learning' },
  { id: 'instructor-students', label: 'In-Module Analytics', icon: IconLayers, section: 'Project Learning' },
  // Learning Content: real content/question MANAGEMENT (not the analytics views).
  { id: 'modules',              label: 'Modules',    icon: IconLayers,      section: 'Learning Content' },
  { id: 'question-bank',        label: 'Question Bank', icon: IconClipboard, section: 'Learning Content' },
  // Secondary Tools (de-emphasized, collapsible): code analysis + research/admin.
  { id: 'runs',            label: 'Code Analysis',   icon: IconLayers,      section: 'Secondary Tools' },
  { id: 'logs',            label: 'Logs',            icon: IconClipboard,   section: 'Secondary Tools' },
  { id: 'reviews',         label: 'Reviews',         icon: IconCheckSquare, section: 'Secondary Tools', originalDevsOnly: true },
  { id: 'users',           label: 'Users',           icon: IconShield,      section: 'Secondary Tools' },
  { id: 'invites',         label: 'Invites',         icon: IconCheckSquare, section: 'Secondary Tools' },
  { id: 'joinRequests',    label: 'Join requests',   icon: IconShield,      section: 'Secondary Tools' },
  { id: 'ai',              label: 'AI configuration', icon: IconCode,       section: 'Secondary Tools' },
  { id: 'catalogs',        label: 'Pattern groups',  icon: IconBeaker,      section: 'Secondary Tools' },
  { id: 'complexity',      label: 'Complexity',      icon: IconBeaker,      section: 'Secondary Tools', originalDevsOnly: true },
  { id: 'featureReleases', label: 'Feature releases',icon: IconCode,        section: 'Secondary Tools', originalDevsOnly: true },
];

export const SECTION_ORDER: AdminSection[] = ['Dashboard', 'Project Learning', 'Learning Content', 'Secondary Tools'];

export const TAB_SECTION_MAP: Record<AdminTab, AdminSection> = TABS.reduce((acc, tab) => {
  acc[tab.id] = tab.section;
  return acc;
}, {} as Record<AdminTab, AdminSection>);

export const SECTION_CHILDREN: Record<AdminSection, AdminTab[]> = SECTION_ORDER.reduce((acc, section) => {
  acc[section] = TABS.filter((tab) => tab.section === section).map((tab) => tab.id);
  return acc;
}, {} as Record<AdminSection, AdminTab[]>);
