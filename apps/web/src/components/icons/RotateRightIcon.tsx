import React from "react";

interface RotateRightIconProps {
    className?: string;
    size?: number;
}

export const RotateRightIcon: React.FC<RotateRightIconProps> = ({
    className,
    size = 12,
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
                d="M2.25 9C2.25 12.7279 5.27208 15.75 9 15.75C12.7279 15.75 15.75 12.7279 15.75 9C15.75 5.27208 12.7279 2.25 9 2.25C6.50155 2.25 4.32014 3.60742 3.15303 5.625M3.15303 5.625V2.25M3.15303 5.625H6.46875"
                stroke="currentColor"
                strokeWidth="1.125"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
};
