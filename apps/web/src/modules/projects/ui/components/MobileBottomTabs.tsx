import { MessageSquare } from "lucide-react";
import { AdvisorLogo } from "@/components/AdvisorLogo";
import { PreviewViewIcon } from "@/components/icons/PreviewViewIcon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type ReactNode } from "react";

type TabValue = "preview" | "assistant" | "chat";

interface MobileBottomTabsProps {
    activeTab: TabValue;
    onTabChange: (tab: TabValue) => void;
}

interface TabButtonProps {
    value: TabValue;
    activeTab: TabValue;
    icon: ReactNode;
    label: string;
    onClick: () => void;
}

const TabButton = ({ value, activeTab, icon, label, onClick }: TabButtonProps) => {
    const isActive = activeTab === value;

    return (
        <Button
            variant="ghost"
            onClick={onClick}
            className={cn(
                "flex items-center justify-center gap-1 xs:gap-2 h-8 px-3 xs:h-11 xs:px-6 rounded-full flex-1 min-w-fit",
                "transition-all duration-200 ease-out",
                isActive
                    ? "bg-white shadow-sm"
                    : "hover:bg-white/50"
            )}
        >
            <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                {icon}
            </div>
            <span className={cn(
                "text-sm font-medium transition-colors duration-200 whitespace-nowrap text-[14px]",
                isActive ? "text-prj-text-primary dark:text-black" : "text-prj-text-primary/60"
            )}>
                {label}
            </span>
        </Button>
    );
};

export const MobileBottomTabs = ({
    activeTab,
    onTabChange,
}: MobileBottomTabsProps) => {
    const tabs = [
        {
            value: "chat" as const,
            icon: <MessageSquare size={16} />,
            label: "Chat",
        },
        {
            value: "assistant" as const,
            icon: <AdvisorLogo className="w-4 h-4" />,
            label: "Advisor",
        },
        {
            value: "preview" as const,
            icon: <PreviewViewIcon size={16} />,
            label: "Preview",
        },
    ];

    return (
        <div className="md:hidden z-50 pb-2 px-4">
            <div className="bg-prj-bg-secondary/80 backdrop-blur-md rounded-full p-1 xs:p-1.5 shadow-lg border border-prj-border-primary/20 overflow-hidden">
                <div className="flex items-center gap-0.5 xs:gap-1 overflow-x-auto scrollbar-hide">
                    {tabs.map((tab) => (
                        <TabButton
                            key={tab.value}
                            value={tab.value}
                            activeTab={activeTab}
                            icon={tab.icon}
                            label={tab.label}
                            onClick={() => onTabChange(tab.value)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};
