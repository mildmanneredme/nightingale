"use client";
import { useEffect, useState } from "react";
import {
  getDoctorSchedule,
  updateDoctorSchedule,
  addDateOverride,
  removeDateOverride,
  getCapacityStats,
  DoctorSchedule,
  CapacityStats,
  AvailabilityWindow,
  DateOverride,
} from "@/lib/api";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DEFAULT_WINDOW: AvailabilityWindow = { day: 1, start_time: "08:00", end_time: "18:00" };

function CapacityBar({ pct }: { pct: number }) {
  const color =
    pct >= 100 ? "bg-error" : pct >= 80 ? "bg-tertiary" : "bg-secondary";
  return (
    <div className="w-full bg-surface-container rounded-full h-3">
      <div
        className={`${color} h-3 rounded-full transition-all`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

export default function SchedulePage() {
  const [schedule, setSchedule] = useState<DoctorSchedule | null>(null);
  const [capacity, setCapacity] = useState<CapacityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // Override form state
  const [overrideDate, setOverrideDate] = useState("");
  const [overrideAvailable, setOverrideAvailable] = useState(false);
  const [overrideNote, setOverrideNote] = useState("");
  const [addingOverride, setAddingOverride] = useState(false);

  useEffect(() => {
    Promise.all([getDoctorSchedule(), getCapacityStats()])
      .then(([s, c]) => {
        setSchedule(s);
        setCapacity(c);
      })
      .finally(() => setLoading(false));
  }, []);

  async function saveSchedule(updated: Partial<Pick<DoctorSchedule, "weeklyWindows" | "dailyCap">>) {
    if (!schedule) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const result = await updateDoctorSchedule(updated);
      setSchedule((prev) =>
        prev
          ? { ...prev, weeklyWindows: result.weeklyWindows, dailyCap: result.dailyCap }
          : prev
      );
      setSaveMsg("Saved");
    } catch {
      setSaveMsg("Save failed");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 2000);
    }
  }

  function toggleDay(day: number) {
    if (!schedule) return;
    const existing = schedule.weeklyWindows.find((w) => w.day === day);
    let updated: AvailabilityWindow[];
    if (existing) {
      updated = schedule.weeklyWindows.filter((w) => w.day !== day);
    } else {
      updated = [...schedule.weeklyWindows, { day, start_time: "08:00", end_time: "18:00" }];
    }
    updated.sort((a, b) => a.day - b.day);
    const newSchedule = { ...schedule, weeklyWindows: updated };
    setSchedule(newSchedule);
    saveSchedule({ weeklyWindows: updated });
  }

  function updateWindowTime(day: number, field: "start_time" | "end_time", value: string) {
    if (!schedule) return;
    const updated = schedule.weeklyWindows.map((w) =>
      w.day === day ? { ...w, [field]: value } : w
    );
    setSchedule({ ...schedule, weeklyWindows: updated });
  }

  async function saveWindowTime() {
    if (!schedule) return;
    await saveSchedule({ weeklyWindows: schedule.weeklyWindows });
  }

  async function handleAddOverride() {
    if (!overrideDate) return;
    setAddingOverride(true);
    try {
      const added = await addDateOverride({
        date: overrideDate,
        available: overrideAvailable,
        note: overrideNote || undefined,
      });
      setSchedule((prev) =>
        prev
          ? {
              ...prev,
              overrides: [...prev.overrides.filter((o) => o.date !== overrideDate), {
                date: added.date,
                available: added.available,
                note: added.note,
              }].sort((a, b) => a.date.localeCompare(b.date)),
            }
          : prev
      );
      setOverrideDate("");
      setOverrideNote("");
    } finally {
      setAddingOverride(false);
    }
  }

  async function handleRemoveOverride(date: string) {
    await removeDateOverride(date);
    setSchedule((prev) =>
      prev ? { ...prev, overrides: prev.overrides.filter((o) => o.date !== date) } : prev
    );
  }

  if (loading) {
    return <div className="py-stack-lg text-on-surface-variant">Loading…</div>;
  }
  if (!schedule) return null;

  return (
    <div className="py-stack-lg max-w-2xl">
      <h1 className="font-display text-headline-md text-on-surface mb-8">Schedule & Availability</h1>

      {/* Capacity widget */}
      {capacity && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-title-lg text-on-surface">Monthly Capacity</h2>
            <span className={`text-label-md font-bold ${capacity.utilisationPct >= 80 ? "text-error" : "text-secondary"}`}>
              {capacity.utilisationPct}%
            </span>
          </div>
          <CapacityBar pct={capacity.utilisationPct} />
          <p className="text-body-sm text-on-surface-variant mt-2">
            {capacity.reviewedThisMonth} of ~{capacity.monthlyCapEstimate} consultations this month
          </p>
          {capacity.utilisationPct >= 80 && (
            <p className="text-body-sm text-error mt-2 font-medium">
              Approaching capacity — consider adding a second GP
            </p>
          )}
          <div className="flex gap-6 mt-4 pt-4 border-t border-outline-variant">
            <div>
              <p className="text-clinical-data text-on-surface-variant">Today</p>
              <p className="text-body-md text-on-surface font-semibold">
                {capacity.todayReviewCount} / {capacity.dailyCap}
                {capacity.dailyCapHit && <span className="text-error ml-2 text-label-md">(Cap reached)</span>}
              </p>
            </div>
            <div>
              <p className="text-clinical-data text-on-surface-variant">Daily Cap</p>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={schedule.dailyCap}
                  onChange={(e) => setSchedule({ ...schedule, dailyCap: Number(e.target.value) })}
                  onBlur={() => saveSchedule({ dailyCap: schedule.dailyCap })}
                  className="w-16 border border-outline rounded px-2 py-1 text-body-md text-on-surface bg-surface-container-lowest"
                />
                <span className="text-body-sm text-on-surface-variant">consultations/day</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Weekly schedule */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-title-lg text-on-surface">Weekly Schedule</h2>
          {saveMsg && (
            <span className={`text-label-md ${saveMsg === "Saved" ? "text-secondary" : "text-error"}`}>
              {saveMsg}
            </span>
          )}
        </div>
        <p className="text-body-sm text-on-surface-variant mb-4">
          All times in AEST (Sydney). Toggle days on/off and set review hours.
        </p>

        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6, 0].map((day) => {
            const window = schedule.weeklyWindows.find((w) => w.day === day);
            const active = !!window;
            return (
              <div key={day} className="flex items-center gap-4">
                <button
                  onClick={() => toggleDay(day)}
                  className={`w-16 text-center text-label-md py-1.5 rounded-full transition-colors ${
                    active
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container text-on-surface-variant"
                  }`}
                >
                  {DAY_NAMES[day]}
                </button>
                {active && window ? (
                  <div className="flex items-center gap-2 text-body-md text-on-surface">
                    <input
                      type="time"
                      value={window.start_time}
                      onChange={(e) => updateWindowTime(day, "start_time", e.target.value)}
                      onBlur={saveWindowTime}
                      className="border border-outline rounded px-2 py-1 text-body-sm bg-surface-container-lowest"
                    />
                    <span className="text-on-surface-variant">to</span>
                    <input
                      type="time"
                      value={window.end_time}
                      onChange={(e) => updateWindowTime(day, "end_time", e.target.value)}
                      onBlur={saveWindowTime}
                      className="border border-outline rounded px-2 py-1 text-body-sm bg-surface-container-lowest"
                    />
                  </div>
                ) : (
                  <span className="text-body-sm text-on-surface-variant">Unavailable</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Date overrides */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
        <h2 className="font-display text-title-lg text-on-surface mb-4">Date Overrides</h2>
        <p className="text-body-sm text-on-surface-variant mb-4">
          Block specific dates (leave, public holidays) or add extra availability.
        </p>

        {/* Add override form */}
        <div className="flex flex-wrap gap-3 mb-6">
          <input
            type="date"
            value={overrideDate}
            onChange={(e) => setOverrideDate(e.target.value)}
            className="border border-outline rounded px-3 py-2 text-body-sm bg-surface-container-lowest"
            min={new Date().toISOString().slice(0, 10)}
          />
          <select
            value={overrideAvailable ? "available" : "blocked"}
            onChange={(e) => setOverrideAvailable(e.target.value === "available")}
            className="border border-outline rounded px-3 py-2 text-body-sm bg-surface-container-lowest"
          >
            <option value="blocked">Blocked (unavailable)</option>
            <option value="available">Extra availability</option>
          </select>
          <input
            type="text"
            placeholder="Note (optional)"
            value={overrideNote}
            onChange={(e) => setOverrideNote(e.target.value)}
            className="flex-1 min-w-32 border border-outline rounded px-3 py-2 text-body-sm bg-surface-container-lowest"
          />
          <button
            onClick={handleAddOverride}
            disabled={!overrideDate || addingOverride}
            className="bg-primary text-on-primary px-4 py-2 rounded text-label-md font-semibold disabled:opacity-50"
          >
            Add
          </button>
        </div>

        {/* Existing overrides */}
        {schedule.overrides.length === 0 ? (
          <p className="text-body-sm text-on-surface-variant">No overrides set.</p>
        ) : (
          <div className="space-y-2">
            {schedule.overrides.map((o) => (
              <div
                key={o.date}
                className="flex items-center justify-between gap-3 bg-surface-container rounded-lg px-4 py-2"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      o.available ? "bg-secondary" : "bg-error"
                    }`}
                  />
                  <span className="text-body-md text-on-surface">
                    {new Date(o.date).toLocaleDateString("en-AU", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                  <span className="text-body-sm text-on-surface-variant">
                    {o.available ? "Extra availability" : "Blocked"}
                    {o.note ? ` — ${o.note}` : ""}
                  </span>
                </div>
                <button
                  onClick={() => handleRemoveOverride(o.date)}
                  className="text-on-surface-variant hover:text-error text-body-sm"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {saving && (
        <div className="fixed bottom-4 right-4 bg-surface-container-lowest border border-outline rounded-lg px-4 py-2 text-body-sm text-on-surface shadow">
          Saving…
        </div>
      )}
    </div>
  );
}
