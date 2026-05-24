// Pattern groups tab — admins stage one or more pattern-definition JSON files,
// name the batch, and Proceed to create a custom group. Groups (including the
// synthetic Default GoF group) appear in a checklist with a group-level toggle
// and per-pattern toggles that control which patterns the parser detects.
// Scope is per-org. The default GoF catalog on disk is never mutated — toggles
// drive a per-org assembled catalog at analysis time.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchPatternGroups,
  createPatternGroup,
  patchPatternGroup,
  deletePatternGroup,
  type PatternGroup,
} from '../../api/client';
import {
  validatePatternFile,
  validateGroupName,
  type PatternDefinition,
} from '../../lib/payloadSchemas';

const MAX_FILES = 50;

interface StagedFile {
  id: string;
  name: string;
  text: string;
  parsed: PatternDefinition[] | null;
  error: string | null;
}

function newSlotId(): string {
  return `slot-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function CatalogsTab() {
  const [groups, setGroups] = useState<ReadonlyArray<PatternGroup>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Staging uploader state.
  const [slots, setSlots] = useState<StagedFile[]>([]);
  const [groupName, setGroupName] = useState('');
  const [proceeding, setProceeding] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Checklist UI state.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    try {
      const list = await fetchPatternGroups();
      setGroups(list);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load pattern groups');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // ── Staging uploader ──────────────────────────────────────────────────────
  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setError(null);
    const next: StagedFile[] = [...slots];
    for (const f of files) {
      if (next.length >= MAX_FILES) {
        setError(`At most ${MAX_FILES} files can be staged at once.`);
        break;
      }
      const slot: StagedFile = {
        id: newSlotId(),
        name: f.name,
        text: '',
        parsed: null,
        error: null,
      };
      try {
        const text = await f.text();
        slot.text = text;
        const json = JSON.parse(text) as unknown;
        const res = validatePatternFile(json);
        if (res.ok && res.value) {
          slot.parsed = res.value;
        } else {
          slot.error = res.error ?? 'invalid pattern definition';
        }
      } catch {
        slot.error = 'not valid JSON';
      }
      next.push(slot);
    }
    setSlots(next);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removeSlot(id: string): void {
    setSlots((prev) => prev.filter((s) => s.id !== id));
  }

  const validSlots = slots.filter((s) => s.parsed && !s.error);
  const hasInvalidSlot = slots.some((s) => s.error);
  const flattened: PatternDefinition[] = validSlots.flatMap((s) => s.parsed ?? []);
  const nameCheck = validateGroupName(groupName);
  const canProceed =
    !proceeding &&
    !busy &&
    slots.length > 0 &&
    !hasInvalidSlot &&
    flattened.length > 0 &&
    nameCheck.ok;

  async function onProceed(): Promise<void> {
    if (!canProceed || !nameCheck.value) return;
    setProceeding(true);
    setError(null);
    try {
      await createPatternGroup({
        name: nameCheck.value,
        patterns: flattened as ReadonlyArray<Record<string, unknown>>,
      });
      setSlots([]);
      setGroupName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create pattern group');
    } finally {
      setProceeding(false);
    }
  }

  // ── Checklist (optimistic toggles + rollback) ───────────────────────────────
  function applyGroupUpdate(updated: PatternGroup): void {
    setGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
  }

  async function toggleGroup(group: PatternGroup, next: boolean): Promise<void> {
    if (savingKey) return;
    const key = `group-${group.id}`;
    setSavingKey(key);
    setError(null);
    const snapshot = groups;
    applyGroupUpdate({ ...group, active: next });
    try {
      const res = await patchPatternGroup(group.id, { active: next });
      applyGroupUpdate(res);
    } catch (err: unknown) {
      setGroups(snapshot);
      setError(err instanceof Error ? err.message : 'Toggle failed');
    } finally {
      setSavingKey(null);
    }
  }

  async function togglePattern(
    group: PatternGroup,
    patternId: string,
    next: boolean
  ): Promise<void> {
    if (savingKey) return;
    const key = `pattern-${group.id}-${patternId}`;
    setSavingKey(key);
    setError(null);
    const snapshot = groups;
    applyGroupUpdate({
      ...group,
      patterns: group.patterns.map((p) =>
        p.patternId === patternId ? { ...p, enabled: next } : p
      ),
    });
    try {
      const res = await patchPatternGroup(group.id, { patternEnabled: { [patternId]: next } });
      applyGroupUpdate(res);
    } catch (err: unknown) {
      setGroups(snapshot);
      setError(err instanceof Error ? err.message : 'Toggle failed');
    } finally {
      setSavingKey(null);
    }
  }

  async function onDeleteGroup(group: PatternGroup): Promise<void> {
    if (group.id === 'default' || !group.deletable) return;
    if (!window.confirm(`Delete pattern group "${group.name}"? Its patterns stop firing.`)) return;
    setBusy(true);
    setError(null);
    try {
      await deletePatternGroup(group.id as number);
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-section admin-section--card" data-testid="admin-catalogs">
      <header className="admin-section__head">
        <p className="eyebrow">Pattern groups</p>
        <h2>Stage and toggle pattern groups</h2>
        <p className="admin-section__hint">
          Stage one or more pattern-definition JSON files, name the batch, and
          Proceed to create a custom group. Toggle whole groups or individual
          patterns below to control what the parser detects for your org. The
          built-in Gang of Four set stays separate and is never overwritten.
        </p>
      </header>

      {/* ── Staging uploader ── */}
      <div className="admin-catalog-upload">
        <label className="admin-catalog-field">
          <span>Group name</span>
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="e.g. acme-internal-patterns-v1"
            disabled={proceeding}
          />
        </label>
        <label className="admin-catalog-field">
          <span>Pattern JSON files</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            multiple
            onChange={onPickFiles}
            disabled={proceeding || slots.length >= MAX_FILES}
          />
        </label>
        <button
          type="button"
          className="ghost-btn"
          onClick={onProceed}
          disabled={!canProceed}
          data-testid="pattern-group-proceed"
        >
          {proceeding ? 'Creating…' : 'Proceed'}
        </button>
      </div>

      {slots.length > 0 && (
        <ul className="admin-catalog-list" data-testid="pattern-group-staged">
          {slots.map((s) => (
            <li key={s.id} className="admin-catalog-row" data-valid={s.error ? 'false' : 'true'}>
              <div className="admin-catalog-row__main">
                <strong>{s.name}</strong>
                <span className="admin-catalog-row__meta">
                  {s.error
                    ? s.error
                    : `${s.parsed?.length ?? 0} pattern${(s.parsed?.length ?? 0) === 1 ? '' : 's'}`}
                </span>
              </div>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => removeSlot(s.id)}
                disabled={proceeding}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="admin-login-error" role="alert">{error}</p>}

      {/* ── Checklist ── */}
      <ul className="admin-feature-list" data-testid="pattern-groups-checklist">
        {groups.map((group) => {
          const groupKey = String(group.id);
          const isOpen = expanded[groupKey] === true;
          const groupBusy = savingKey === `group-${group.id}`;
          return (
            <li
              key={groupKey}
              className="admin-feature-row"
              data-released={group.active ? 'true' : 'false'}
            >
              <div className="admin-feature-row__meta">
                <p className="admin-feature-row__label">
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() =>
                      setExpanded((prev) => ({ ...prev, [groupKey]: !isOpen }))
                    }
                    aria-expanded={isOpen}
                  >
                    {isOpen ? '▾' : '▸'}
                  </button>{' '}
                  {group.name}
                </p>
                <p className="admin-feature-row__desc">
                  {group.kind === 'default' ? 'Built-in Gang of Four' : 'Custom group'} ·{' '}
                  {group.patterns.length} pattern
                  {group.patterns.length === 1 ? '' : 's'}
                </p>
              </div>
              <button
                type="button"
                className={`admin-feature-row__toggle${group.active ? ' is-on' : ''}`}
                onClick={() => toggleGroup(group, !group.active)}
                disabled={groupBusy}
                aria-pressed={group.active}
                data-testid={`group-toggle-${group.id}`}
              >
                {groupBusy ? 'Saving…' : group.active ? 'Active' : 'Off'}
              </button>
              {group.deletable && (
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => onDeleteGroup(group)}
                  disabled={busy}
                >
                  Delete
                </button>
              )}

              {isOpen && (
                <ul className="admin-feature-list admin-feature-list--nested">
                  {group.patterns.length === 0 && (
                    <li className="admin-section__hint">No patterns in this group.</li>
                  )}
                  {group.patterns.map((p) => {
                    const patternBusy = savingKey === `pattern-${group.id}-${p.patternId}`;
                    return (
                      <li
                        key={p.patternId}
                        className="admin-feature-row"
                        data-released={p.enabled ? 'true' : 'false'}
                      >
                        <div className="admin-feature-row__meta">
                          <p className="admin-feature-row__label">{p.patternName}</p>
                          <p className="admin-feature-row__key">
                            <code>{p.patternFamily}</code>
                          </p>
                        </div>
                        <button
                          type="button"
                          className={`admin-feature-row__toggle${p.enabled ? ' is-on' : ''}`}
                          onClick={() => togglePattern(group, p.patternId, !p.enabled)}
                          disabled={patternBusy}
                          aria-pressed={p.enabled}
                          data-testid={`pattern-toggle-${group.id}-${p.patternId}`}
                        >
                          {patternBusy ? 'Saving…' : p.enabled ? 'On' : 'Off'}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
