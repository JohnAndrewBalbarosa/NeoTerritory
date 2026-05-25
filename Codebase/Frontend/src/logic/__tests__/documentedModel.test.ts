import { describe, test, expect } from 'vitest';
import { buildDocumentedModel } from '../documentedModel';
import { deriveAnnotatedModel } from '../annotatedModel';
import { AnalysisRun } from '../../types/api';

function makeRun(over: Partial<AnalysisRun> = {}): AnalysisRun {
  return {
    runId: null,
    sourceName: 'demo.cpp',
    sourceText: 'class ShapeFactory {\n  Shape* create(int t);\n};\n',
    detectedPatterns: [],
    annotations: [],
    ranking: null,
    classUsageBindings: {},
    classUsageBindingSource: 'heuristic',
    summary: '',
    ...over,
  };
}

describe('buildDocumentedModel', () => {
  test('returns empty maps for a run with no patterns or annotations', () => {
    // Arrange
    const run = makeRun();
    const annotated = deriveAnnotatedModel({ run });

    // Act
    const model = buildDocumentedModel(run, annotated);

    // Assert
    expect(model.headerByLine.size).toBe(0);
    expect(model.docByLine.size).toBe(0);
  });

  test('emits a header at the class declaration line with the static one-liner', () => {
    // Arrange
    const run = makeRun({
      detectedPatterns: [{
        patternId: 'creational.factory',
        patternName: 'Factory',
        confidence: 1,
        className: 'ShapeFactory',
        documentationTargets: [{ label: 'factory class', line: 1, lexeme: 'class ShapeFactory' }],
        unitTestTargets: [{ function_hash: 'h1', function_name: 'create', branch_kind: 'if', line: 2 }],
      }],
    });
    const annotated = deriveAnnotatedModel({ run });

    // Act
    const model = buildDocumentedModel(run, annotated);
    const header = model.headerByLine.get(1);

    // Assert
    expect(header).toBeDefined();
    expect(header!.patternName).toBe('Factory');
    expect(header!.className).toBe('ShapeFactory');
    expect(header!.source).toBe('static');
    expect(header!.oneLiner.length).toBeGreaterThan(0);
    expect(header!.methodsToTest).toEqual([{ name: 'create', line: 2, branchKind: 'if' }]);
  });

  test('prefers AI education over the static definition', () => {
    // Arrange
    const run = makeRun({
      detectedPatterns: [{
        patternId: 'creational.factory',
        patternName: 'Factory',
        confidence: 1,
        className: 'ShapeFactory',
        documentationTargets: [{ label: 'factory class', line: 1, lexeme: 'class ShapeFactory' }],
        unitTestTargets: [],
        patternEducation: {
          explanation: 'This builds shapes for you.',
          whyThisFired: 'create() returns a base pointer.',
          studyHint: 'Look at create().',
        },
      }],
    });
    const annotated = deriveAnnotatedModel({ run });

    // Act
    const model = buildDocumentedModel(run, annotated);
    const header = model.headerByLine.get(1);

    // Assert
    expect(header!.source).toBe('ai');
    expect(header!.oneLiner).toBe('This builds shapes for you.');
    expect(header!.whyThisFired).toBe('create() returns a base pointer.');
  });

  test('emits an inline doc on an annotated line, folding landmark + usage', () => {
    // Arrange
    const run = makeRun({
      detectedPatterns: [{
        patternId: 'creational.factory',
        patternName: 'Factory',
        confidence: 1,
        className: 'ShapeFactory',
        documentationTargets: [{ label: 'create method', line: 2, lexeme: 'create' }],
        unitTestTargets: [],
      }],
      annotations: [{
        id: 'a1', order: 0, stage: 'static', severity: 'low',
        line: 2, lineEnd: null, title: 'Factory method', comment: 'Picks the concrete type.',
        excerpt: '', kind: 'doc', patternKey: 'Factory', className: 'ShapeFactory',
      }],
      classUsageBindings: {
        ShapeFactory: [{ kind: 'call', line: 8 }, { kind: 'call', line: 9 }],
      },
    });
    const annotated = deriveAnnotatedModel({ run });

    // Act
    const model = buildDocumentedModel(run, annotated);
    const doc = model.docByLine.get(2);

    // Assert
    expect(doc).toBeDefined();
    expect(doc!.notes[0]).toEqual({ title: 'Factory method', comment: 'Picks the concrete type.', source: 'static' });
    expect(doc!.landmarks).toContain('create method');
    expect(doc!.usageLines).toEqual([8, 9]);
  });

  test('marks an AI annotation note with source "ai"', () => {
    // Arrange
    const run = makeRun({
      annotations: [{
        id: 'a2', order: 0, stage: 'ai_commentary', severity: 'low',
        line: 2, lineEnd: null, title: 'Note', comment: 'AI note.',
        excerpt: '', kind: 'doc', patternKey: 'Factory', className: 'ShapeFactory',
      }],
    });
    const annotated = deriveAnnotatedModel({ run });

    // Act
    const model = buildDocumentedModel(run, annotated);

    // Assert
    expect(model.docByLine.get(2)!.notes[0].source).toBe('ai');
  });
});
