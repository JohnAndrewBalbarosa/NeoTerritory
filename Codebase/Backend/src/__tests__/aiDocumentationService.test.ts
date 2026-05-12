import { describe, it, expect } from 'vitest';
import {
  buildAiPayload,
  normalizeAiResult,
} from '../services/aiDocumentationService';

// Pure-function coverage for the AI documentation envelope. These two
// functions are the boundary between "trusted backend output" and
// "untrusted provider response" — exactly the slice D44 (Testing Trophy)
// calls out as the AI-pipeline integration surface. We do NOT call out
// to Anthropic here: the network path is exercised separately by the
// post-deploy smoke job (Phase E).

describe('aiDocumentationService — pure envelope shape', () => {
  describe('buildAiPayload', () => {
    it('fills required defaults when the caller passed nothing', () => {
      const payload = buildAiPayload({});
      expect(payload.task).toBe('document_detected_design_pattern_code');
      expect(payload.detectedPattern).toBeNull();
      expect(payload.language).toBe('cpp');
      expect(payload.className).toBe('');
      expect(payload.fileName).toBe('');
      expect(payload.classText).toBe('');
      expect(payload.documentationTargets).toEqual([]);
      expect(payload.unitTestTargets).toEqual([]);
    });

    it('passes through provided fields verbatim', () => {
      const payload = buildAiPayload({
        detectedPattern: 'singleton',
        language: 'cpp',
        className: 'ConfigRegistry',
        fileName: 'config_registry.cpp',
        classText: 'class ConfigRegistry { ... };',
        documentationTargets: [{ label: 'getInstance', line: 12, lexeme: 'static' }],
        unitTestTargets: [{ function_hash: 'h1', function_name: 'getInstance', branch_kind: 'method', line: 12 }],
      });
      expect(payload.detectedPattern).toBe('singleton');
      expect(payload.className).toBe('ConfigRegistry');
      expect(payload.documentationTargets).toHaveLength(1);
      expect(payload.unitTestTargets).toHaveLength(1);
    });

    it('coerces non-array target fields to []', () => {
      // The microservice can emit null / undefined for these when nothing
      // anchored to a line; the AI envelope must still be an array so the
      // prompt template can iterate it.
      const payload = buildAiPayload({
        documentationTargets: undefined,
        unitTestTargets: undefined,
      });
      expect(payload.documentationTargets).toEqual([]);
      expect(payload.unitTestTargets).toEqual([]);
    });
  });

  describe('normalizeAiResult', () => {
    it('returns a failed envelope when input is null', () => {
      const r = normalizeAiResult(null);
      expect(r.status).toBe('failed');
      expect(r.reason).toBe('empty_ai_result');
      expect(r.documentationByTarget).toEqual({});
      expect(r.unitTestPlanByTarget).toEqual({});
    });

    it('returns a failed envelope when input is not an object', () => {
      const r = normalizeAiResult('whoops');
      expect(r.status).toBe('failed');
      expect(r.reason).toBe('empty_ai_result');
    });

    it('preserves a generated envelope with maps and provider metadata', () => {
      const r = normalizeAiResult({
        status: 'generated',
        documentationByTarget: { 'h1': 'Doc string' },
        unitTestPlanByTarget: { 'h1': 'Plan string' },
        providerMetadata: { id: 'msg_abc', model: 'claude-sonnet-4-6' },
      });
      expect(r.status).toBe('generated');
      expect(r.documentationByTarget['h1']).toBe('Doc string');
      expect(r.unitTestPlanByTarget['h1']).toBe('Plan string');
      expect(r.providerMetadata?.model).toBe('claude-sonnet-4-6');
    });

    it('defaults missing maps to {} instead of leaking undefined to the FE', () => {
      // Frontend code does Object.entries(documentationByTarget) — a missing
      // map would crash with "Cannot convert undefined or null to object".
      // This contract is what D44 protects.
      const r = normalizeAiResult({ status: 'generated' });
      expect(r.documentationByTarget).toEqual({});
      expect(r.unitTestPlanByTarget).toEqual({});
      expect(r.providerMetadata).toBeNull();
    });

    it('uses generated as the default status when raw omits it', () => {
      const r = normalizeAiResult({ documentationByTarget: { x: 'y' } });
      expect(r.status).toBe('generated');
    });
  });
});
