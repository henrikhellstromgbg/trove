import * as React from 'react';
import { cva } from 'class-variance-authority';
import { NavigationMenu as NavigationMenuPrimitive } from 'radix-ui';

import { ChevronDown } from '@/components/icons';
import { cn } from '@/lib/cn';

function NavigationMenu({ className, children, viewport = true, ...props }: React.ComponentProps<typeof NavigationMenuPrimitive.Root> & { viewport?: boolean }) {
  return (
    <NavigationMenuPrimitive.Root
      data-slot="navigation-menu"
      data-viewport={viewport}
      className={cn('group/navigation-menu relative flex max-w-max flex-1 items-center justify-center', className)}
      {...props}
    >
      {children}
      {viewport && <NavigationMenuViewport />}
    </NavigationMenuPrimitive.Root>
  );
}

function NavigationMenuList({ className, ...props }: React.ComponentProps<typeof NavigationMenuPrimitive.List>) {
  return (
    <NavigationMenuPrimitive.List
      data-slot="navigation-menu-list"
      className={cn('group flex flex-1 list-none items-center justify-center gap-[var(--space-1)]', className)}
      {...props}
    />
  );
}

function NavigationMenuItem({ className, ...props }: React.ComponentProps<typeof NavigationMenuPrimitive.Item>) {
  return <NavigationMenuPrimitive.Item data-slot="navigation-menu-item" className={cn('relative cursor-pointer', className)} {...props} />;
}

const navigationMenuTriggerStyle = cva([
  'group/navigation-menu-trigger inline-flex min-h-[var(--touch-target-min)] w-max cursor-pointer items-center justify-center',
  'gap-[var(--space-2)] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)]',
  'text-[length:var(--text-sm)] font-medium text-[var(--color-text-primary)]',
  'transition-colors duration-[var(--duration-fast)]',
  'hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-active)]',
  'data-[state=open]:bg-[var(--color-surface-active)] data-[state=open]:text-[var(--color-text-primary)]',
  'disabled:pointer-events-none disabled:cursor-not-allowed disabled:text-[var(--color-text-disabled)]',
]);

function NavigationMenuTrigger({ className, children, ...props }: React.ComponentProps<typeof NavigationMenuPrimitive.Trigger>) {
  return (
    <NavigationMenuPrimitive.Trigger data-slot="navigation-menu-trigger" className={cn(navigationMenuTriggerStyle(), className)} {...props}>
      {children}
      <ChevronDown
        size={16}
        className="transition-transform duration-[var(--duration-base)] ease-[var(--ease-out)] group-data-[state=open]/navigation-menu-trigger:rotate-180"
        aria-hidden="true"
      />
    </NavigationMenuPrimitive.Trigger>
  );
}

function NavigationMenuContent({ className, ...props }: React.ComponentProps<typeof NavigationMenuPrimitive.Content>) {
  return (
    <NavigationMenuPrimitive.Content
      data-slot="navigation-menu-content"
      className={cn(
        'left-0 top-0 w-full p-[var(--space-2)] duration-[var(--duration-base)] ease-[var(--ease-out)] md:absolute md:w-auto',
        'group-data-[viewport=false]/navigation-menu:top-full group-data-[viewport=false]/navigation-menu:mt-[var(--space-2)]',
        'group-data-[viewport=false]/navigation-menu:overflow-hidden group-data-[viewport=false]/navigation-menu:rounded-[var(--radius-lg)]',
        'group-data-[viewport=false]/navigation-menu:border group-data-[viewport=false]/navigation-menu:border-[var(--color-border)]',
        'group-data-[viewport=false]/navigation-menu:bg-[var(--color-surface-raised)] group-data-[viewport=false]/navigation-menu:text-[var(--color-text-primary)] group-data-[viewport=false]/navigation-menu:shadow-[var(--shadow-md)]',
        'data-[motion^=from-]:animate-in data-[motion^=from-]:fade-in data-[motion^=to-]:animate-out data-[motion^=to-]:fade-out',
        'data-[motion=from-end]:slide-in-from-right data-[motion=from-start]:slide-in-from-left data-[motion=to-end]:slide-out-to-right data-[motion=to-start]:slide-out-to-left',
        className
      )}
      {...props}
    />
  );
}

function NavigationMenuViewport({ className, ...props }: React.ComponentProps<typeof NavigationMenuPrimitive.Viewport>) {
  return (
    <div className="absolute left-0 top-full isolate z-[var(--z-dropdown)] flex justify-center">
      <NavigationMenuPrimitive.Viewport
        data-slot="navigation-menu-viewport"
        className={cn(
          'relative mt-[var(--space-2)] h-[var(--radix-navigation-menu-viewport-height)] w-full origin-top-center overflow-hidden',
          'rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] text-[var(--color-text-primary)] shadow-[var(--shadow-md)]',
          'duration-[var(--duration-base)] ease-[var(--ease-out)] md:w-[var(--radix-navigation-menu-viewport-width)]',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          className
        )}
        {...props}
      />
    </div>
  );
}

function NavigationMenuLink({ className, ...props }: React.ComponentProps<typeof NavigationMenuPrimitive.Link>) {
  return (
    <NavigationMenuPrimitive.Link
      data-slot="navigation-menu-link"
      className={cn(
        'flex min-h-[var(--touch-target-min)] cursor-pointer items-center gap-[var(--space-2)] rounded-[var(--radius-md)] p-[var(--space-3)]',
        'text-[length:var(--text-sm)] text-[var(--color-text-primary)] transition-colors duration-[var(--duration-fast)]',
        'hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-active)]',
        'data-[active]:bg-[var(--color-surface-active)] data-[active]:text-[var(--color-text-primary)]',
        'aria-disabled:pointer-events-none aria-disabled:cursor-not-allowed aria-disabled:text-[var(--color-text-disabled)]',
        className
      )}
      {...props}
    />
  );
}

function NavigationMenuIndicator({ className, ...props }: React.ComponentProps<typeof NavigationMenuPrimitive.Indicator>) {
  return (
    <NavigationMenuPrimitive.Indicator
      data-slot="navigation-menu-indicator"
      className={cn(
        'top-full z-[var(--z-dropdown)] flex h-[var(--space-2)] items-end justify-center overflow-hidden',
        'duration-[var(--duration-base)] ease-[var(--ease-out)] data-[state=hidden]:animate-out data-[state=hidden]:fade-out data-[state=visible]:animate-in data-[state=visible]:fade-in',
        className
      )}
      {...props}
    >
      <div className="relative top-1/2 size-[var(--space-3)] rotate-45 rounded-tl-[var(--radius-sm)] border-l border-t border-[var(--color-border)] bg-[var(--color-surface-raised)]" />
    </NavigationMenuPrimitive.Indicator>
  );
}

export { NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuContent, NavigationMenuTrigger, NavigationMenuLink, NavigationMenuIndicator, NavigationMenuViewport, navigationMenuTriggerStyle };
