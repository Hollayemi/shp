import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";

interface CollapsibleSectionProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}

export function CollapsibleSection({
  isOpen,
  onOpenChange,
  title,
  children,
  className = "",
  action,
}: CollapsibleSectionProps) {
  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange}>
      <div className={`px-2 ${className}`}>
        <div className="flex flex-col gap-1 rounded-xl py-2">
          <div className="flex w-full items-center gap-2">
            <CollapsibleTrigger className="group flex flex-1 items-center justify-between">
              <div className="text-xs leading-[18px] font-medium text-[#14201F] dark:text-[#F5F9F7]">
                {title}
              </div>
            </CollapsibleTrigger>
            {action && (
              <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
                {action}
              </div>
            )}
            <CollapsibleTrigger className="flex-shrink-0">
              {isOpen ? (
                <ChevronDownIcon className="h-4 w-4 text-[#666E6D] transition-transform dark:text-[#B8C9C3]" />
              ) : (
                <ChevronRightIcon className="h-4 w-4 text-[#666E6D] transition-transform dark:text-[#B8C9C3]" />
              )}
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <div className="flex flex-col gap-1">{children}</div>
          </CollapsibleContent>
        </div>
      </div>
    </Collapsible>
  );
}
