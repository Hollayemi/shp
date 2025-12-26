import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { UIMessage } from "ai";
import type { ComponentProps, HTMLAttributes } from "react";

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: UIMessage["role"];
  isFirstAssistantResponse?: boolean;
};

export const Message = ({
  className,
  from,
  isFirstAssistantResponse,
  ...props
}: MessageProps) => (
  <div
    className={cn(
      "group flex w-full items-end justify-end gap-2",
      from === "user" ? "is-user" : "is-assistant flex-row-reverse justify-end",
      from === "assistant" && isFirstAssistantResponse && "is-first-assistant",
      from === "user"
        ? "[&>div]:max-w-[80%]"
        : "[&>div]:max-w-[100%]",
      className
    )}
    {...props}
  />
);

export type MessageContentProps = HTMLAttributes<HTMLDivElement>;
export const MessageContent = ({
  children,
  className,
  ...props
}: MessageContentProps) => (
  <div className="relative">
    <div
      className={cn(
        "relative flex flex-col gap-2 overflow-hidden rounded-xl p-3 text-foreground text-sm",
        "group-[.is-user]:bg-prj-message-user-bg group-[.is-user]:text-prj-message-user-text",
        "group-[.is-assistant]:py-0 group-[.is-assistant]:px-3 group-[.is-assistant]:bg-transparent group-[.is-assistant]:transparent group-[.is-assistant]:text-prj-message-assistant-text",
        "group-[.is-first-assistant]:py-3",
        className
      )}
      {...props}
    >
      {children}
    </div>
    {/* <svg
      width="16"
      height="16"
      className="absolute -top-[6px] right-0 hidden group-[.is-user]:block text-primary"
      fill="currentColor"
    >
      <path d="M0 6.19355C8 6.19355 12 4.12903 16 0C16 6.70968 16 13.5 10 16L0 6.19355Z"></path>
    </svg>
    <svg
      width="16"
      height="16"
      className="absolute -top-[6px] left-0 hidden group-[.is-assistant]:block text-gray-100 group-[.is-assistant]:dark:text-gray-800"
      fill="currentColor"
    >
      <path d="M16 6.19355C8 6.19355 4 4.12903 0 6.99382e-07C0 6.70968 0 13.5 6 16L16 6.19355Z"></path>
    </svg> */}
  </div>
);

export type MessageAvatarProps = ComponentProps<typeof Avatar> & {
  src: string;
  name?: string;
};

export const MessageAvatar = ({
  src,
  name,
  className,
  ...props
}: MessageAvatarProps) => (
  <Avatar
    className={cn("size-8 ring ring-1 ring-border", className)}
    {...props}
  >
    <AvatarImage alt="" className="mt-0 mb-0" src={src} />
    <AvatarFallback>{name?.slice(0, 2) || "ME"}</AvatarFallback>
  </Avatar>
);
