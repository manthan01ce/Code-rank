"use client";

import React, { type ReactNode } from "react";
import { IconInbox } from "@tabler/icons-react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({
  icon = <IconInbox size={36} className="text-[#94a3b8]" />,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-14 h-14 rounded-full bg-[#f8fafc] border border-[#e2e8f0] flex items-center justify-center mb-3">
        {icon}
      </div>
      <h3 className="text-sm font-bold text-[#0f172a]">{title}</h3>
      {description && (
        <p className="text-xs text-[#64748b] max-w-sm mt-1 leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
