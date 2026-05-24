// Prompt injector for the panelist AI-sample helper.
//
// SEPARATION OF CONCERNS (per project owner): this module is a PURE function.
// It does NO file IO and NO network. It takes the admin-editable prompt
// strings + an already-read pattern JSON object and composes the messages the
// provider call will send. Keeping the "what JSON says" (patternCatalogReader)
// separate from "how we wrap it into a prompt" (here) is the explicit
// decoupling requested: either side can change without touching the other.

export interface InjectedPrompt {
  system: string;
  user: string;
}

export interface InjectPromptInput {
  systemPrompt: string; // admin-editable framing
  injectionInstruction: string; // admin-editable per-request instruction
  patternJson: Record<string, unknown>; // already read by patternCatalogReader
  patternName?: string; // convenience label for the instruction line
}

// Compose the {system, user} message pair. The pattern JSON is serialised and
// fenced inside the user message so the model sees the exact structure to
// satisfy; the instruction precedes it. No defaults are invented here — the
// caller supplies the (settings-backed) prompt strings.
export function injectSamplePrompt(input: InjectPromptInput): InjectedPrompt {
  const { systemPrompt, injectionInstruction, patternJson, patternName } = input;
  const label = patternName || (typeof patternJson.pattern_name === 'string' ? patternJson.pattern_name : 'the pattern');
  const serialized = JSON.stringify(patternJson, null, 2);
  const user = [
    injectionInstruction.trim(),
    '',
    `Target pattern: ${label}`,
    '',
    '=== pattern definition (JSON) ===',
    serialized,
    '=== end pattern definition ===',
    '',
    'Return ONLY the C++ source for the sample. No prose, no Markdown fences.',
  ].join('\n');
  return { system: systemPrompt.trim(), user };
}
