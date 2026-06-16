# payloadValidator

- Folder: `Backend/src/payloadValidator`
- Owner: Backend

## Logic Summary

Payload validators define the API boundary for persisted learning content. They accept admin-authored course modules, reject incomplete rows before storage, and preserve the question shapes the frontend and catalog services need later.

## Ownership Boundary

This folder owns request-shape validation only. It does not choose learner assessment questions, repair production rows, or infer missing content beyond safe compatibility defaults for legacy payloads.

## Documents By Logic

- `learning/index.ts.md` - learning-module admin payload contract, including mixed theoretical questions and Bloom taxonomy validation.

## Acceptance Checks

- Admin course saves reject incomplete question payloads before they reach storage.
- Legacy MCQ rows without an explicit `type` remain accepted as `mcq`.
- Identification and Studio questions keep their type-specific fields through validation.
