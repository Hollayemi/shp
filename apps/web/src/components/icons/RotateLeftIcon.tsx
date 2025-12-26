import React from "react";

interface RotateLeftIconProps {
    className?: string;
    size?: number;
    fill?: string;
}

export const RotateLeftIcon: React.FC<RotateLeftIconProps> = ({
    className,
    size = 16,
    fill = "currentColor",
}) => {
    return (
        
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1.25 8C1.25 11.7279 4.27208 14.75 8 14.75C11.7279 14.75 14.75 11.7279 14.75 8C14.75 4.27208 11.7279 1.25 8 1.25C5.50155 1.25 3.32014 2.60742 2.15303 4.625M2.15303 4.625V1.25M2.15303 4.625H5.46875" stroke="#28303F" strokeWidth="1.125" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
};
