"use client";

import React from "react";
import { type Table } from "@tanstack/react-table";
import { IconChevronLeft, IconChevronRight, IconChevronsLeft } from "@tabler/icons-react";

interface ServerPaginationProps {
  pageCursor: string | null;
  nextCursor: string | null;
  onFirstPage: () => void;
  onNextPage: (cursor: string) => void;
  itemCount: number;
  loading?: boolean;
}

interface DataTablePaginationProps<TData> {
  table?: Table<TData>;
  serverPagination?: ServerPaginationProps;
}

export function DataTablePagination<TData>({
  table,
  serverPagination,
}: DataTablePaginationProps<TData>) {
  if (serverPagination) {
    const { pageCursor, nextCursor, onFirstPage, onNextPage, itemCount, loading } = serverPagination;
    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5 border-t border-[#edf0f5] bg-white text-xs text-[#64748b]">
        <div className="font-medium text-[#475569]">
          Showing <span className="font-semibold text-[#0f172a]">{itemCount}</span> record{itemCount !== 1 ? "s" : ""} on this page
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={loading || !pageCursor}
            onClick={onFirstPage}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md border border-[#dbe1ea] bg-white text-[#475569] hover:bg-[#f1f5f9] hover:border-[#cbd5e1] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <IconChevronsLeft size={14} />
            <span>First Page</span>
          </button>
          <button
            type="button"
            disabled={loading || !nextCursor}
            onClick={() => nextCursor && onNextPage(nextCursor)}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md border border-[#dbe1ea] bg-white text-[#475569] hover:bg-[#f1f5f9] hover:border-[#cbd5e1] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <span>Next Page</span>
            <IconChevronRight size={14} />
          </button>
        </div>
      </div>
    );
  }

  if (table) {
    const pageIndex = table.getState().pagination.pageIndex;
    const pageCount = table.getPageCount();
    const totalRows = table.getFilteredRowModel().rows.length;

    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5 border-t border-[#edf0f5] bg-white text-xs text-[#64748b]">
        <div className="font-medium text-[#475569]">
          Showing <span className="font-semibold text-[#0f172a]">{table.getRowModel().rows.length}</span> of{" "}
          <span className="font-semibold text-[#0f172a]">{totalRows}</span> record{totalRows !== 1 ? "s" : ""}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[#64748b] text-[11px] mr-1">
            Page {pageIndex + 1} of {Math.max(pageCount, 1)}
          </span>
          <button
            type="button"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
            className="p-1.5 rounded-md border border-[#dbe1ea] bg-white text-[#475569] hover:bg-[#f1f5f9] hover:border-[#cbd5e1] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Previous Page"
          >
            <IconChevronLeft size={15} />
          </button>
          <button
            type="button"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
            className="p-1.5 rounded-md border border-[#dbe1ea] bg-white text-[#475569] hover:bg-[#f1f5f9] hover:border-[#cbd5e1] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Next Page"
          >
            <IconChevronRight size={15} />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
