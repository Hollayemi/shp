import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type PreviewSize = "desktop" | "tablet" | "mobile";

interface PreviewSizeSelectorProps {
  selectedSize: PreviewSize;
  onSizeChange: (size: PreviewSize) => void;
  className?: string;
}

const sizeConfig = {
  desktop: {
    label: "Show desktop view",
    width: "100%",
  },
  tablet: {
    label: "Show tablet view",
    width: "768px",
  },
  mobile: {
    label: "Show mobile view",
    width: "375px",
  },
} as const;

const DevicesIcon = ({ className }: { className?: string }) => (
  <svg
    width="17"
    height="17"
    viewBox="0 0 17 17"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <rect
      x="9.83203"
      y="5.16797"
      width="5.33333"
      height="8.66667"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M13.8346 3.16797H5.16797C4.0634 3.16797 3.16797 4.0634 3.16797 5.16797V11.8346H7.83464"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M7.83203 11.832H2.83203C2.27975 11.832 1.83203 12.2797 1.83203 12.832C1.83203 13.3843 2.27975 13.832 2.83203 13.832H7.83203"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export const PreviewSizeSelector = ({
  selectedSize,
  onSizeChange,
  className,
}: PreviewSizeSelectorProps) => {
  const sizes: PreviewSize[] = ["desktop", "tablet", "mobile"];
  
  const cycleSize = () => {
    const currentIndex = sizes.indexOf(selectedSize);
    const nextIndex = (currentIndex + 1) % sizes.length;
    onSizeChange(sizes[nextIndex]);
  };

  // Get the next size that will be shown when clicked
  const getNextSize = (): PreviewSize => {
    const currentIndex = sizes.indexOf(selectedSize);
    const nextIndex = (currentIndex + 1) % sizes.length;
    return sizes[nextIndex];
  };

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <button
            onClick={cycleSize}
            className={cn(
              "flex items-center gap-2 h-[28px] px-3 rounded-md border border-prj-border-primary bg-prj-bg-primary hover:bg-prj-bg-secondary transition-colors",
              className
            )}
          >
            <DevicesIcon className="text-prj-text-heading dark:text-[#B8C9C3]" />
            <span className="text-sm text-prj-text-secondary dark:text-[#B8C9C3]">/</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {sizeConfig[getNextSize()].label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const getPreviewWidth = (size: PreviewSize): string => {
  return sizeConfig[size].width;
};
