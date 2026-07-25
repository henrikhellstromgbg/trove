'use client';

// Tabs in two modes behind one API and one set of styles:
//  - link tabs (`href`) render a <nav> of <Link>s, for tabs that are really
//    navigation (?view=, /settings/billing). The URL is the state.
//  - button tabs (`tabId`/`panelId`) render a roving-tabindex tablist with
//    Arrow/Home/End keys, controlling panels rendered anywhere on the page.
//
// Radix Tabs is deliberately NOT used here. Its Root/List/Trigger/Content model
// owns both the state and the panels, which rules out the two cases above:
// link-nav tabs (Radix renders triggers, not links, and does not drive routing)
// and externally rendered panels (Content must be a descendant of Root). Radix
// remains correct for a self-contained tab group that owns its own panels; this
// component is the reference for the other two. See components/ui/README.md.

import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';

interface TabItemBase {
  key: string;
  label: string;
  count?: number;
}

/** Link-driven tab: navigation, the URL holds the state. */
export interface LinkTabItem extends TabItemBase {
  href: string;
}

/** Button-driven tab: local state, panels rendered by the consumer. */
export interface ButtonTabItem extends TabItemBase {
  href?: never;
  tabId: string;
  panelId: string;
}

export type TabItem = LinkTabItem | ButtonTabItem;

interface TabsCommonProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  activeKey: string;
  /** Accessible name for the tablist or nav landmark. */
  label: string;
}

export interface LinkTabsProps extends TabsCommonProps {
  items: LinkTabItem[];
  onSelect?: never;
}

export interface ButtonTabsProps extends TabsCommonProps {
  items: ButtonTabItem[];
  /** Required for button-driven tabs, called with the selected tab's key. */
  onSelect: (key: string) => void;
}

export type TabsProps = LinkTabsProps | ButtonTabsProps;

const rail = [
  'flex items-center gap-[var(--space-6)] overflow-x-auto overflow-y-hidden whitespace-nowrap',
  'border-b border-[var(--color-border)]',
].join(' ');

const tabBase = [
  'inline-flex cursor-pointer items-center gap-1.5 border-b-2 border-transparent',
  'px-1 pb-[var(--space-2)] text-[length:var(--text-sm)] font-medium',
  'transition-colors duration-[var(--duration-fast)]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
  'focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-canvas)]',
].join(' ');

const activeClasses = 'border-[var(--color-text-primary)] text-[var(--color-text-primary)]';
const inactiveClasses = [
  'text-[var(--color-text-secondary)]',
  'hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]',
].join(' ');

function TabCount({ count, active }: { count: number; active: boolean }) {
  return (
    <span
      className={cn(
        'font-mono tabular-nums text-[length:var(--text-sm)]',
        active ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-tertiary)]'
      )}
    >
      {count}
    </span>
  );
}

function isLinkDriven(items: TabItem[]): items is LinkTabItem[] {
  return items.every((item) => item.href !== undefined);
}

function Tabs(props: TabsProps) {
  const { items, activeKey, label, className, onSelect, ...rest } = props;
  const buttonRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

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
              {item.count !== undefined && <TabCount count={item.count} active={active} />}
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

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
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
    <div
      role="tablist"
      aria-label={label}
      aria-orientation="horizontal"
      className={cn(rail, className)}
      {...rest}
    >
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
            {item.count !== undefined && <TabCount count={item.count} active={active} />}
          </button>
        );
      })}
    </div>
  );
}

export { Tabs };
