import React from "react";

interface SunLightIconProps {
    className?: string;
    size?: number;
}

export const SunLightIcon: React.FC<SunLightIconProps> = ({
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
                d="M7.9987 1.33398V2.00065M7.9987 14.0007V14.6673M12.7127 3.28661L12.2413 3.75802M3.75606 12.2433L3.28466 12.7147M14.6654 8.00065H13.9987M1.9987 8.00065H1.33203M12.7127 12.7147L12.2413 12.2433M3.75606 3.75802L3.28466 3.28661M11.9987 8.00065C11.9987 10.2098 10.2078 12.0007 7.9987 12.0007C5.78956 12.0007 3.9987 10.2098 3.9987 8.00065C3.9987 5.79151 5.78956 4.00065 7.9987 4.00065C10.2078 4.00065 11.9987 5.79151 11.9987 8.00065Z"
                stroke="currentColor"
                strokeLinecap="round"
            />
        </svg>
    );
};
