import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EditIcon } from "@/components/icons/EditIcon";
import Image from "next/image";

interface AppIconTitleProps {
  title: string;
  iconUrl: string | null;
  isLoadingMetadata: boolean;
  projectName?: string;
  onTitleChange: (value: string) => void;
  onTitleBlur?: () => void;
  onIconUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function AppIconTitle({
  title,
  iconUrl,
  isLoadingMetadata,
  projectName,
  onTitleChange,
  onTitleBlur,
  onIconUpload,
}: AppIconTitleProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex h-[35px] items-center rounded-lg border border-[#F2F2F2] bg-white p-1 shadow-[0px_1px_1.5px_rgba(44,54,53,0.03)] dark:border-[#2A3833] dark:bg-[#1A2421]">
        {isLoadingMetadata ? (
          <>
            <div className="flex items-center gap-2 rounded bg-[#F3F4F4] px-1.5 py-1 dark:bg-[#1A2421]">
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-3 w-3" />
            </div>
            <Skeleton className="mx-2 h-4 flex-1" />
          </>
        ) : (
          <>
            <label className="flex cursor-pointer items-center gap-2 rounded bg-[#F3F4F4] px-1.5 py-1 hover:bg-[#EAEAEA] dark:bg-[#1A2421] dark:hover:bg-[#1F2B28]">
              <input
                type="file"
                accept="image/*"
                onChange={onIconUpload}
                className="hidden"
              />
              {iconUrl ? (
                <Image
                  src={iconUrl}
                  alt="App icon"
                  width={16}
                  height={16}
                  className="h-4 w-4 rounded-full"
                  unoptimized
                />
              ) : (
                <div className="flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-[#1E9A80] to-[#17816B]">
                  <span className="text-[8px] font-semibold text-white">
                    {projectName?.charAt(0).toUpperCase() || "A"}
                  </span>
                </div>
              )}
              <EditIcon />
            </label>
            <Input
              value={title || projectName || ''}
              onChange={(e) => onTitleChange(e.target.value)}
              onBlur={onTitleBlur}
              placeholder="The Advisor - Your AI Co"
              className="h-full flex-1 border-0 bg-white px-2 text-xs text-[#24292E] capitalize shadow-[0px_1px_1.5px_rgba(44,54,53,0.03)] focus-visible:ring-0 dark:bg-[#1A2421] dark:text-[#B8C9C3]"
            />
          </>
        )}
      </div>
    </div>
  );
}
