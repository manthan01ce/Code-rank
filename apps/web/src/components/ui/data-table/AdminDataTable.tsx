"use client";

import React, { useState } from "react";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { TableSkeleton } from "./TableSkeleton";
import { EmptyState } from "./EmptyState";
import { DataTablePagination } from "./DataTablePagination";
import { cn } from "@/lib/utils";

interface ServerPaginationConfig {
  pageCursor: string | null;
  nextCursor: string | null;
  onFirstPage: () => void;
  onNextPage: (cursor: string) => void;
  itemCount: number;
  loading?: boolean;
}

interface AdminDataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  loading?: boolean;
  error?: string | null;
  serverPagination?: ServerPaginationConfig;
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}

export function AdminDataTable<TData, TValue>({
  columns,
  data,
  loading = false,
  error = null,
  serverPagination,
  pageSize = 10,
  emptyTitle = "No records found",
  emptyDescription = "There are currently no items to display matching your criteria.",
  className,
}: AdminDataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  // When serverPagination is present, TanStack client pagination is bypassed for data slice
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    ...(serverPagination ? {} : { getPaginationRowModel: getPaginationRowModel() }),
    initialState: {
      pagination: {
        pageSize,
      },
    },
  });

  return (
    <div className={cn("w-full bg-white border border-[#e2e8f0] rounded-[13px] shadow-xs overflow-hidden", className)}>
      {error && (
        <div className="p-3 bg-red-50 border-b border-red-200 text-xs text-red-700 flex items-center justify-between">
          <span>{error}</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-[#edf0f5] bg-[#f8fafc]">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    scope="col"
                    className="py-3 px-4 text-[10px] uppercase font-bold tracking-wider text-[#64748b] whitespace-nowrap"
                    style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>

          <tbody className="divide-y divide-[#edf0f5]">
            {loading && data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-0">
                  <TableSkeleton columns={columns.length} rows={6} />
                </td>
              </tr>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    "hover:bg-[#fafbfe] transition-colors duration-150",
                    loading && "opacity-60 pointer-events-none"
                  )}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="py-3 px-4 text-[#334155] leading-relaxed align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="p-0">
                  <EmptyState title={emptyTitle} description={emptyDescription} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!loading && (data.length > 0 || serverPagination) && (
        <DataTablePagination
          table={serverPagination ? undefined : table}
          serverPagination={serverPagination}
        />
      )}
    </div>
  );
}
