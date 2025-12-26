import React from "react";

interface CloseExpandIconProps {
    className?: string;
    size?: number;
}

export const CloseExpandIcon: React.FC<CloseExpandIconProps> = ({
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
                d="M14.6654 1.33398L8.83203 7.16732M1.33203 14.6673L7.16536 8.83398M8.83203 7.16732H12.9987M8.83203 7.16732V3.00065M7.16536 8.83398V13.0006M7.16536 8.83398H2.9987"
                stroke="currentColor"
                strokeWidth="1.25"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
};
