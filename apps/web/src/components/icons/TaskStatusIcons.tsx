interface TaskIconProps {
    className?: string;
}

export const TaskInProgressIcon = ({ className }: TaskIconProps) => (
    <div className={`w-4 h-4 rounded-full bg-[#78270D] flex items-center justify-center ${className || ''}`}>
        <svg width="10" height="9" viewBox="0 0 10 9" fill="none" xmlns="http://www.w3.org/2000/svg" className="animate-spin">
            <g clipPath="url(#clip0_137_9917)">
                <path d="M4.98828 2.32578V1.23828" stroke="white" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M6.52734 2.95906L7.30672 2.17969" stroke="white" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7.16406 4.5H8.25156" stroke="white" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M6.52734 6.03906L7.30672 6.81844" stroke="white" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4.98828 6.67578V7.76328" stroke="white" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3.44734 6.03906L2.66797 6.81844" stroke="white" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2.81406 4.5H1.72656" stroke="white" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3.44734 2.95906L2.66797 2.17969" stroke="white" strokeLinecap="round" strokeLinejoin="round" />
            </g>
            <defs>
                <clipPath id="clip0_137_9917">
                    <rect width="8.7" height="8.7" fill="white" transform="translate(0.636719 0.148438)" />
                </clipPath>
            </defs>
        </svg>
    </div>
);

export const TaskCompleteIcon = ({ className }: TaskIconProps) => (
    <div className={`w-4 h-4 rounded-full bg-[#D4EDE6] flex items-center justify-center ${className || ''}`}>
        <svg width="8" height="5" viewBox="0 0 8 5" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1.45312 2.86541L2.73546 3.89128C3.0363 4.13195 3.47263 4.09626 3.73036 3.8099L6.54403 0.683594" stroke="#1E9A80" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    </div>
);

export const TaskErrorIcon = ({ className }: TaskIconProps) => (
    <div className={`w-4 h-4 rounded-full bg-red-500 flex items-center justify-center ${className || ''}`}>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M7.5 2.5L2.5 7.5M2.5 2.5L7.5 7.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    </div>
);
