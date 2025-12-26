import React from "react";

interface SidebarIconProps {
  className?: string;
  size?: number;
  fill?: string;
}

export const SidebarIcon: React.FC<SidebarIconProps> = ({
  className,
  size = 12,
  fill = "currentColor",
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M1 12C0.725 12 0.489611 11.9021 0.293833 11.7062C0.0979445 11.5104 0 11.275 0 11V1C0 0.725 0.0979445 0.489556 0.293833 0.293667C0.489611 0.0978888 0.725 0 1 0H11C11.275 0 11.5104 0.0978888 11.7063 0.293667C11.9021 0.489556 12 0.725 12 1V11C12 11.275 11.9021 11.5104 11.7063 11.7062C11.5104 11.9021 11.275 12 11 12H1ZM4.45 11H11V1H4.45V11Z"
        fill={fill}
      />
    </svg>
  );
};
