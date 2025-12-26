
import React from "react";

interface PreviewViewIconProps {
    className?: string;
    size?: number;
}

export const PreviewViewIcon: React.FC<PreviewViewIconProps> = ({
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
                d="M6.66797 7.99935C6.66797 8.35297 6.80844 8.69211 7.05849 8.94216C7.30854 9.19221 7.64768 9.33268 8.0013 9.33268C8.35492 9.33268 8.69406 9.19221 8.94411 8.94216C9.19416 8.69211 9.33464 8.35297 9.33464 7.99935C9.33464 7.64573 9.19416 7.30659 8.94411 7.05654C8.69406 6.80649 8.35492 6.66602 8.0013 6.66602C7.64768 6.66602 7.30854 6.80649 7.05849 7.05654C6.80844 7.30659 6.66797 7.64573 6.66797 7.99935Z"
                stroke="currentColor"
                strokeWidth="1.12"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M7.40667 11.972C5.26733 11.7673 3.46667 10.4433 2 8C3.6 5.33333 5.6 4 8 4C10.4 4 12.4 5.33333 14 8C13.86 8.23467 13.7153 8.45867 13.5687 8.672"
                stroke="currentColor"
                strokeWidth="1.12"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M13.332 14.0007L14.6654 12.6673L13.332 11.334"
                stroke="currentColor"
                strokeWidth="1.12"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M11.3333 11.334L10 12.6673L11.3333 14.0007"
                stroke="currentColor"
                strokeWidth="1.12"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
};
