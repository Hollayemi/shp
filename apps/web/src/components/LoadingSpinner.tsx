"use client";
import { cn } from "@/lib/utils";
import { LoaderCircle } from "lucide-react";

interface LoadingSpinnerProps {
  className?: string;
}

const LoadingSpinner = ({ className }: LoadingSpinnerProps) => {
  return (
    <div className="flex justify-center items-center h-screen">
      <LoaderCircle className={cn("w-4 h-4 animate-spin", className)} />
    </div>
  );
};

export default LoadingSpinner;