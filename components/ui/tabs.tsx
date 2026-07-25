'use client';

import type { HTMLAttributes, KeyboardEvent } from 'react';
import { useRef } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';

// Two modes share one API and styling:
//  - link tabs (href) render as a <nav> of <Link>s (e.g. ?view=).
//  - button tabs (tabId/panelId) render a roving-tabindex tablist with
//    Arrow/Home/End keys, controlling panels rendered elsewhere.
// Radix Tabs is intentionally not used: its coupled Root/List/Content model
// cannot express link-nav tabs or externally-rendered panels.

interface TabItemBase {
  key: string;
  label: string;
  count?: number;
}

/** Link-driven tab (e.g. `?view=`). */
export interface LinkTabItem extends TabItemBase {
  href: string;
}

/** Button/state-driven tab. */
export interface ButtonTabItem extends TabItemBase {
  href?: never;
  tabId: string;
  panelId: string;
}

export type TabItem = LinkTabItem | ButtonTabItem;

interface TabsCommonProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  activeKey: string;
  label: string;
}

export interface LinkTabsProps extends TabsCommonProps {
  items: LinkTabItem[];
  onSelect?: never;
}

export interface ButtonTabsProps extends TabsCommonProps {
  items: ButtonTabItem[];
  /** Required for button/state-driven tabs — called with the selected tab's key. */
  onSelect: (key: string) => void;
}

export type TabsProps = LinkTabsProps | ButtonTabsProps;

const rail =
  'flex items-center gap-6 overflow-x-auto overflow-y-hidden whitespace-nowrap border-b border-[var(--color-border)]';

const tabBase =
  'inline-flex items-center gap-1.5 border-b-2 border-transparent px-1 pb-2 text-[length:var(--text-sm)] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-canvas)]';

const activeClasses = 'border-[var(--color-text-primary)] text-[var(--color-text-primary)]';
const inactiveClasses =
  'text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]';

function TabCount({ count, active }: { count: number; active: boolean }) {
  return (
    <span
      className={cn(
        'font-mono text-[length:var(--text-sm)]',
        active ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-tertiary)]',
      )}
    >
      {count}
    </span>
  );
}

function isLinkDriven(items: TabItem[]): items is LinkTabItem[] {
  return items.every((item) => item.href !== undefined);
}

export function Tabs(props: TabsProps) {
  const { items, activeKey, label, className, onSelect, ...rest } = props;
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  if (isLinkDriven(items)) {
    return (
      <nav aria-label={label} className={cn(rail, className)} {...rest}>
        {items.map((item) => {
          const active = item.key === activeKey;
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(tabBase, active ? activeClasses : inactiveClasses)}
            >
              <span>{item.label}</span>
              {item.count !== undefined ? <TabCount count={item.count} active={active} /> : null}
            </Link>
          );
        })}
      </nav>
    );
  }

  const handleSelect = onSelect as (key: string) => void;

  function focusAndSelect(index: number) {
    const count = items.length;
    const nextIndex = ((index % count) + count) % count;
    buttonRefs.current[nextIndex]?.focus();
    handleSelect(items[nextIndex].key);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        focusAndSelect(index + 1);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        focusAndSelect(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusAndSelect(0);
        break;
      case 'End':
        event.preventDefault();
        focusAndSelect(items.length - 1);
        break;
      default:
        break;
    }
  }

  return (
    <div role="tablist" aria-label={label} aria-orientation="horizontal" className={cn(rail, className)} {...rest}>
      {items.map((item, index) => {
        const active = item.key === activeKey;
        return (
          <button
            key={item.key}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={item.tabId}
            aria-controls={item.panelId}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => handleSelect(item.key)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(tabBase, active ? activeClasses : inactiveClasses)}
          >
            <span>{item.label}</span>
            {item.count !== undefined ? <TabCount count={item.count} active={active} /> : null}
          </button>
        );
      })}
    </div>
  );
}
