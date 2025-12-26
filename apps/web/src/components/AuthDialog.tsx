"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import Link from "next/link";

interface AuthDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectDescription?: string;
}

export function AuthDialog({ isOpen, onClose, projectDescription }: AuthDialogProps) {
  // Construct proper absolute callback URLs to preserve the project description
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : "/"
  const callbackUrl = projectDescription
    ? `${baseUrl}?name=${encodeURIComponent(projectDescription)}`
    : baseUrl;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-8 border-0 shadow-2xl">
        <DialogHeader className="text-center space-y-6">
          <div className="space-y-3">
            <DialogTitle className="text-2xl font-semibold tracking-tight">
              Save your progress to continue
            </DialogTitle>
            <DialogDescription className="text-muted-foreground leading-relaxed px-2">
            You need an account to keep building. Create one free in seconds and pick up right where you left off.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="space-y-3 mt-8">
          <Button
            variant="outline"
            size="lg"
            className="w-full h-12 font-medium border-border hover:bg-accent hover:text-accent-foreground transition-colors"
            asChild
          >
            <Link href={`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`}>
              Log in
            </Link>
          </Button>

          <Button
            size="lg"
            className="w-full h-12 font-medium bg-primary hover:bg-primary/90 transition-colors"
            asChild
          >
            <Link href={`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`}>
              Sign up
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
