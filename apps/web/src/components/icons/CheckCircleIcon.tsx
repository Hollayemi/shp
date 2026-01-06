
interface CheckCircleIconProps {
  className?: string;
  size?: number;
}

export function CheckCircleIcon({ className, size = 12 }: CheckCircleIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      className={className}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M5.83333 11.6667C9.05499 11.6667 11.6667 9.05499 11.6667 5.83333C11.6667 2.61167 9.05499 0 5.83333 0C2.61167 0 0 2.61167 0 5.83333C0 9.05499 2.61167 11.6667 5.83333 11.6667ZM8.51201 4.35195C8.66036 4.16123 8.626 3.88635 8.43527 3.73801C8.24454 3.58967 7.96967 3.62403 7.82133 3.81475L5.48391 6.82001C5.43193 6.88683 5.33417 6.8955 5.27124 6.83887L3.79268 5.50816C3.61308 5.34652 3.33645 5.36108 3.17481 5.54068C3.01317 5.72028 3.02773 5.99691 3.20733 6.15854L4.6859 7.48925C5.12639 7.88569 5.81076 7.82499 6.17459 7.3572L8.51201 4.35195Z"
        fill="#1E9A80"
      />
    </svg>
  );
}