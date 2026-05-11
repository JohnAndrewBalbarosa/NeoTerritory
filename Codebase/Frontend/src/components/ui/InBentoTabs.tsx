import { ReactNode, useCallback, useId, useMemo, useRef, useState, KeyboardEvent } from 'react';

export interface InBentoTab {
  id: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
  disabled?: boolean;
}

interface InBentoTabsProps {
  tabs: InBentoTab[];
  defaultTabId?: string;
  activeTabId?: string;
  onChange?: (tabId: string) => void;
  className?: string;
  ariaLabel?: string;
}

export default function InBentoTabs({
  tabs,
  defaultTabId,
  activeTabId,
  onChange,
  className,
  ariaLabel,
}: InBentoTabsProps) {
  const reactId = useId();
  const firstEnabled = useMemo(() => tabs.find(t => !t.disabled)?.id ?? tabs[0]?.id, [tabs]);
  const [internalActive, setInternalActive] = useState<string>(defaultTabId ?? firstEnabled ?? '');
  const active = activeTabId ?? internalActive;
  const listRef = useRef<HTMLDivElement | null>(null);

  const select = useCallback((id: string) => {
    if (activeTabId === undefined) setInternalActive(id);
    onChange?.(id);
  }, [activeTabId, onChange]);

  const onKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    const enabled = tabs.filter(t => !t.disabled);
    if (enabled.length === 0) return;
    const currentIndex = enabled.findIndex(t => t.id === active);
    let nextIndex = currentIndex;
    switch (e.key) {
      case 'ArrowRight':
        nextIndex = (currentIndex + 1) % enabled.length;
        break;
      case 'ArrowLeft':
        nextIndex = (currentIndex - 1 + enabled.length) % enabled.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = enabled.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    const nextId = enabled[nextIndex].id;
    select(nextId);
    const root = listRef.current;
    if (!root) return;
    const btn = root.querySelector<HTMLButtonElement>(`[data-tab-id="${nextId}"]`);
    btn?.focus();
  }, [active, select, tabs]);

  const activeTab = tabs.find(t => t.id === active) ?? tabs[0];

  return (
    <div className={`bento-tabs${className ? ` ${className}` : ''}`}>
      <div
        ref={listRef}
        className="bento-tabs__list"
        role="tablist"
        aria-label={ariaLabel}
        onKeyDown={onKeyDown}
      >
        {tabs.map(tab => {
          const isActive = tab.id === active;
          const tabPanelId = `${reactId}-panel-${tab.id}`;
          const tabId = `${reactId}-tab-${tab.id}`;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={tabId}
              data-tab-id={tab.id}
              aria-selected={isActive}
              aria-controls={tabPanelId}
              tabIndex={isActive ? 0 : -1}
              disabled={tab.disabled}
              className={`bento-tabs__tab${isActive ? ' bento-tabs__tab--active' : ''}`}
              onClick={() => select(tab.id)}
            >
              {tab.icon ? <span className="bento-tabs__tab-icon" aria-hidden>{tab.icon}</span> : null}
              <span className="bento-tabs__tab-label">{tab.label}</span>
            </button>
          );
        })}
      </div>
      <div
        className="bento-tabs__panel"
        role="tabpanel"
        id={`${reactId}-panel-${activeTab?.id ?? ''}`}
        aria-labelledby={`${reactId}-tab-${activeTab?.id ?? ''}`}
      >
        {activeTab?.content}
      </div>
    </div>
  );
}
