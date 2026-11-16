import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import { CheckCircle2, Info, MessageSquare } from "lucide-react";
import { isDemoPreviewActive } from "@/config/demo-preview";
import { useAuthStore } from "@/store/useAuthStore";
import { useHostVenue } from "./HostDashboardLayout";

export function HostReviewManagementPage() {
  const location = useLocation();
  const { isDemoActive } = useHostVenue();
  const { isAuthenticated } = useAuthStore();

  const showDemo =
    !isAuthenticated &&
    (isDemoActive ||
      isDemoPreviewActive({
        allowDemoPreview: true,
        search: location.search,
        isAuthenticated
      }));

  const [replyText, setReplyText] = useState("");
  const [replyPublished, setReplyPublished] = useState(false);

  const demoReviews = showDemo
    ? [
        {
          id: "rev-1",
          author: "Amaya Perera",
          country: "Sri Lanka",
          date: "Yesterday",
          bookingRef: "LS-2026-8841",
          rating: 5,
          content:
            "Super fast QR check-in right outside Colombo Fort Station! Loved seeing the numbered security seal placed on our backpacks.",
          reply:
            "Thank you Amaya! We are delighted our Fort Station vault made your city excursion hassle-free."
        },
        {
          id: "rev-2",
          author: "Liam O'Connor",
          country: "Ireland",
          date: "07 Nov 2026",
          bookingRef: "LS-2026-8842",
          rating: 5,
          content:
            "Left two large suitcases before boarding the scenic train to Ella. Bags were in perfect condition with intact seals when we collected them.",
          reply: null
        },
        {
          id: "rev-3",
          author: "Sophie Laurent",
          country: "France",
          date: "04 Nov 2026",
          bookingRef: "LS-2026-8799",
          rating: 4,
          content:
            "Very convenient location. Only 2 minutes walk from the station exit. Prompt service.",
          reply: "Merci Sophie! Hope you enjoyed your holiday across the island."
        }
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-sand-200 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-navy-950 tracking-tight">
              Customer Reviews &amp; Reputation
            </h1>
            <p className="text-xs text-navy-600 mt-0.5">
              Read verified post-checkout traveller ratings and publish official partner responses.
            </p>
          </div>
          {showDemo && (
            <div className="flex items-center gap-2 bg-sand-100 px-3.5 py-1.5 rounded-xl">
              <span className="text-amber-500 font-bold text-sm">★ 4.9</span>
              <span className="text-xs text-navy-700 font-semibold">214 Verified Reviews</span>
            </div>
          )}
        </div>
      </div>

      {showDemo ? (
        <>
          <div className="rounded-xl bg-sand-100/90 border border-sand-300 p-4 text-xs text-navy-800 flex items-start gap-3">
            <Info className="h-4 w-4 text-terracotta-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="text-navy-950">Customer Reviews (Demo Data):</strong> Sample
              feedback ratings and reviews shown for demo preview.
            </div>
          </div>

          {replyPublished && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
              <span>
                Local Prototype: Official host response previewed in workstation session (not
                published to public travellers).
              </span>
            </div>
          )}

          <div className="space-y-4">
            {demoReviews.map((r) => (
              <div
                key={r.id}
                className="bg-white rounded-2xl border border-sand-200 p-5 sm:p-6 shadow-sm space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-full bg-navy-900 text-white flex items-center justify-center font-bold text-xs">
                      {r.author.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-navy-950">
                        {r.author} ({r.country})
                      </p>
                      <p className="text-[10px] text-navy-500 font-mono">
                        Booking #{r.bookingRef} • {r.date}
                      </p>
                    </div>
                  </div>
                  <div className="text-amber-500 text-xs font-bold">
                    {"★".repeat(r.rating)}
                    {"☆".repeat(5 - r.rating)} ({r.rating}.0)
                  </div>
                </div>

                <p className="text-xs text-navy-800 leading-relaxed">{r.content}</p>

                {r.reply ? (
                  <div className="p-3.5 rounded-xl bg-sand-50 border-l-4 border-terracotta-500 text-xs space-y-1">
                    <span className="font-bold text-navy-900 text-[11px]">
                      Official Host Response:
                    </span>
                    <p className="text-navy-700 text-xs">{r.reply}</p>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-sand-100 space-y-2">
                    <label className="block text-[11px] font-bold text-navy-700">
                      Reply to {r.author}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Type official reply..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        className="flex-1 rounded-xl border border-sand-300 px-3 py-1.5 text-xs text-navy-900"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (replyText.trim()) {
                            setReplyPublished(true);
                            setReplyText("");
                            setTimeout(() => setReplyPublished(false), 3000);
                          }
                        }}
                        className="px-4 py-1.5 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-xs font-bold transition"
                      >
                        Reply
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="bg-white rounded-2xl border border-sand-200 p-8 text-center space-y-3 shadow-sm">
          <div className="mx-auto h-11 w-11 rounded-2xl bg-sand-100 text-navy-700 flex items-center justify-center">
            <MessageSquare className="h-5 w-5" />
          </div>
          <h2 className="text-base font-bold text-navy-950">
            Verified Traveller Reviews Coming Post-MVP
          </h2>
          <p className="text-xs text-navy-600 max-w-lg mx-auto leading-relaxed">
            Post-checkout traveller ratings and official host reply moderation are scheduled for an
            upcoming platform release once custody completion feedback pipelines are enabled. No
            placeholder ratings are displayed for live accounts.
          </p>
        </div>
      )}
    </div>
  );
}
