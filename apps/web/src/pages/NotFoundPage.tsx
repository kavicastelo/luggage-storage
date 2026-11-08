import React from "react";
import { Link } from "react-router-dom";
import { MascotIllustration } from "@/components/ui/MascotIllustration";

export function NotFoundPage() {
  return (
    <div className="max-w-lg mx-auto text-center py-12 space-y-6">
      <MascotIllustration
        mascot="shrug"
        size="lg"
        variant="empty"
        badgeText="404 — Route Not Found"
        caption="Kiri checked every luggage rack, but the requested URL does not match an active marketplace screen."
      />
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          to="/"
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition"
        >
          Return to Landing (PW-001)
        </Link>
        <Link
          to="/search"
          className="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition"
        >
          Search Storage (PW-002)
        </Link>
      </div>
    </div>
  );
}
