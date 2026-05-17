// Central registry for the sidebar-driven /docs surface. One entry per
// leaf in the sidebar; each leaf owns its label, sidebar group, and the
// content component rendered when the leaf is the active selection.
//
// Adding a new section: append an entry here, give it a stable id, pick
// a group, and write the content component. The sidebar and the main
// pane both read this list — no separate routing table to keep in sync.

import { ReactElement } from 'react';
import {
  OverviewSection,
  SubmitSection,
  PatternsTabSection,
  TestsTabSection,
  DocsTabSection,
  SelfCheckSection,
} from './studioSections';
import {
  RunsSection,
  ComplexitySection,
  UsersSection,
  ReviewsSection,
  AISection,
  LogsSection,
  CatalogsSection,
  InvitesSection,
  JoinRequestsSection,
} from './adminSections';
import {
  MethodSection,
  TradeoffsSection,
  CatalogSchemaSection,
  TestingTrophySection,
  BibliographySection,
} from './technicalSections';

export type DocsGroupId = 'overview' | 'studio' | 'admin' | 'technical';

export interface DocsSectionEntry {
  id: string;
  label: string;
  group: DocsGroupId;
  render: () => ReactElement;
}

export const DOCS_GROUPS: ReadonlyArray<{ id: DocsGroupId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'studio', label: 'Studio' },
  { id: 'admin', label: 'Admin / PM' },
  { id: 'technical', label: 'Technical reference' },
];

export const DOCS_SECTIONS: ReadonlyArray<DocsSectionEntry> = [
  { id: 'overview', label: 'What CodiNeo does', group: 'overview', render: () => <OverviewSection /> },

  { id: 'studio-submit', label: 'Submit', group: 'studio', render: () => <SubmitSection /> },
  { id: 'studio-patterns', label: 'Patterns', group: 'studio', render: () => <PatternsTabSection /> },
  { id: 'studio-tests', label: 'Tests', group: 'studio', render: () => <TestsTabSection /> },
  { id: 'studio-docs', label: 'Docs', group: 'studio', render: () => <DocsTabSection /> },
  { id: 'studio-selfcheck', label: 'Self-check', group: 'studio', render: () => <SelfCheckSection /> },

  { id: 'admin-runs', label: 'Runs', group: 'admin', render: () => <RunsSection /> },
  { id: 'admin-complexity', label: 'Complexity', group: 'admin', render: () => <ComplexitySection /> },
  { id: 'admin-users', label: 'Users', group: 'admin', render: () => <UsersSection /> },
  { id: 'admin-reviews', label: 'Reviews', group: 'admin', render: () => <ReviewsSection /> },
  { id: 'admin-ai', label: 'AI', group: 'admin', render: () => <AISection /> },
  { id: 'admin-logs', label: 'Logs', group: 'admin', render: () => <LogsSection /> },
  { id: 'admin-catalogs', label: 'Catalogs', group: 'admin', render: () => <CatalogsSection /> },
  { id: 'admin-invites', label: 'Invites', group: 'admin', render: () => <InvitesSection /> },
  { id: 'admin-join-requests', label: 'Join requests', group: 'admin', render: () => <JoinRequestsSection /> },

  { id: 'tech-method', label: 'Method', group: 'technical', render: () => <MethodSection /> },
  { id: 'tech-tradeoffs', label: 'Trade-offs', group: 'technical', render: () => <TradeoffsSection /> },
  { id: 'tech-catalog-schema', label: 'Catalog schema', group: 'technical', render: () => <CatalogSchemaSection /> },
  { id: 'tech-trophy', label: 'Testing Trophy (why incomplete)', group: 'technical', render: () => <TestingTrophySection /> },
  { id: 'tech-bibliography', label: 'Bibliography', group: 'technical', render: () => <BibliographySection /> },
];

export const DEFAULT_SECTION_ID = 'overview';

export function findSection(id: string | null): DocsSectionEntry | null {
  if (!id) return null;
  return DOCS_SECTIONS.find((s) => s.id === id) ?? null;
}
