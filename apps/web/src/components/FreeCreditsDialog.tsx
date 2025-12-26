import React from "react";
import { Share2, CheckCircle, Linkedin, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface FreeCreditsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
}

const requirements = [
  "Tag @shipper_now",
  "Write a 200+ character description of your project’s purpose and features.",
  "Have 100+ followers.",
  "Add visuals like screenshots or demo videos.",
  "Optional: Include project links, in a subsequent reply.",
  "Reach out to support with a link to your post for the bonus credits! ",
];

const shareOptions = [
  {
    icon: Linkedin,
    label: "Share on LinkedIn",
    action: () => {
      const text = "Just built something amazing with Shipper.now! 🚀";
      const url = `https://www.linkedin.com/sharing/share-offsite/?text=${encodeURIComponent(text)}`;
      window.open(url, "_blank", "noopener,noreferrer");
    },
  },
  {
    icon: X,
    label: "Share on X (Twitter)",
    action: () => {
      const text = "Just built something amazing with @shipper_now! 🚀";
      const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
      window.open(url, "_blank", "noopener,noreferrer");
    },
  },
  // { icon: Link2, label: "Copy Share Link", action: () => console.log('Copy link') },
  // { icon: Users, label: "Invite Collaborators", action: () => console.log('Invite team') }
];

const FreeCreditsDialog = ({
  open,
  onOpenChange,
  title = "Share Your Work",
  description = "Ready to showcase your project to the world? Share your work and unlock 20 bonus credits to fuel your next creative endeavor.",
}: FreeCreditsDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={true}>
      <DialogContent
        className="sm:max-w-lg"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="text-primary h-5 w-5" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Description */}
          <div className="space-y-3">
            <p className="text-muted-foreground leading-relaxed">
              {description}
            </p>
          </div>

          {/* Requirements */}
          <div className="bg-muted/50 rounded-lg border p-4">
            <h3 className="mb-3 flex items-center gap-2 font-medium">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Publishing Requirements
            </h3>
            <div className="text-muted-foreground space-y-2 text-sm">
              <p>
                To ensure quality content, please make sure you meet these
                criteria:
              </p>
              <ul className="ml-4 space-y-1.5">
                {requirements.map((requirement, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="bg-muted-foreground mt-2 h-1 w-1 flex-shrink-0 rounded-full"></span>
                    <span>{requirement}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Share Options */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2 space-y-2 sm:grid-cols-2">
              {shareOptions.map((option, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="h-12 w-full justify-start gap-3 p-3"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    option.action();
                  }}
                  autoFocus={false}
                >
                  <option.icon className="h-5 w-5" />
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FreeCreditsDialog;
