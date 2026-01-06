import React from "react";

interface CaretUpMiniIconProps {
    className?: string;
    stroke?: string;
    strokeWidth?: number;
}

export const CaretUpMiniIcon: React.FC<CaretUpMiniIconProps> = ({
    className,
    stroke = "currentColor",
    strokeWidth = 1.25,
}) => {
    return (
        <svg
            width="10"
            height="5"
            viewBox="0 0 10 5"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            <path
                d="M9.16699 4.16675L5.00033 0.833415L0.833659 4.16675"
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
};
