import { TreeItem } from "@/types";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarRail,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarTrigger,
  SidebarProvider,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
} from "@/components/ui/sidebar";
import { ChevronRightIcon, FileIcon, FolderIcon } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface TreeViewProps {
  data: TreeItem[];
  value: string;
  onSelect: (path: string) => void;
  expandedItems?: string[];
  onExpandedChange?: (expanded: string[]) => void;
}

export const TreeView = ({
  data,
  value,
  onSelect,
  expandedItems = [],
  onExpandedChange,
}: TreeViewProps) => {
  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden">
      <SidebarProvider
        className="h-full overflow-hidden"
        style={{ minHeight: 0 }}
      >
        <Sidebar collapsible="none" className="w-full h-full overflow-hidden">
          <SidebarContent className="min-h-0 overflow-auto">
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {data.map((item, index) => (
                    <Tree
                      key={`root-${index}`}
                      item={item}
                      selectedValue={value}
                      onSelect={onSelect}
                      expandedItems={expandedItems}
                      onExpandedChange={onExpandedChange}
                    />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          {/* <SidebarRail /> */}
        </Sidebar>
      </SidebarProvider>
    </div>
  );
};

interface TreeProps {
  item: TreeItem;
  selectedValue?: string | null;
  onSelect?: (value: string) => void;
  parentPath?: string;
  expandedItems?: string[];
  onExpandedChange?: (expanded: string[]) => void;
}

const Tree = ({
  item,
  selectedValue,
  onSelect,
  parentPath,
  expandedItems = [],
  onExpandedChange,
}: TreeProps) => {
  const [name, ...items] = Array.isArray(item) ? item : [item];
  const currentPath = parentPath ? `${parentPath}/${name}` : name;

  if (!items.length) {
    // This is a file
    const isSelected = selectedValue === currentPath;
    return (
      <SidebarMenuButton
        key={currentPath}
        className="data-[active=true]:bg-transparent"
        onClick={() => onSelect?.(currentPath)}
        isActive={isSelected}
      >
        <FileIcon />
        <span className="truncate">{name}</span>
      </SidebarMenuButton>
    );
  }

  const isExpanded = expandedItems.includes(currentPath);

  const handleToggle = () => {
    if (!onExpandedChange) return;

    const newExpanded = isExpanded
      ? expandedItems.filter((path) => path !== currentPath)
      : [...expandedItems, currentPath];

    onExpandedChange(newExpanded);
  };
  return (
    <SidebarMenuItem>
      <Collapsible
        className="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90"
        open={isExpanded}
        onOpenChange={handleToggle}
      >
        <CollapsibleTrigger asChild>
          <SidebarMenuButton>
            <ChevronRightIcon className="transition-transform" />
            <FolderIcon />
            <span className="truncate">{name}</span>
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {items.map((item, index) => (
              <Tree
                key={`${currentPath}-${index}`}
                item={item}
                selectedValue={selectedValue}
                onSelect={onSelect}
                parentPath={currentPath}
                expandedItems={expandedItems}
                onExpandedChange={onExpandedChange}
              />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  );
};
