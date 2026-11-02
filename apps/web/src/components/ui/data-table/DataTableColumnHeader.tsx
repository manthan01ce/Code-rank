"use client";

import React from "react";
import { type Column } from "@tanstack/react-table";
import { IconArrowsSort, IconSortAscending, IconSortDescending } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface DataTableColumnHeaderProps<TData, TValue>
  extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>;
  title: string;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <div className={cn("text-[10px] uppercase font-bold tracking-wider text-[#64748b]", className)}>{title}</div>;
  }

  const sorted = column.getIsSorted();

  return (
    <div className={cn("inline-flex items-center", className)}>
      <button
        type="button"
        onClick={() => column.toggleSorting(sorted === "asc")}
        className="table-header-btn inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider text-[#64748b] hover:text-[#0f172a] transition-colors focus:outline-none focus:text-[#4f46e5]"
        aria-label={`Sort by ${title}`}
      >
        <span>{title}</span>
        {sorted === "desc" ? (
          <IconSortDescending size={13} className="text-[#4f46e5] shrink-0" />
        ) : sorted === "asc" ? (
          <IconSortAscending size={13} className="text-[#4f46e5] shrink-0" />
        ) : (
          <IconArrowsSort size={12} className="text-[#94a3b8] opacity-40 hover:opacity-100 shrink-0" />
        )}
      </button>
    </div>
  );
}
