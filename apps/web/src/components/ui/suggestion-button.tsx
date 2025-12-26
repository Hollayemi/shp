import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SuggestionButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export const SuggestionButton = React.forwardRef<
  HTMLButtonElement,
  SuggestionButtonProps
>(({ className, children, ...props }, ref) => {
  return (
    <Button
      ref={ref}
      variant="outline"
      className={cn(
        "relative bg-white dark:bg-[#FFFFFF1A] border-[0.6px] border-solid border-[#F3F3F3] dark:border-[#8D68F7] bg-clip-padding h-auto py-2 px-3 text-left justify-start rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors whitespace-normal shadow-[0px_2px_5px_0px_#676E7614] w-full items-start",
        "",
        className
      )}
      {...props}
    >
      {children}
    </Button>
  );
});

SuggestionButton.displayName = "SuggestionButton";
