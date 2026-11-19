import React, { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import type { OpeningHourItemInput, OpeningHoursExceptionType } from "@luggage-storage/contracts";
import { CheckCircle2, Copy, Plus, Trash2 } from "lucide-react";
import { Alert, Button, Card, LoadingSkeleton } from "@/components/ui";
import { DEMO_LOCATIONS } from "@/data/mock-marketplace";
import { isDemoPreviewActive } from "@/config/demo-preview";
import { useAuthStore } from "@/store/useAuthStore";
import {
  useAddOpeningHoursExceptionMutation,
  useDeleteOpeningHoursExceptionMutation,
  useHostLocationDetailQuery,
  useOpeningHoursExceptionsQuery,
  useOpeningHoursQuery,
  useSetOpeningHoursMutation
} from "@/hooks/queries/use-host-portal";
import {
  HostLocationSetupTabs,
  HostQueryErrorAlert,
  isUuid,
  NoLocationSelectedCard
} from "./host-helpers";
import { useHostVenue } from "./HostDashboardLayout";

const WEEK_DAY_LABELS = [
  "",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday"
];

function buildDefaultSchedule(): OpeningHourItemInput[] {
  return [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => ({
    dayOfWeek,
    openTime: "06:00",
    closeTime: "23:00",
    allowsDropoff: true,
    allowsCollection: true,
    isClosed: false
  }));
}

export function HostScheduleCalendarEditorPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { allLocations, selectedLocationId, isDemoActive, querySuffix } = useHostVenue();
  const { isAuthenticated } = useAuthStore();

  const targetLocationId = id || selectedLocationId || allLocations[0]?.id || "";
  const liveLocationId = isAuthenticated && isUuid(targetLocationId) ? targetLocationId : undefined;

  const detailQuery = useHostLocationDetailQuery(liveLocationId, { enabled: isAuthenticated });
  const hoursQuery = useOpeningHoursQuery(liveLocationId, { enabled: isAuthenticated });
  const exceptionsQuery = useOpeningHoursExceptionsQuery(liveLocationId, {
    enabled: isAuthenticated
  });
  const saveHoursMutation = useSetOpeningHoursMutation();
  const addExceptionMutation = useAddOpeningHoursExceptionMutation();
  const deleteExceptionMutation = useDeleteOpeningHoursExceptionMutation();

  const showDemoLoc =
    !isAuthenticated &&
    (isDemoActive ||
      isDemoPreviewActive({
        allowDemoPreview: true,
        search: location.search,
        isAuthenticated
      }));
  const demoLoc = showDemoLoc
    ? DEMO_LOCATIONS.find((l) => l.id === id) || DEMO_LOCATIONS[0]
    : null;

  const [weeklySchedule, setWeeklySchedule] = useState<OpeningHourItemInput[]>(
    buildDefaultSchedule()
  );
  const [exceptionDate, setExceptionDate] = useState("");
  const [exceptionType, setExceptionType] = useState<OpeningHoursExceptionType>("CLOSURE");
  const [exceptionOpen, setExceptionOpen] = useState("08:00");
  const [exceptionClose, setExceptionClose] = useState("18:00");
  const [exceptionReason, setExceptionReason] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !hoursQuery.data) return;
    const byDay = new Map(hoursQuery.data.map((row) => [row.dayOfWeek, row]));
    setWeeklySchedule(
      [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => {
        const existing = byDay.get(dayOfWeek);
        if (!existing) {
          return {
            dayOfWeek,
            openTime: "06:00",
            closeTime: "23:00",
            allowsDropoff: true,
            allowsCollection: true,
            isClosed: false
          };
        }
        return {
          dayOfWeek,
          openTime: existing.openTime.slice(0, 5),
          closeTime: existing.closeTime.slice(0, 5),
          allowsDropoff: existing.allowsDropoff,
          allowsCollection: existing.allowsCollection,
          isClosed: existing.isClosed
        };
      })
    );
  }, [isAuthenticated, hoursQuery.data]);

  if (isAuthenticated && !liveLocationId) {
    return (
      <NoLocationSelectedCard
        description="Create or select a verified storage hub from Storage Locations before managing operating hours."
        querySuffix={querySuffix}
      />
    );
  }

  if (!isAuthenticated && !demoLoc) {
    return (
      <NoLocationSelectedCard
        description="Create or select a verified storage hub from Storage Locations before managing operating hours."
        querySuffix={querySuffix}
      />
    );
  }

  if (isAuthenticated && (hoursQuery.isLoading || exceptionsQuery.isLoading)) {
    return (
      <Card className="p-6 space-y-4">
        <LoadingSkeleton variant="text" className="w-56 h-7" />
        <LoadingSkeleton className="h-14 w-full" />
        <LoadingSkeleton className="h-14 w-full" />
        <LoadingSkeleton className="h-14 w-full" />
      </Card>
    );
  }

  if (isAuthenticated && (hoursQuery.isError || exceptionsQuery.isError)) {
    return (
      <HostQueryErrorAlert
        message={
          hoursQuery.error instanceof Error
            ? hoursQuery.error.message
            : "Failed to load operating schedule."
        }
        onRetry={() => {
          void hoursQuery.refetch();
          void exceptionsQuery.refetch();
        }}
      />
    );
  }

  const updateDay = (dayOfWeek: number, patch: Partial<OpeningHourItemInput>) => {
    setWeeklySchedule((prev) =>
      prev.map((item) => (item.dayOfWeek === dayOfWeek ? { ...item, ...patch } : item))
    );
  };

  const copyMondaySchedule = (scope: "WEEKDAYS" | "ALL") => {
    const monday = weeklySchedule.find((d) => d.dayOfWeek === 1);
    if (!monday) return;
    setWeeklySchedule((prev) =>
      prev.map((item) => {
        const shouldApply =
          scope === "ALL" ? item.dayOfWeek > 1 : item.dayOfWeek >= 2 && item.dayOfWeek <= 5;
        if (!shouldApply) return item;
        return {
          ...item,
          openTime: monday.openTime,
          closeTime: monday.closeTime,
          allowsDropoff: monday.allowsDropoff,
          allowsCollection: monday.allowsCollection,
          isClosed: monday.isClosed
        };
      })
    );
    setSavedNotice(
      scope === "WEEKDAYS"
        ? "Copied Monday schedule to Tuesday–Friday. Click Save Schedule to commit."
        : "Copied Monday schedule to all days. Click Save Schedule to commit."
    );
  };

  const handleSaveSchedule = async () => {
    setErrorMsg(null);
    setSavedNotice(null);
    if (!isAuthenticated) {
      setSavedNotice("Weekly schedule updated successfully. Saved to local session.");
      return;
    }
    if (!liveLocationId) return;

    try {
      await saveHoursMutation.mutateAsync({
        locationId: liveLocationId,
        schedules: weeklySchedule
      });
      setSavedNotice("Weekly operating hours saved.");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to save weekly schedule.");
    }
  };

  const handleAddException = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveLocationId || !exceptionDate) return;
    setErrorMsg(null);
    setSavedNotice(null);
    try {
      await addExceptionMutation.mutateAsync({
        locationId: liveLocationId,
        data: {
          exceptionDate,
          exceptionType,
          openTime: exceptionType === "SPECIAL_HOURS" ? exceptionOpen : null,
          closeTime: exceptionType === "SPECIAL_HOURS" ? exceptionClose : null,
          reason: exceptionReason.trim() || undefined
        }
      });
      setExceptionDate("");
      setExceptionReason("");
      setSavedNotice("Holiday / closure exception saved.");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to create schedule exception.");
    }
  };

  const handleDeleteException = async (exceptionId: string) => {
    if (!liveLocationId) return;
    setErrorMsg(null);
    try {
      await deleteExceptionMutation.mutateAsync({
        locationId: liveLocationId,
        exceptionId
      });
      setSavedNotice("Schedule exception removed.");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to delete schedule exception.");
    }
  };

  const locationTitle = detailQuery.data?.name ?? demoLoc?.name ?? "Storage Hub";
  const exceptions = exceptionsQuery.data ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-sand-200 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link
                to={`/host/locations${querySuffix}`}
                className="text-xs font-bold text-terracotta-600 hover:underline"
              >
                ← Storage Locations
              </Link>
              <span className="text-xs text-navy-400">•</span>
              <span className="text-xs font-medium text-navy-600">{locationTitle}</span>
            </div>
            <h1 className="text-2xl font-extrabold text-navy-950 tracking-tight">
              Operating Hours &amp; Holiday Exceptions
            </h1>
            <p className="text-xs text-navy-600 mt-0.5">
              Prevent bookings outside active staff shifts and configure Sri Lankan Poya &amp; mercantile holiday closures.
            </p>
          </div>
          <button
            type="button"
            disabled={saveHoursMutation.isPending}
            onClick={() => void handleSaveSchedule()}
            className="px-5 py-2.5 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
          >
            {saveHoursMutation.isPending ? "Saving..." : "Save Schedule"}
          </button>
        </div>
      </div>

      <HostLocationSetupTabs locationId={targetLocationId} querySuffix={querySuffix} />

      {errorMsg && (
        <Alert variant="danger" title="Schedule Error">
          {errorMsg}
        </Alert>
      )}

      {savedNotice && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <span>{savedNotice}</span>
        </div>
      )}

      {/* 7-Day Matrix */}
      <Card className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-navy-950">Standard Weekly Schedule</h2>
            <span className="text-xs text-navy-500">Sri Lanka Standard Time (IST, UTC+5:30)</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => copyMondaySchedule("WEEKDAYS")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-sand-300 bg-sand-50 hover:bg-sand-100 text-[11px] font-bold text-navy-800 transition"
            >
              <Copy className="h-3 w-3" />
              <span>Copy Monday to Weekdays</span>
            </button>
            <button
              type="button"
              onClick={() => copyMondaySchedule("ALL")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-sand-300 bg-sand-50 hover:bg-sand-100 text-[11px] font-bold text-navy-800 transition"
            >
              <Copy className="h-3 w-3" />
              <span>Copy Monday to All Days</span>
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {weeklySchedule.map((item) => (
            <div
              key={item.dayOfWeek}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-sand-50/70 border border-sand-200 text-xs gap-3"
            >
              <div className="flex items-center gap-3 w-36">
                <input
                  type="checkbox"
                  checked={!item.isClosed}
                  onChange={(e) => updateDay(item.dayOfWeek, { isClosed: !e.target.checked })}
                  className="rounded text-terracotta-500"
                />
                <span className="font-bold text-navy-900">{WEEK_DAY_LABELS[item.dayOfWeek]}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-navy-600">Open:</span>
                <input
                  type="time"
                  aria-label={`${WEEK_DAY_LABELS[item.dayOfWeek]} open time`}
                  disabled={item.isClosed}
                  value={item.openTime}
                  onChange={(e) => updateDay(item.dayOfWeek, { openTime: e.target.value })}
                  className="px-2.5 py-1 rounded-lg border border-sand-300 font-mono text-xs bg-white disabled:opacity-50"
                />
                <span className="text-navy-600">to</span>
                <input
                  type="time"
                  aria-label={`${WEEK_DAY_LABELS[item.dayOfWeek]} close time`}
                  disabled={item.isClosed}
                  value={item.closeTime}
                  onChange={(e) => updateDay(item.dayOfWeek, { closeTime: e.target.value })}
                  className="px-2.5 py-1 rounded-lg border border-sand-300 font-mono text-xs bg-white disabled:opacity-50"
                />
              </div>
              <div className="flex items-center gap-4 text-[11px] text-navy-600">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    disabled={item.isClosed}
                    checked={item.allowsDropoff}
                    onChange={(e) => updateDay(item.dayOfWeek, { allowsDropoff: e.target.checked })}
                    className="rounded text-terracotta-500"
                  />
                  <span>Drop-Off</span>
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    disabled={item.isClosed}
                    checked={item.allowsCollection}
                    onChange={(e) =>
                      updateDay(item.dayOfWeek, { allowsCollection: e.target.checked })
                    }
                    className="rounded text-terracotta-500"
                  />
                  <span>Pick-Up</span>
                </label>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-2 border-t border-sand-100">
          <Button
            type="button"
            size="sm"
            isLoading={saveHoursMutation.isPending}
            onClick={() => void handleSaveSchedule()}
          >
            {saveHoursMutation.isPending ? "Saving..." : "Save Schedule"}
          </Button>
        </div>
      </Card>

      {/* Holiday & Closure Exceptions */}
      <Card className="p-6 space-y-4">
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-navy-950">
            Sri Lankan Poya &amp; Mercantile Exceptions
          </h2>
          <p className="text-xs text-navy-600">
            Sri Lanka observes monthly Full Moon Poya statutory holidays. Set special hours or close counter operations on specific dates.
          </p>
        </div>

        {isAuthenticated ? (
          <>
            <form
              onSubmit={handleAddException}
              className="grid grid-cols-1 sm:grid-cols-5 gap-3 p-4 rounded-xl bg-sand-50 border border-sand-200 text-xs items-end"
            >
              <div>
                <label className="block font-bold text-navy-900 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={exceptionDate}
                  onChange={(e) => setExceptionDate(e.target.value)}
                  className="w-full rounded-lg border border-sand-300 px-2.5 py-1.5 bg-white"
                />
              </div>
              <div>
                <label className="block font-bold text-navy-900 mb-1">Exception Type</label>
                <select
                  aria-label="Exception Type"
                  value={exceptionType}
                  onChange={(e) => setExceptionType(e.target.value as OpeningHoursExceptionType)}
                  className="w-full rounded-lg border border-sand-300 px-2.5 py-1.5 bg-white"
                >
                  <option value="CLOSURE">Counter Closed</option>
                  <option value="SPECIAL_HOURS">Special Hours</option>
                </select>
              </div>
              {exceptionType === "SPECIAL_HOURS" ? (
                <div className="flex items-center gap-2">
                  <div>
                    <label className="block font-bold text-navy-900 mb-1">Open</label>
                    <input
                      type="time"
                      value={exceptionOpen}
                      onChange={(e) => setExceptionOpen(e.target.value)}
                      className="w-full rounded-lg border border-sand-300 px-2 py-1.5 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-navy-900 mb-1">Close</label>
                    <input
                      type="time"
                      value={exceptionClose}
                      onChange={(e) => setExceptionClose(e.target.value)}
                      className="w-full rounded-lg border border-sand-300 px-2 py-1.5 bg-white font-mono"
                    />
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-navy-500 pb-2">
                  No bookings accepted on closed dates.
                </div>
              )}
              <div>
                <label className="block font-bold text-navy-900 mb-1">Reason / Holiday</label>
                <input
                  type="text"
                  value={exceptionReason}
                  onChange={(e) => setExceptionReason(e.target.value)}
                  placeholder="e.g. Poya Day"
                  className="w-full rounded-lg border border-sand-300 px-2.5 py-1.5 bg-white"
                />
              </div>
              <button
                type="submit"
                disabled={addExceptionMutation.isPending}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-navy-900 hover:bg-navy-800 text-white font-bold disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Exception</span>
              </button>
            </form>

            {exceptions.length === 0 ? (
              <p className="text-xs text-navy-500">No upcoming holiday or closure exceptions configured.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {exceptions.map((ex) => (
                  <div
                    key={ex.id}
                    className="p-3.5 rounded-xl bg-sand-50 border border-sand-200 flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-navy-900">
                          {ex.reason || ex.exceptionDate}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            ex.exceptionType === "CLOSURE"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {ex.exceptionType === "CLOSURE" ? "Closed" : "Special Hours"}
                        </span>
                      </div>
                      <p className="text-navy-600 text-[11px]">
                        {ex.exceptionDate}
                        {ex.openTime && ex.closeTime ? ` • ${ex.openTime} – ${ex.closeTime}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={deleteExceptionMutation.isPending}
                      onClick={() => void handleDeleteException(ex.id)}
                      className="p-1.5 rounded-lg text-red-700 hover:bg-red-50"
                      aria-label={`Delete exception ${ex.exceptionDate}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-sand-50 border border-sand-200 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-navy-900">Unduvap Full Moon Poya</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                  Special Hours
                </span>
              </div>
              <p className="text-navy-600 text-[11px]">23 December 2026 • 08:00 – 18:00 IST</p>
            </div>
            <div className="p-3.5 rounded-xl bg-sand-50 border border-sand-200 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-navy-900">Duruthu Full Moon Poya</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  Normal Hours
                </span>
              </div>
              <p className="text-navy-600 text-[11px]">22 January 2027 • 06:00 – 23:00 IST</p>
            </div>
            <div className="p-3.5 rounded-xl bg-sand-50 border border-sand-200 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-navy-900">National Independence Day</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                  Closed
                </span>
              </div>
              <p className="text-navy-600 text-[11px]">04 February 2027 • Counter Closed</p>
            </div>
            <div className="p-3.5 rounded-xl bg-sand-50 border border-sand-200 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-navy-900">Navam Full Moon Poya</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                  Special Hours
                </span>
              </div>
              <p className="text-navy-600 text-[11px]">20 February 2027 • 08:00 – 18:00 IST</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
