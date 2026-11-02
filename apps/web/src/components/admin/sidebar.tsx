"use client";

import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconMenu2, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export type SidebarInteractionState = 'collapsed' | 'expanded' | 'suppressed';

interface Point {
  x: number;
  y: number;
}

const SUPPRESSION_MOVEMENT_THRESHOLD_PX = 6;
const SUPPRESSION_MOVEMENT_THRESHOLD_SQ =
  SUPPRESSION_MOVEMENT_THRESHOLD_PX * SUPPRESSION_MOVEMENT_THRESHOLD_PX;

interface SidebarContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  hovered: boolean;
  setHovered: (hovered: boolean) => void;
  interactionState: SidebarInteractionState;
  collapseOnNav: (posOrEvent?: { clientX?: number; clientY?: number; x?: number; y?: number } | React.MouseEvent | null) => void;
  handlePointerEnter: (e: React.PointerEvent<HTMLElement>) => void;
  handlePointerLeave: (e: React.PointerEvent<HTMLElement>) => void;
  handlePointerMove: (e: React.PointerEvent<HTMLElement>) => void;
  handleMouseEnter: () => void;
  handleMouseLeave: () => void;
  handleFocus: () => void;
  handleBlur: (e: React.FocusEvent) => void;
  sidebarRef: React.RefObject<HTMLElement | null>;
}

