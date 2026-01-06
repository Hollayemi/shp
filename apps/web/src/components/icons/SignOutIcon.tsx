import React from "react";

interface SignOutIconProps {
    className?: string;
    size?: number;
}

export const SignOutIcon: React.FC<SignOutIconProps> = ({
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
                d="M13.332 9.33398L14.194 8.47206C14.4543 8.21171 14.4543 7.7896 14.194 7.52925L13.332 6.66732"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M13.9987 7.99935H8.66536M3.9987 13.3327C2.52594 13.3327 1.33203 12.1388 1.33203 10.666V5.33268C1.33203 3.85992 2.52594 2.66602 3.9987 2.66602M3.9987 13.3327C5.47146 13.3327 6.66536 12.1388 6.66536 10.666V5.33268C6.66536 3.85992 5.47146 2.66602 3.9987 2.66602M3.9987 13.3327H9.33203C10.8048 13.3327 11.9987 12.1388 11.9987 10.666M3.9987 2.66602H9.33203C10.8048 2.66602 11.9987 3.85992 11.9987 5.33268"
                stroke="currentColor"
                strokeLinecap="round"
            />
        </svg>
    );
};
