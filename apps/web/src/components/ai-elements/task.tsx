'use client';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { ComponentProps } from 'react';
import { CaretUpMiniIcon } from '@/components/icons/CaretUpMiniIcon';
import { ShimmeringText } from '@/components/ui/shadcn-io/shimmering-text';

export type TaskItemFileProps = ComponentProps<'div'>;

export const TaskItemFile = ({
  children,
  className,
  ...props
}: TaskItemFileProps) => (
  <div
    className={cn(
      'inline-flex items-center gap-1 rounded-md border bg-secondary px-1.5 py-0.5 text-foreground text-xs',
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export type TaskItemProps = ComponentProps<'div'> & {
  isRunning?: boolean;
};

export const TaskItem = ({ children, className, isRunning, ...props }: TaskItemProps) => (
  <div 
    className={cn(
      'text-muted-foreground text-sm px-2 py-2 rounded-lg',
      isRunning && 'bg-[#FDF2C3] dark:bg-[#3F3A2C]',
      className
    )} 
    {...props}
  >
    {children}
  </div>
);

export type TaskProps = ComponentProps<typeof Collapsible>;

export const Task = ({
  defaultOpen = true,
  className,
  ...props
}: TaskProps) => (
  <Collapsible
    className={cn(
      'data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 data-[state=closed]:animate-out data-[state=open]:animate-in border-none overflow-hidden rounded-lg',
      '[box-shadow:0px_2px_5px_0px_#676E7614,0px_1px_1px_0px_#0000001F]',
      className
    )}
    defaultOpen={defaultOpen}
    {...props}
  />
);

export type TaskTriggerProps = ComponentProps<typeof CollapsibleTrigger> & {
  title: string;
  loading?: boolean;
  badge?: React.ReactNode;
};

export const TaskTrigger = ({
  children,
  className,
  title,
  loading,
  badge,
  ...props
}: TaskTriggerProps) => (
  <CollapsibleTrigger asChild className={cn('group text-sm px-3 py-[10px]', className)} {...props}>
    {children ?? (
      <div className="flex cursor-pointer justify-between items-center gap-2 bg-prj-bg-secondary text-muted-foreground dark:text-[#F5F9F7] hover:text-foreground rounded-t-lg">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {loading ? (
            <ShimmeringText
              text={title}
              duration={1}
              shimmeringColor="rgb(156, 163, 175)"
              className="text-sm font-medium text-prj-text-primary"
            />
          ) : (
            <p className="text-sm font-medium text-prj-text-primary truncate min-w-0 max-w-[80%]">{title}</p>
          )}
          {badge}
        </div>
        <CaretUpMiniIcon className="h-[5px] w-[10px] transition-transform group-data-[state=open]:rotate-180 flex-shrink-0" />
      </div>
    )}
  </CollapsibleTrigger>
);

export type TaskContentProps = ComponentProps<typeof CollapsibleContent>;

export const TaskContent = ({
  children,
  className,
  ...props
}: TaskContentProps) => (
  <CollapsibleContent
    className={cn(
      'bg-white dark:bg-[#1A2421] data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-popover-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in',
      className
    )}
    {...props}
  >
    <div className="space-y-[10px] border-muted text-[#000000] dark:text-[#FFFFFF]">
      {children}
    </div>
  </CollapsibleContent>
);
