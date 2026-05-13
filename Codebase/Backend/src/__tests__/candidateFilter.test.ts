import { describe, it, expect } from 'vitest';
import {
  findAmbiguousClasses,
  filterToTaggedPatterns,
} from '../services/candidateFilter';
import type { DetectedPatternResult } from '../services/classDeclarationAnalysisService';

// Test fixtures. Only the fields that candidateFilter actually reads
// (className, patternId) need to be realistic; the rest are stubbed.
function mk(className: string, patternId: string): DetectedPatternResult {
  return {
    patternId,
    patternFamily: 'creational',
    patternName: patternId,
    targetClassHash: `${className}-${patternId}`,
    className,
    fileName: 'sample.cpp',
    classText: '',
    parentClassName: '',
    documentationTargets: [],
    unitTestTargets: [],
  };
}

describe('candidateFilter — D38 ambiguity resolution', () => {
  describe('findAmbiguousClasses', () => {
    it('returns empty list when every class has a single detection', () => {
      const patterns = [mk('A', 'singleton'), mk('B', 'factory'), mk('C', 'builder')];
      expect(findAmbiguousClasses(patterns, {})).toEqual([]);
    });

    it('flags classes with two-or-more competing detections', () => {
      const patterns = [
        mk('A', 'singleton'),
        mk('A', 'factory'),
        mk('B', 'builder'),
      ];
      expect(findAmbiguousClasses(patterns, {})).toEqual(['A']);
    });

    it('treats a class as resolved once resolvedMap names a pattern (regardless of which one)', () => {
      const patterns = [mk('A', 'singleton'), mk('A', 'factory')];
      // Any non-empty value for class A means the user picked one.
      expect(findAmbiguousClasses(patterns, { A: 'singleton' })).toEqual([]);
      expect(findAmbiguousClasses(patterns, { A: 'factory' })).toEqual([]);
    });

    it('drops className-less detections (microservice may emit pattern hits without a class binding)', () => {
      const patterns = [mk('', 'singleton'), mk('', 'factory'), mk('A', 'singleton')];
      expect(findAmbiguousClasses(patterns, {})).toEqual([]);
    });

    it('returns the list sorted so the bounce message is deterministic', () => {
      const patterns = [
        mk('Zebra', 's'),  mk('Zebra', 'f'),
        mk('Aardvark', 's'), mk('Aardvark', 'f'),
        mk('Mango', 's'),  mk('Mango', 'f'),
      ];
      expect(findAmbiguousClasses(patterns, {})).toEqual(['Aardvark', 'Mango', 'Zebra']);
    });
  });

  describe('filterToTaggedPatterns', () => {
    it('keeps single-detection classes without any user input', () => {
      const patterns = [mk('A', 'singleton'), mk('B', 'factory')];
      const kept = filterToTaggedPatterns(patterns, {});
      expect(kept.map((p) => `${p.className}:${p.patternId}`)).toEqual([
        'A:singleton',
        'B:factory',
      ]);
    });

    it('keeps only the user-picked pattern for ambiguous classes', () => {
      const patterns = [
        mk('A', 'singleton'),
        mk('A', 'factory'),
        mk('A', 'builder'),
      ];
      const kept = filterToTaggedPatterns(patterns, { A: 'factory' });
      expect(kept.map((p) => p.patternId)).toEqual(['factory']);
    });

    it('drops all detections for an unresolved ambiguous class (refuses to guess)', () => {
      const patterns = [
        mk('A', 'singleton'),
        mk('A', 'factory'),
        mk('B', 'builder'),
      ];
      const kept = filterToTaggedPatterns(patterns, {});
      // B is single-detection so it survives; A is dropped entirely.
      expect(kept.map((p) => p.className)).toEqual(['B']);
    });

    it('drops className-less detections (no class to scope a test against)', () => {
      const patterns = [mk('', 'singleton'), mk('A', 'singleton')];
      const kept = filterToTaggedPatterns(patterns, {});
      expect(kept.map((p) => p.className)).toEqual(['A']);
    });

    it('honours resolvedMap even when the named patternId is not one the matcher emitted (no crash)', () => {
      // Defensive: stale resolutions should drop everything for that class
      // rather than throwing. The runner will then re-prompt.
      const patterns = [mk('A', 'singleton'), mk('A', 'factory')];
      const kept = filterToTaggedPatterns(patterns, { A: 'builder' });
      expect(kept).toEqual([]);
    });

    it('matches resolvedMap canonical name (e.g. "Singleton") against patternId "creational.singleton"', () => {
      // Real-world bug: frontend canonicalPatternName() emits PascalCase
      // palette names ("Singleton", "Factory"), but the microservice emits
      // patternId values prefixed with a family (e.g. "creational.singleton").
      // Without normalization the filter never matches and the runner
      // returns 400 AMBIGUOUS_TAGS even though the user tagged a real
      // pattern. Lock the cross-format match in.
      const realPatterns: DetectedPatternResult[] = [
        { ...mk('Connection', 'creational.singleton'), patternName: 'Singleton' },
        { ...mk('Connection', 'creational.factory'),   patternName: 'Factory' },
      ];
      const kept = filterToTaggedPatterns(realPatterns, { Connection: 'Singleton' });
      expect(kept.map((p) => p.patternId)).toEqual(['creational.singleton']);
    });

    it('matches case-insensitively against patternName', () => {
      const patterns: DetectedPatternResult[] = [
        { ...mk('Builder', 'creational.builder'), patternName: 'Builder' },
        { ...mk('Builder', 'creational.factory'), patternName: 'Factory' },
      ];
      // resolvedMap might come in lowercase from older clients.
      const kept = filterToTaggedPatterns(patterns, { Builder: 'builder' });
      expect(kept.map((p) => p.patternId)).toEqual(['creational.builder']);
    });
  });
});
