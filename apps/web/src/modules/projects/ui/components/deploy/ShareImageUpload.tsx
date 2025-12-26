import { Skeleton } from "@/components/ui/skeleton";
import { UploadIcon } from "@/components/icons/UploadIcon";
import { XCircleIcon } from "lucide-react";
import Image from "next/image";

interface ShareImageUploadProps {
  shareImage: string | null;
  isLoadingMetadata: boolean;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImageRemove: () => void;
}

export function ShareImageUpload({
  shareImage,
  isLoadingMetadata,
  onImageUpload,
  onImageRemove,
}: ShareImageUploadProps) {
  return (
    <div className="flex flex-col gap-1">
      {isLoadingMetadata ? (
        <Skeleton className="aspect-[1200/630] rounded-xl" />
      ) : shareImage ? (
        <div className="relative overflow-hidden rounded-xl border border-[#DCDEDE] dark:border-[#26263D]">
          <Image
            src={shareImage}
            alt="Share preview"
            width={1200}
            height={630}
            className="h-auto w-full max-h-[250px] object-contain"
            unoptimized
          />
          <button
            onClick={onImageRemove}
            className="absolute top-2 right-2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70"
          >
            <XCircleIcon className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-dashed border-[#DCDEDE] bg-[#F3F3EE] px-3 py-6 shadow-[0px_1px_1.5px_rgba(44,54,53,0.03)] transition-colors hover:bg-[#EAEAEA] dark:border-[#26263D] dark:bg-[#1A2421] dark:hover:bg-[#1F2B28]">
          <input
            type="file"
            accept="image/*"
            onChange={onImageUpload}
            className="hidden"
          />
          <div className="rounded-[10.5px] border-[0.75px] border-[#E7E9E9] bg-gradient-to-b from-[#F9FAFA] to-[#F3F4F4] p-1.5 shadow-[0px_0px_0px_1.5px_white_inset] dark:border-[#26263D] dark:from-[#1F2B28] dark:to-[#1A2421]">
            <div className="rounded-md border-t border-white bg-gradient-to-b from-[#FCFCFC] to-[#FAFAFA] p-2.25 shadow-[0px_0.75px_1.5px_rgba(0,0,0,0.10)] dark:border-[#2C3836] dark:from-[#26263D] dark:to-[#1F2B28]">
              <UploadIcon />
            </div>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <div className="text-xs leading-[18px] font-medium text-[#14201F] dark:text-[#F5F9F7]">
              Upload Share Image
            </div>
            <div className="text-center text-xs leading-[18px] font-normal text-[#666E6D] dark:text-[#B8C9C3]">
              Recommended: 1200×630px • Max 2MB
            </div>
          </div>
        </label>
      )}
    </div>
  );
}
