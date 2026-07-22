"use client";

import type { HTMLAttributes, KeyboardEvent } from "react";
import { useRef } from "react";
import Link from "next/link";
import { cx } from "./class-names";

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

interface TabsCommonProps extends Omit<HTMLAttributes<HTMLDivElement>, "onSelect"> {
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

const tabBase =
  "inline-flex items-center gap-1.5 border-b-2 border-transparent px-1 pb-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-dim focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";

const activeClasses = "border-ink text-ink";
const inactiveClasses = "text-ink-dim hover:border-line-strong hover:text-ink";

function TabCount({ count, active }: { count: number; active: boolean }) {
  return (
    <span className={cx("font-mono text-xs", active ? "text-ink-dim" : "text-ink-faint")}>
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
      <nav
        aria-label={label}
        className={cx(
          "flex items-center gap-6 overflow-x-auto overflow-y-hidden whitespace-nowrap border-b border-line",
          className,
        )}
        {...rest}
      >
        {items.map((item) => {
          const active = item.key === activeKey;
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cx(tabBase, active ? activeClasses : inactiveClasses)}
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
    const item = items[nextIndex];
    buttonRefs.current[nextIndex]?.focus();
    handleSelect(item.key);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        focusAndSelect(index + 1);
        break;
      case "ArrowLeft":
        event.preventDefault();
        focusAndSelect(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusAndSelect(0);
        break;
      case "End":
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
      className={cx(
        "flex items-center gap-6 overflow-x-auto overflow-y-hidden whitespace-nowrap border-b border-line",
        className,
      )}
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
            className={cx(tabBase, active ? activeClasses : inactiveClasses)}
          >
            <span>{item.label}</span>
            {item.count !== undefined ? <TabCount count={item.count} active={active} /> : null}
          </button>
        );
      })}
    </div>
  );
}
