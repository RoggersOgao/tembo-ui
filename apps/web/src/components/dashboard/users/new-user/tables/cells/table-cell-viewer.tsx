import { Button } from "@workspace/ui/components/button";
import type { Branch } from "@/types/branch/branch-types";
import { BranchDetailDrawer } from "../drawers/branch-details-drawer";

interface TableCellViewerProps {
    item: Branch;
}

export function TableCellViewer({ item }: TableCellViewerProps) {
    return (
        <BranchDetailDrawer item={item}>
            <Button variant="link" className="text-foreground w-fit px-0 text-left">
                {item.name}
            </Button>
        </BranchDetailDrawer>
    );
}