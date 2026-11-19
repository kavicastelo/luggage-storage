import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface PaginationBarProps {
  page: number;
  totalPages: number;
  total: number;
  limit?: number;
  onPageChange: (nextPage: number) => void;
  itemLabel?: string;
  className?: string;
}

export function PaginationBar({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  itemLabel = "items",
  className = ""
}: PaginationBarProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const startItem = total > 0 ? (page - 1) * (limit ?? 20) + 1 : 0;
  const endItem = limit ? Math.min(total, page * limit) : total;

  // Build page numbers window
  const getPageNumbers = () => {
    if (safeTotalPages <= 7) {
      return Array.from({ length: safeTotalPages }, (_, i) => i + 1);
    }
    if (page <= 4) {
      return [1, 2, 3, 4, 5, "...", safeTotalPages];
    }
    if (page >= safeTotalPages - 3) {
      return [1, "...", safeTotalPages - 4, safeTotalPages - 3, safeTotalPages - 2, safeTotalPages - 1, safeTotalPages];
    }
    return [1, "...", page - 1, page, page + 1, "...", safeTotalPages];
  };

  const pages = getPageNumbers();

  return (
    <nav
      role="navigation"
      aria-label="Pagination"
      className={`flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-sand-200 text-xs text-sand-700 ${className}`}
    >
      <div className="tabular-nums">
        {limit ? (
          <span>
            Showing <strong className="text-navy-950 font-bold">{startItem}</strong> –{" "}
            <strong className="text-navy-950 font-bold">{endItem}</strong> of{" "}
            <strong className="text-navy-950 font-bold">{total}</strong> {itemLabel}
          </span>
        ) : (
          <span>
            Page <strong className="text-navy-950 font-bold">{page}</strong> of{" "}
            <strong className="text-navy-950 font-bold">{safeTotalPages}</strong> (
            <strong className="text-navy-950 font-bold">{total}</strong> total {itemLabel})
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          aria-label="Previous page"
          className="inline-flex items-center gap-1 min-h-[38px] px-3 py-1.5 rounded-lg border border-sand-200 bg-white font-semibold text-navy-900 hover:bg-sand-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Previous</span>
        </button>

        <div className="hidden sm:flex items-center gap-1">
          {pages.map((p, idx) => {
            if (p === "...") {
              return (
                <span key={`ellipsis-${idx}`} className="px-2 py-1 text-sand-400 select-none">
                  …
                </span>
              );
            }
            const isCurrent = p === page;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(Number(p))}
                aria-label={`Page ${p}`}
                aria-current={isCurrent ? "page" : undefined}
                className={`min-h-[38px] min-w-[38px] px-2 py-1 rounded-lg text-xs font-bold transition-colors ${
                  isCurrent
                    ? "bg-navy-900 text-white"
                    : "border border-sand-200 bg-white text-navy-900 hover:bg-sand-100"
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          disabled={page >= safeTotalPages}
          onClick={() => onPageChange(Math.min(safeTotalPages, page + 1))}
          aria-label="Next page"
          className="inline-flex items-center gap-1 min-h-[38px] px-3 py-1.5 rounded-lg border border-sand-200 bg-white font-semibold text-navy-900 hover:bg-sand-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </nav>
  );
}
