
import React from "react";

interface CodeViewIconProps {
    className?: string;
    size?: number;
}

export const CodeViewIcon: React.FC<CodeViewIconProps> = ({
    className,
    size = 16,
}) => {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            <path
                d="M4.66667 5.33398L2 8.00065L4.66667 10.6673"
                stroke="currentColor"
                strokeWidth="1.12"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M11.332 5.33398L13.9987 8.00065L11.332 10.6673"
                stroke="currentColor"
                strokeWidth="1.12"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M9.33464 2.66602L6.66797 13.3327"
                stroke="currentColor"
                strokeWidth="1.12"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
};
