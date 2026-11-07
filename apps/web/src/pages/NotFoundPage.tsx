import React from "react";
import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="text-center py-16 space-y-4">
      <h2 className="text-3xl font-bold">404 - Page Not Found</h2>
      <p className="text-slate-600">The requested screen is not implemented in Phase 1A.</p>
      <Link to="/" className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg font-medium">
        Return Home
      </Link>
    </div>
  );
}
