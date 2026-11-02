"use client";

import React from "react";

interface TableSkeletonProps {
  columns: number;
  rows?: number;
}

export function TableSkeleton({ columns, rows = 6 }: TableSkeletonProps) {
  return (
    <div className="w-full space-y-3 p-4 animate-pulse">
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div key={rIdx} className="flex items-center gap-4 py-3 border-b border-[#f1f5f9]">
          {Array.from({ length: columns }).map((_, cIdx) => (
            <div
              key={cIdx}
              className="h-4 bg-[#f1f5f9] rounded-md shrink-0"
              style={{
                width: cIdx === 0 ? "18%" : cIdx === 1 ? "24%" : cIdx === 2 ? "20%" : "14%",
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
