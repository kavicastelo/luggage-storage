import React from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { MascotIllustration } from "@/components/ui/MascotIllustration";

export function NotFoundPage() {
  return (
    <Card className="max-w-lg mx-auto my-8 bg-white p-8 text-center space-y-6">
      <MascotIllustration
        mascot="shrug"
        size="lg"
        variant="empty"
        badgeText="404 — Route Not Found"
        caption="Kiri checked every luggage rack, but the requested URL does not match an active marketplace screen."
      />
      <h1 className="text-2xl font-extrabold text-navy-950 tracking-tight">Page Not Found</h1>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          to="/"
          className="min-h-[44px] inline-flex items-center px-5 py-2.5 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-xl text-sm font-bold transition-colors shadow-sm"
        >
          Return to Home
        </Link>
        <Link
          to="/search"
          className="min-h-[44px] inline-flex items-center px-5 py-2.5 bg-white border border-sand-300 hover:bg-sand-100 text-navy-900 rounded-xl text-sm font-bold transition-colors"
        >
          Search Storage
        </Link>
      </div>
    </Card>
  );
}
