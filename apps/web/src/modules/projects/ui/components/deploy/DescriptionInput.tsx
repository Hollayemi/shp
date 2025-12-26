import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

interface DescriptionInputProps {
  description: string;
  isLoadingMetadata: boolean;
  onDescriptionChange: (value: string) => void;
  onDescriptionBlur?: () => void;
}

export function DescriptionInput({
  description,
  isLoadingMetadata,
  onDescriptionChange,
  onDescriptionBlur,
}: DescriptionInputProps) {
  return (
    <div className="rounded-lg border border-[#F2F2F2] bg-white p-1 shadow-[0px_1px_1.5px_rgba(44,54,53,0.03)] dark:border-[#2A3833] dark:bg-[#1A2421]">
      {isLoadingMetadata ? (
        <div className="min-h-[60px] w-full space-y-2 p-1">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      ) : (
        <Textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          onBlur={onDescriptionBlur}
          placeholder="Project description here"
          className="min-h-[60px] w-full resize-none border-0 bg-white p-1 text-xs leading-[16.8px] text-[#24292E] placeholder:text-[#898F8F] shadow-[0px_1px_1.5px_rgba(44,54,53,0.03)] focus-visible:ring-0 dark:bg-[#1A2421] dark:text-[#B8C9C3]"
          maxLength={150}
        />
      )}
    </div>
  );
}