const Context = createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const value = useContext(Context);
  if (!value) throw new Error("useSidebar must be used within a SidebarProvider");
  return value;
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);       // mobile drawer
  const [interactionState, setInteractionState] = useState<SidebarInteractionState>('collapsed');
  const stateRef = useRef<SidebarInteractionState>('collapsed');
  const sidebarRef = useRef<HTMLElement | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pointer position tracking refs
  const lastPointerPosRef = useRef<Point | null>(null);
  const suppressionOriginRef = useRef<Point | null>(null);

  const transitionTo = useCallback((nextState: SidebarInteractionState) => {
    if (stateRef.current === nextState) return;
    stateRef.current = nextState;
    setInteractionState(nextState);
  }, []);

  const collapseOnNav = useCallback((posOrEvent?: { clientX?: number; clientY?: number; x?: number; y?: number } | React.MouseEvent | null) => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }

    // Determine pointer coordinates at the moment navigation was triggered
    let origin: Point | null = null;
    if (posOrEvent) {
      const x = typeof (posOrEvent as any).clientX === "number" ? (posOrEvent as any).clientX : (posOrEvent as any).x;
      const y = typeof (posOrEvent as any).clientY === "number" ? (posOrEvent as any).clientY : (posOrEvent as any).y;
      // Filter out synthetic (0, 0) coordinates from keyboard events
      if (typeof x === "number" && typeof y === "number" && (x !== 0 || y !== 0)) {
        origin = { x, y };
      }
    }

    if (!origin) {
      // If we already captured a suppression origin (e.g. from link click before pathname update), preserve it
      if (suppressionOriginRef.current) {
        origin = suppressionOriginRef.current;
      } else if (lastPointerPosRef.current) {
        origin = { ...lastPointerPosRef.current };
      }
    }

    suppressionOriginRef.current = origin;
    transitionTo('suppressed');
    setOpen(false);

    // Blur any focused element inside sidebar so focus doesn't trigger re-expansion
    if (
      typeof document !== "undefined" &&
      sidebarRef.current &&
      sidebarRef.current.contains(document.activeElement)
    ) {
      (document.activeElement as HTMLElement)?.blur?.();
    }
  }, [transitionTo]);

  // Collapse immediately whenever route/pathname changes
  useEffect(() => {
    collapseOnNav();
  }, [pathname, collapseOnNav]);

  const handlePointerEnter = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType === "touch") return;

    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }

    lastPointerPosRef.current = { x: e.clientX, y: e.clientY };

    // On entry from outside the sidebar, always clear suppression and expand normally
    suppressionOriginRef.current = null;
    transitionTo("expanded");
  }, [transitionTo]);

  const handlePointerLeave = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType === "touch") return;

    lastPointerPosRef.current = null;
    suppressionOriginRef.current = null;

    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }

    // If already suppressed (collapsed visually), collapse immediately and clear suppression
    if (stateRef.current === "suppressed") {
      transitionTo("collapsed");
      return;
    }

    // Preserve the existing 60ms debounce on pointer exit before collapsing
    leaveTimer.current = setTimeout(() => {
      transitionTo("collapsed");
      leaveTimer.current = null;
    }, 60);
  }, [transitionTo]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType === "touch") return;

    const currentX = e.clientX;
    const currentY = e.clientY;
    lastPointerPosRef.current = { x: currentX, y: currentY };

    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }

    if (stateRef.current === "suppressed") {
      // If no suppression origin was captured, anchor to this initial position
      if (!suppressionOriginRef.current) {
        suppressionOriginRef.current = { x: currentX, y: currentY };
        return;
      }

      const dx = currentX - suppressionOriginRef.current.x;
      const dy = currentY - suppressionOriginRef.current.y;
      const distSq = dx * dx + dy * dy;

      // Only respond when the pointer has genuinely moved after navigation click
      if (distSq >= SUPPRESSION_MOVEMENT_THRESHOLD_SQ) {
        suppressionOriginRef.current = null;
        transitionTo("expanded");
      }
      return;
    }

    if (stateRef.current === "collapsed") {
      // Pointer moving inside collapsed sidebar expands it
      transitionTo("expanded");
    }
  }, [transitionTo]);

  const handleFocus = useCallback(() => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
    suppressionOriginRef.current = null;
    transitionTo("expanded");
  }, [transitionTo]);

  const handleBlur = useCallback((e: React.FocusEvent) => {
    if (sidebarRef.current && !sidebarRef.current.contains(e.relatedTarget as Node)) {
      if (leaveTimer.current) {
        clearTimeout(leaveTimer.current);
      }
      leaveTimer.current = setTimeout(() => {
        transitionTo("collapsed");
        leaveTimer.current = null;
      }, 60);
    }
  }, [transitionTo]);

  useEffect(() => {
    return () => {
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    };
  }, []);

  const hovered = interactionState === "expanded";

  const setHovered = useCallback((val: boolean) => {
    if (val) {
      suppressionOriginRef.current = null;
      transitionTo("expanded");
    } else {
      transitionTo("collapsed");
    }
  }, [transitionTo]);

  return (
    <Context.Provider
      value={{
        open,
        setOpen,
        hovered,
        setHovered,
        interactionState,
        collapseOnNav,
        handlePointerEnter,
        handlePointerLeave,
        handlePointerMove,
        handleMouseEnter: handlePointerEnter as unknown as () => void,
        handleMouseLeave: handlePointerLeave as unknown as () => void,
        handleFocus,
        handleBlur,
        sidebarRef,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export const Sidebar = SidebarProvider;

export function DesktopSidebar({ children }: { children: ReactNode }) {
  const {
    hovered,
    handlePointerEnter,
    handlePointerLeave,
    handlePointerMove,
    handleFocus,
    handleBlur,
    sidebarRef,
  } = useSidebar();

  return (
    <>
      {/* Spacer reserves 64px rail so main content never shifts on expansion */}
      <div className="admin-sidebar-spacer hidden md:block" aria-hidden="true" />
      <aside
        ref={sidebarRef}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onPointerMove={handlePointerMove}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={cn(
          "admin-desktop-sidebar hidden md:flex",
          hovered && "admin-sidebar-expanded"
        )}
        aria-label="Admin navigation"
      >
        {children}
      </aside>
    </>
  );
}

export function MobileSidebar({ children }: { children: ReactNode }) {
  const { open, setOpen } = useSidebar();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        const nodes = Array.from(
          document.querySelectorAll<HTMLElement>(
            "#admin-mobile-menu a, #admin-mobile-menu button"
          )
        );
        const first = nodes[0];
        const last = nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
      if (e.key === "Escape") {
        setOpen(false);
        document.getElementById("admin-menu-toggle")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  return (
    <div className="admin-mobile-sidebar block md:hidden w-full">
      <div className="flex items-center justify-between p-3.5 border-b border-[#e2e8f0] bg-white">
        <a href="/admin" className="flex items-center gap-2.5 no-underline">
          <img src="/coderank-logo.jpg" alt="CodeRank Logo" className="w-8 h-8 rounded-full border border-[#e2e8f0] object-cover" />
          <span className="font-bold text-[#0f172a] text-base tracking-tight">CodeRank Admin</span>
        </a>
        <button
          id="admin-menu-toggle"
          type="button"
          aria-label="Open admin menu"
          aria-expanded={open}
          aria-controls="admin-mobile-menu"
          onClick={() => setOpen(true)}
          className="p-2 rounded-lg border border-[#e2e8f0] bg-white text-[#475569] hover:bg-[#f1f5f9] transition-colors"
        >
          <IconMenu2 size={20} />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-[#0f172a]/50 backdrop-blur-xs transition-opacity"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            id="admin-mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Admin menu"
            className="relative z-50 flex flex-col w-[280px] max-w-[85vw] h-full bg-white p-4 overflow-y-auto shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3.5 border-b border-[#e2e8f0] mb-3">
              <a href="/admin" className="flex items-center gap-2 no-underline">
                <img src="/coderank-logo.jpg" alt="CodeRank" className="w-8 h-8 rounded-full border border-[#e2e8f0]" />
                <span className="font-bold text-[#0f172a] text-sm">CodeRank Admin</span>
              </a>
              <button
                autoFocus
                type="button"
                aria-label="Close admin menu"
                onClick={() => {
                  setOpen(false);
                  document.getElementById("admin-menu-toggle")?.focus();
                }}
                className="p-1.5 rounded-lg border border-[#e2e8f0] text-[#64748b] hover:bg-[#f1f5f9]"
              >
                <IconX size={18} />
              </button>
            </div>
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

export function SidebarBody({ children }: { children: ReactNode }) {
  return (
    <>
      <DesktopSidebar>{children}</DesktopSidebar>
      <MobileSidebar>{children}</MobileSidebar>
    </>
  );
}

export function SidebarLink({
  href,
  label,
  icon,
  active = false,
  onClick,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  const { collapseOnNav } = useSidebar();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    (e.currentTarget as HTMLElement)?.blur?.();
    collapseOnNav(e);
    if (onClick) onClick();
  };

  return (
    <div className="admin-nav-item">
      <Link
        href={href}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        className={cn(
          "admin-nav-link",
          active && "is-active"
        )}
        onClick={handleClick}
      >
        <span className="admin-nav-icon shrink-0" aria-hidden="true">{icon}</span>
        <span className="admin-sidebar-label">{label}</span>
      </Link>
      <div role="tooltip" className="admin-sidebar-tooltip">
        {label}
      </div>
    </div>
  );
}
