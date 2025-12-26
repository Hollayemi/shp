"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Settings } from "./Settings";
import { X } from "lucide-react";

interface SettingsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="h-[82vh] overflow-scroll flex flex-col justify-start bg-prj-bg-primary !max-w-[981px] p-0 gap-0" showCloseButton={false}>
                <DialogHeader className="p-4 gap-0 border-b border-[#0000000A] dark:border-prj-border-primary flex-row justify-between items-start mb-0 h-fit">
                    <div>
                        <DialogTitle className="text-sm font-semibold text-[#14201F] dark:text-[#F5F9F7]">
                            Settings
                        </DialogTitle>
                    </div>
                    <button
                        onClick={() => onOpenChange(false)}
                        className="rounded-[5px] opacity-70 transition-opacity hover:opacity-100 border-[1.25px] border-white [box-shadow:0px_0px_0px_0.83px_#DCDEDD,0px_1.67px_3.33px_0px_rgba(198,210,207,0.15)] w-5 h-5 flex items-center justify-center"
                    >
                        <X className="h-3 w-3" />
                        <span className="sr-only">Close</span>
                    </button>
                </DialogHeader>
                <Settings onClose={() => onOpenChange(false)} />
            </DialogContent>
        </Dialog>
    );
}
