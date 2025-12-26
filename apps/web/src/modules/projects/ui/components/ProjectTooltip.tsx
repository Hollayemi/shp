import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

interface ProjectTooltipProps {
    children: React.ReactNode;
    tooltip: string;
    onClick?: () => void;
    className?: string;
    variant?: "ghost" | "default" | "outline" | "secondary" | "destructive" | "link";
    size?: "default" | "sm" | "lg" | "icon";
    ariaLabel?: string;
}

export function ProjectTooltip({
    children,
    tooltip,
    onClick,
    className = "h-7 w-7 dark:text-[#B8C9C3] hover:bg-prj-tooltip-hover-bg hover:border hover:border-prj-tooltip-hover-border transition-colors duration-200",
    variant = "ghost",
    size = "icon",
    ariaLabel,
}: ProjectTooltipProps) {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        type="button"
                        variant={variant}
                        size={size}
                        className={className}
                        onClick={onClick}
                        aria-label={ariaLabel || tooltip}
                    >
                        {children}
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{tooltip}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
