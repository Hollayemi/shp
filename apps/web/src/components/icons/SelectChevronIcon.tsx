export function SelectChevronIcon({ className }: { className?: string }) {
  return (
    <div className="inline-flex items-center justify-center gap-2 rounded bg-[#F3F3EE] px-1.5 py-1 dark:bg-[#F3F3EE]">
      <div className="flex items-center justify-start gap-1">
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
        >
          <path
            d="M4.66 6.67L8 10L11.33 6.67"
            stroke="#28303F"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}
