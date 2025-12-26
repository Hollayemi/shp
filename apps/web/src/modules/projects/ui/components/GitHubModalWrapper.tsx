import { X } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface GitHubModalWrapperProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title?: string;
    description?: string;
    children: React.ReactNode;
    className?: string;
}

export function GitHubModalWrapper({
    open,
    onOpenChange,
    title,
    description,
    children,
    className,
}: GitHubModalWrapperProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                showCloseButton={false}
                className={cn(
                    "sm:max-w-[377px] bg-prj-bg-primary border-prj-border-primary rounded-[16px] shadow-[0px_1px_13.8px_1px_rgba(18,18,18,0.1)] py-[2px] px-0",
                    className
                )}
            >

                <DialogHeader className="p-3 gap-0 border-b  border-[#0000000A] dark:border-prj-border-primary flex-row justify-between items-start">
                    <div>
                        <DialogTitle className="text-sm font-semibold text-prj-text-title dark:text-[#F5F9F7]">
                            {title}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-prj-text-secondary pt-0">
                            {description}
                        </DialogDescription>
                    </div>
                    <button
                        onClick={() => onOpenChange(false)}
                        className="rounded-[5px] opacity-70 transition-opacity hover:opacity-100 border-[1.25px] border-white [box-shadow:0px_0px_0px_0.83px_#DCDEDD,0px_1.67px_3.33px_0px_rgba(198,210,207,0.15)] w-5 h-5 flex items-center justify-center"
                    >
                        <X className="h-3 w-3" />
                        <span className="sr-only">Close</span>
                    </button>
                </DialogHeader>
                {children}
            </DialogContent>
        </Dialog>
    );
}
