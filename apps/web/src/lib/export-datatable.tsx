import { IconDownload, IconFileTypeCsv, IconFileTypeXls } from "@tabler/icons-react";
import { Table } from "@tanstack/react-table";
import { Button } from "@workspace/ui/components/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";

interface ExportDropdownProps<TData> {
    table: Table<TData>;
    filename?: string;
    excludeColumns?: string[];
}

export function ExportDropdown<TData>({
    table,
    filename = "export",
    excludeColumns = ["select", "drag", "actions"]
}: ExportDropdownProps<TData>) {

    const getExportData = (selectedOnly = false) => {
        const rows = selectedOnly
            ? table.getFilteredSelectedRowModel().rows
            : table.getFilteredRowModel().rows;

        const headers = table.getAllColumns()
            .filter(col => col.getIsVisible() && !excludeColumns.includes(col.id))
            .map(col => col.id);

        return { rows, headers };
    };

    const exportToCSV = (selectedOnly = false) => {
        const { rows, headers } = getExportData(selectedOnly);

        if (selectedOnly && rows.length === 0) {
            alert("No rows selected");
            return;
        }

        const csvContent = [
            headers.join(","),
            ...rows.map(row =>
                headers.map(header => {
                    const value = row.getValue(header);
                    return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
                }).join(",")
            )
        ].join("\n");

        downloadFile(csvContent, `${filename}-${selectedOnly ? 'selected-' : ''}${getTimestamp()}.csv`, "text/csv");
    };

    const exportToJSON = () => {
        const { rows } = getExportData(false);
        const data = rows.map(row => row.original);

        downloadFile(
            JSON.stringify(data, null, 2),
            `${filename}-${getTimestamp()}.json`,
            "application/json"
        );
    };

    const downloadFile = (content: string, fileName: string, type: string) => {
        const blob = new Blob([content], { type });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const getTimestamp = () => new Date().toISOString().split('T')[0];

    const selectedCount = table.getFilteredSelectedRowModel().rows.length;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger>
                <Button variant="outline" size="sm" className="h-9">
                    <IconDownload className="h-4 w-4 lg:mr-2" />
                    <span className="hidden lg:inline">Export</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => exportToCSV(false)}>
                    <IconFileTypeCsv className="mr-2 h-4 w-4" />
                    Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToJSON}>
                    <IconFileTypeXls className="mr-2 h-4 w-4" />
                    Export as JSON
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    onClick={() => exportToCSV(true)}
                    disabled={selectedCount === 0}
                >
                    <IconFileTypeCsv className="mr-2 h-4 w-4" />
                    Export Selected ({selectedCount})
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}