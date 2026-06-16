import db from '../db/database';

export interface LearningModuleSectionJson {
  heading: string;
  body?: string;
  bullets?: string[];
  code?: string;
  note?: string;
}

export type BloomTaxonomy =
  | 'remembering'
  | 'understanding'
  | 'applying'
  | 'analyzing'
  | 'evaluating'
  | 'creating';

export interface LearningModuleBaseQuestionJson {
  taxonomy?: BloomTaxonomy;
  explanation?: string;
}

export interface LearningModuleMcqQuestionJson extends LearningModuleBaseQuestionJson {
  type: 'mcq';
  question: string;
  options: string[];
  correctIndex: number;
  code?: string;
}

export interface LearningModuleIdentificationQuestionJson extends LearningModuleBaseQuestionJson {
  type: 'identification';
  question: string;
  scenario: string;
  expectedTokens: string[];
}

export interface LearningModuleStudioQuestionJson extends LearningModuleBaseQuestionJson {
  type: 'studio';
  prompt: string;
  targetPatternSlug: string;
  starterCode?: string;
}

export type LearningModuleQuestionJson =
  | LearningModuleMcqQuestionJson
  | LearningModuleIdentificationQuestionJson
  | LearningModuleStudioQuestionJson;

export interface LearningModuleCatalogJson {
  moduleId: string;
  category: string;
  title: string;
  eyebrow: string;
  intro: string;
  sections: LearningModuleSectionJson[];
  keyTerms: Array<{ term: string; definition: string }>;
  summary: string | null;
  seeAlso: Array<{ moduleId: string; label: string }>;
  theoreticalExam: {
    kind: 'theoretical';
    questions: LearningModuleQuestionJson[];
  } | null;
  practicalExam: Record<string, unknown> | null;
  autoTag: boolean;
}

interface LearningModuleRow {
  module_id: string;
  category: string;
  title: string;
  eyebrow: string;
  intro: string;
  sections_json: string;
  key_terms_json: string;
  summary: string | null;
  see_also_json: string;
  theoretical_json: string | null;
  practical_json: string | null;
  auto_tag: number;
}

