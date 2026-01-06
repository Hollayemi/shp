import React from "react";

interface SparklesIconProps {
    className?: string;
    width?: number;
    height?: number;
    stroke?: string;
}

export const SparklesIcon: React.FC<SparklesIconProps> = ({
    className,
    width = 18,
    height = 19,
    stroke = "#6E6AF6",
}) => {
    return (
        <svg
            width={width}
            height={height}
            viewBox="0 0 18 19"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            <path
                d="M7.3599 12.4279L6.75 14.5625L6.1401 12.4279C5.81976 11.3067 4.94334 10.4302 3.82214 10.1099L1.6875 9.5L3.82214 8.8901C4.94334 8.56976 5.81976 7.69334 6.1401 6.57214L6.75 4.4375L7.3599 6.57214C7.68024 7.69334 8.55666 8.56976 9.67786 8.8901L11.8125 9.5L9.67786 10.1099C8.55665 10.4302 7.68024 11.3067 7.3599 12.4279Z"
                stroke={stroke}
                strokeWidth="1.125"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M13.6941 7.0359L13.5 7.8125L13.3058 7.0359C13.0791 6.12899 12.371 5.42088 11.4641 5.19415L10.6875 5L11.4641 4.80585C12.371 4.57912 13.0791 3.87101 13.3058 2.9641L13.5 2.1875L13.6941 2.9641C13.9209 3.87101 14.629 4.57912 15.5359 4.80585L16.3125 5L15.5359 5.19415C14.629 5.42088 13.9209 6.12899 13.6941 7.0359Z"
                stroke={stroke}
                strokeWidth="1.125"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M12.6707 15.9255L12.375 16.8125L12.0793 15.9255C11.9114 15.4216 11.5159 15.0261 11.012 14.8582L10.125 14.5625L11.012 14.2668C11.5159 14.0989 11.9114 13.7034 12.0793 13.1995L12.375 12.3125L12.6707 13.1995C12.8386 13.7034 13.2341 14.0989 13.738 14.2668L14.625 14.5625L13.738 14.8582C13.2341 15.0261 12.8386 15.4216 12.6707 15.9255Z"
                stroke={stroke}
                strokeWidth="1.125"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
};
