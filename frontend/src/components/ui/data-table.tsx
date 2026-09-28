import React from "react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  header: React.ReactNode;
  accessorKey?: keyof T;
  cell?: (item: T) => React.ReactNode;
  className?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  emptyState?: React.ReactNode;
  isLoading?: boolean;
  onRowClick?: (item: T) => void;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  emptyState,
  isLoading,
  onRowClick,
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="w-full space-y-2 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-11 w-full bg-parchment animate-pulse rounded-[10px]" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-ink-muted-48 bg-canvas border border-hairline rounded-[14px]">
        {emptyState || "No records found."}
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto rounded-[14px] border border-hairline bg-canvas">
      <table className="w-full text-left border-collapse text-sm">
        <thead>
          <tr className="border-b border-divider-soft bg-parchment text-xs font-semibold text-ink-muted-48 uppercase tracking-wider">
            {columns.map((col, idx) => (
              <th key={idx} className={cn("px-4 py-3 font-mono", col.className)}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-divider-soft">
          {data.map((item) => (
            <tr
              key={keyExtractor(item)}
              onClick={() => onRowClick && onRowClick(item)}
              className={cn(
                "transition-colors duration-150 hover:bg-parchment/70",
                onRowClick && "cursor-pointer"
              )}
            >
              {columns.map((col, idx) => (
                <td key={idx} className={cn("px-4 py-3.5 text-ink align-middle font-normal", col.className)}>
                  {col.cell
                    ? col.cell(item)
                    : col.accessorKey
                    ? String(item[col.accessorKey] ?? "")
                    : null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;
