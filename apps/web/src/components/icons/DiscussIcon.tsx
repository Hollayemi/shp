import React from "react";

interface DiscussIconProps {
  className?: string;
  width?: number;
  height?: number;
  stroke?: string;
}

export const DiscussIcon: React.FC<DiscussIconProps> = ({
  className,
  width = 16,
  height = 16,
  stroke = "currentColor",
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox="0 0 16 16"
      fill="none"
      className={className}
    >
      <path
        d="M5.33301 6H10.6663"
        stroke={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.33301 8.66699H9.33301"
        stroke={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 2.66699C12.5304 2.66699 13.0391 2.87771 13.4142 3.25278C13.7893 3.62785 14 4.13656 14 4.66699V10.0003C14 10.5308 13.7893 11.0395 13.4142 11.4145C13.0391 11.7896 12.5304 12.0003 12 12.0003H8.66667L5.33333 14.0003V12.0003H4C3.46957 12.0003 2.96086 11.7896 2.58579 11.4145C2.21071 11.0395 2 10.5308 2 10.0003V4.66699C2 4.13656 2.21071 3.62785 2.58579 3.25278C2.96086 2.87771 3.46957 2.66699 4 2.66699H12Z"
        stroke={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
