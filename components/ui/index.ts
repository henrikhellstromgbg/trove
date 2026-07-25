// Root component library barrel. Views import from '@/components/ui'.
// base-ds natives + Trove-API adapters, all on semantic tokens.

export { cn as cx } from '@/lib/cn';

export { Button, buttonVariants } from './button';
export type { ButtonProps } from './button';

export { IconButton } from './icon-button';
export type { IconButtonProps } from './icon-button';

export { StatusIndicator } from './status-indicator';
export type { StatusIndicatorProps, Status } from './status-indicator';

export { EmptyState } from './empty-state';
export type { EmptyStateProps } from './empty-state';

export { InlineError } from './inline-error';
export type { InlineErrorProps } from './inline-error';

export { FieldLabel, FieldError, TextField, TextArea } from './form-controls';
export type { FieldLabelProps, FieldErrorProps, TextFieldProps, TextAreaProps } from './form-controls';

export { Select, SelectItem } from './select';
export type { SelectProps, SelectItemProps } from './select';

export { PageFrame } from './page-frame';
export type { PageFrameProps, PageFrameMaxWidth } from './page-frame';

export { PageHeader } from './page-header';
export type { PageHeaderProps } from './page-header';

export { SectionHeader } from './section-header';
export type { SectionHeaderProps } from './section-header';

export { Tabs } from './tabs';
export type {
  TabsProps,
  TabItem,
  LinkTabItem,
  ButtonTabItem,
  LinkTabsProps,
  ButtonTabsProps,
} from './tabs';

export { DataList, DataRow } from './data-list';
export type { DataListProps, DataRowProps } from './data-list';

// ConfirmDialog is the same API as AlertDialog (Radix alertdialog under it).
export { AlertDialog, AlertDialog as ConfirmDialog } from './alert-dialog';
export type { AlertDialogProps, AlertDialogProps as ConfirmDialogProps } from './alert-dialog';

// base-ds natives, available for new/idiomatic UI.
export { Badge, badgeVariants } from './badge';
export { Alert } from './alert';
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './card';
export { Label, Input, Textarea, FormField } from './form-field';
export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './dialog';
export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './table';
export { Skeleton } from './skeleton';
