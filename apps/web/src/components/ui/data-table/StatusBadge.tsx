"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "active" | "inactive" | string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalized = String(status || "").toLowerCase().trim();
  const isActive = normalized === "active";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide border transition-colors",
        isActive
          ? "bg-[#eff1ff] text-[#4338ca] border-[#c7d2fe]"
          : "bg-[#fef2f2] text-[#991b1b] border-[#fecaca]",
        className
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full shrink-0",
          isActive ? "bg-[#4f46e5]" : "bg-[#ef4444]"
        )}
      />
      {isActive ? "ACTIVE" : "INACTIVE"}
    </span>
  );
}