function parseJsonArray(raw: string | null | undefined): unknown[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonObject(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function toQuestionJson(raw: unknown): LearningModuleQuestionJson | null {
  if (!raw || typeof raw !== 'object') return null;
  const q = raw as Record<string, unknown>;
  const taxonomy = typeof q.taxonomy === 'string' ? q.taxonomy as BloomTaxonomy : undefined;
  const explanation = typeof q.explanation === 'string' ? q.explanation : undefined;

  if (q.type === 'identification') {
    const question = typeof q.question === 'string' ? q.question : '';
    const scenario = typeof q.scenario === 'string' ? q.scenario : '';
    const expectedTokens = Array.isArray(q.expectedTokens)
      ? q.expectedTokens.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      : [];
    if (!question || !scenario || expectedTokens.length === 0) return null;
    return { type: 'identification', question, scenario, expectedTokens, taxonomy, explanation };
  }

  if (q.type === 'studio') {
    const prompt = typeof q.prompt === 'string' ? q.prompt : '';
    const targetPatternSlug = typeof q.targetPatternSlug === 'string' ? q.targetPatternSlug : '';
    if (!prompt || !targetPatternSlug) return null;
    return {
      type: 'studio',
      prompt,
      targetPatternSlug,
      starterCode: typeof q.starterCode === 'string' ? q.starterCode : undefined,
      taxonomy,
      explanation,
    };
  }

  const question = typeof q.question === 'string' ? q.question : '';
  const options = Array.isArray(q.options) ? q.options.filter((v): v is string => typeof v === 'string') : [];
  const correctIndex = typeof q.correctIndex === 'number' ? q.correctIndex : -1;
  if (!question || options.length < 2 || correctIndex < 0 || correctIndex >= options.length) return null;
  return {
    type: 'mcq',
    question,
    options,
    correctIndex,
    explanation,
    code: typeof q.code === 'string' ? q.code : undefined,
    taxonomy,
  };
}

function questionPromptText(question: LearningModuleQuestionJson): string {
  if (question.type === 'studio') return question.prompt;
  if (question.type === 'identification') return `${question.question} ${question.scenario}`;
  return question.question;
}

function toCatalogEntry(row: LearningModuleRow): LearningModuleCatalogJson {
  const theoretical = parseJsonObject(row.theoretical_json);
  const questions = theoretical?.kind === 'theoretical' && Array.isArray(theoretical.questions)
    ? theoretical.questions.map(toQuestionJson).filter((v): v is LearningModuleQuestionJson => Boolean(v))
    : [];
  return {
    moduleId: row.module_id,
    category: row.category,
    title: row.title,
    eyebrow: row.eyebrow,
    intro: row.intro,
    sections: parseJsonArray(row.sections_json).filter((item): item is LearningModuleSectionJson => {
      return !!item && typeof item === 'object' && typeof (item as Record<string, unknown>).heading === 'string';
    }).map((item) => {
      const s = item as unknown as Record<string, unknown>;
      return {
        heading: String(s.heading),
        body: typeof s.body === 'string' ? s.body : undefined,
        bullets: Array.isArray(s.bullets) ? s.bullets.filter((v): v is string => typeof v === 'string') : undefined,
        code: typeof s.code === 'string' ? s.code : undefined,
        note: typeof s.note === 'string' ? s.note : undefined,
      };
    }),
    keyTerms: parseJsonArray(row.key_terms_json).filter((item): item is { term: string; definition: string } => {
      return !!item && typeof item === 'object' && typeof (item as Record<string, unknown>).term === 'string';
    }).map((item) => {
      const t = item as Record<string, unknown>;
      return {
        term: String(t.term),
        definition: typeof t.definition === 'string' ? t.definition : '',
      };
    }),
    summary: row.summary,
    seeAlso: parseJsonArray(row.see_also_json).filter((item): item is { moduleId: string; label: string } => {
      return !!item && typeof item === 'object' && typeof (item as Record<string, unknown>).moduleId === 'string';
    }).map((item) => {
      const s = item as Record<string, unknown>;
      return {
        moduleId: String(s.moduleId),
        label: typeof s.label === 'string' ? s.label : '',
      };
    }),
    theoreticalExam: questions.length > 0 ? { kind: 'theoretical', questions } : null,
    practicalExam: parseJsonObject(row.practical_json),
    autoTag: row.auto_tag !== 0,
  };
}

interface LearningModuleCatalogOptions {
  includeUnpublished?: boolean;
}

export function listLearningModuleCatalog(options: LearningModuleCatalogOptions = {}): LearningModuleCatalogJson[] {
  const where = options.includeUnpublished ? '' : 'WHERE published = 1';
  const rows = db.prepare(`
    SELECT module_id, category, title, eyebrow, intro, sections_json, key_terms_json, summary,
           see_also_json, theoretical_json, practical_json, auto_tag
    FROM learning_modules
    ${where}
    ORDER BY sort_order ASC
  `).all() as LearningModuleRow[];
  return rows.map(toCatalogEntry);
}

export interface LearningModulePlannerEntry {
  moduleId: string;
  category: string;
  title: string;
  intro: string;
  isFoundationBaseline: boolean;
  sections: Array<{
    heading: string;
    body: string;
    topics: string[];
  }>;
  questionTopics: string[];
}

function extractTopics(text: string): string[] {
  const words = String(text || '')
    .toLowerCase()
    .replace(/[`"'()[\]{}:,./\\<>!?;=+\-*]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 4);
  return Array.from(new Set(words)).slice(0, 8);
}

export function buildPlannerDigest(options: LearningModuleCatalogOptions = {}): LearningModulePlannerEntry[] {
  return listLearningModuleCatalog(options).map((module) => {
    const sections = module.sections.map((section) => {
      const body = [section.body, section.note, ...(section.bullets || [])].filter(Boolean).join(' ');
      return {
        heading: section.heading,
        body: body.slice(0, 400),
        topics: extractTopics([section.heading, body].join(' ')).slice(0, 6),
      };
    });
    const questionTopics = (module.theoreticalExam?.questions || [])
      .flatMap((q) => extractTopics(questionPromptText(q)).slice(0, 4))
      .slice(0, 16);
    return {
      moduleId: module.moduleId,
      category: module.category,
      title: module.title,
      intro: module.intro.slice(0, 280),
      isFoundationBaseline: module.category === 'foundations',
      sections,
      questionTopics: Array.from(new Set(questionTopics)),
    };
  });
}
