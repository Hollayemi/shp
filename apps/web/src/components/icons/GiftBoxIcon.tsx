import React from "react";

interface GiftBoxIconProps {
    className?: string;
    size?: number;
}

export const GiftBoxIcon: React.FC<GiftBoxIconProps> = ({
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
            <g clipPath="url(#clip0_51_9563)">
                <path
                    d="M2.66536 7.33398H13.332M2.66536 7.33398C1.92899 7.33398 1.33203 6.73703 1.33203 6.00065V5.33398C1.33203 4.5976 1.92899 4.00065 2.66536 4.00065H13.332C14.0684 4.00065 14.6654 4.5976 14.6654 5.33398V6.00065C14.6654 6.73703 14.0684 7.33398 13.332 7.33398M2.66536 7.33398L2.66536 13.334C2.66536 14.0704 3.26232 14.6673 3.9987 14.6673H11.9987C12.7351 14.6673 13.332 14.0704 13.332 13.334V7.33398M7.9987 4.00065H10.6654C11.4017 4.00065 11.9987 3.4037 11.9987 2.66732C11.9987 1.93094 11.4017 1.33398 10.6654 1.33398C9.19261 1.33398 7.9987 2.52789 7.9987 4.00065ZM7.9987 4.00065H5.33203C4.59565 4.00065 3.9987 3.4037 3.9987 2.66732C3.9987 1.93094 4.59565 1.33398 5.33203 1.33398C6.80479 1.33398 7.9987 2.52789 7.9987 4.00065ZM7.9987 4.00065V14.6673"
                    stroke="currentColor"
                    strokeLinecap="round"
                />
            </g>
            <defs>
                <clipPath id="clip0_51_9563">
                    <rect width="16" height="16" fill="white" />
                </clipPath>
            </defs>
        </svg>
    );
};
