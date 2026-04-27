"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ApiError,
  getLlmCostByConsultation,
  getLlmCostForConsultation,
  getLlmCostSummary,
  LlmCostByConsultation,
  LlmCostDetail,
  LlmCostSummary,
} from "@/lib/api";
import { useToast } from "@/hooks/useToast";
import { getErrorMessage } from "@/lib/errors";

const RANGE_PRESETS: Array<{ key: string; label: string; days: number | null }> = [
  { key: "1d", label: "Last 24h", days: 1 },
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "all", label: "All time", days: null },
];

function isoFromDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function fmtUsd(usd: string): string {
  const n = parseFloat(usd);
  if (n < 0.01) return `$${n.toFixed(6)}`;
  if (n < 10) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

export default function LlmCostsDashboard() {
  const { toast } = useToast();
  const [rangeKey, setRangeKey] = useState<string>("30d");
  const [summary, setSummary] = useState<LlmCostSummary | null>(null);
  const [byConsultation, setByConsultation] = useState<LlmCostByConsultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConsultation, setSelectedConsultation] = useState<string | null>(null);
  const [detail, setDetail] = useState<LlmCostDetail[] | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const range = useMemo(() => {
    const preset = RANGE_PRESETS.find((p) => p.key === rangeKey);
    if (!preset || preset.days === null) return undefined;
    return { from: isoFromDaysAgo(preset.days) };
  }, [rangeKey]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, c] = await Promise.all([
        getLlmCostSummary(range),
        getLlmCostByConsultation(range, 50, 0),
      ]);
      setSummary(s);
      setByConsultation(c.data);
    } catch (e: unknown) {
      const { title, detail } = e instanceof ApiError ? getErrorMessage(e.status) : getErrorMessage(0);
      toast.error(title, { detail, correlationId: e instanceof ApiError ? e.correlationId : undefined });
    } finally {
      setLoading(false);
    }
  }, [range, toast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const openDetail = useCallback(async (consultationId: string) => {
    setSelectedConsultation(consultationId);
    setDetail(null);
    setDetailLoading(true);
    try {
      const r = await getLlmCostForConsultation(consultationId);
      setDetail(r.data);
    } catch (e: unknown) {
      const { title, detail } = e instanceof ApiError ? getErrorMessage(e.status) : getErrorMessage(0);
      toast.error(title, { detail });
    } finally {
      setDetailLoading(false);
    }
  }, [toast]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">LLM Costs</h1>
          <p className="text-sm text-gray-500 mt-1">
            Token usage and spend across Claude (Anthropic/Bedrock) and Gemini.
          </p>
        </div>
        <div className="flex gap-1 bg-white rounded-lg border border-gray-200 p-1">
          {RANGE_PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => setRangeKey(p.key)}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                rangeKey === p.key
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {/* Headline totals */}
      <section className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Spend" value={summary ? fmtUsd(summary.totals.costUsd) : "—"} loading={loading} />
        <StatCard label="LLM Calls" value={summary ? summary.totals.calls.toLocaleString() : "—"} loading={loading} />
        <StatCard label="Input Tokens" value={summary ? fmtTokens(summary.totals.inputTokens) : "—"} loading={loading} />
        <StatCard label="Output Tokens" value={summary ? fmtTokens(summary.totals.outputTokens) : "—"} loading={loading} />
      </section>

      {/* Breakdown by model + by operation */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">By Model</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="text-left px-4 py-2">Model</th>
                <th className="text-right px-4 py-2">Calls</th>
                <th className="text-right px-4 py-2">In</th>
                <th className="text-right px-4 py-2">Out</th>
                <th className="text-right px-4 py-2">Cache</th>
                <th className="text-right px-4 py-2">Cost</th>
              </tr>
            </thead>
            <tbody>
              {summary?.byModel.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">No data in this range</td></tr>
              )}
              {summary?.byModel.map((m) => (
                <tr key={`${m.provider}-${m.modelId}`} className="border-t border-gray-100">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{m.modelId}</div>
                    <div className="text-xs text-gray-400">{m.provider}</div>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{m.callCount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{fmtTokens(m.inputTokens)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{fmtTokens(m.outputTokens)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{fmtTokens(m.cacheReadTokens)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmtUsd(m.costUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">By Operation</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="text-left px-4 py-2">Operation</th>
                <th className="text-right px-4 py-2">Calls</th>
                <th className="text-right px-4 py-2">Cost</th>
              </tr>
            </thead>
            <tbody>
              {summary?.byOperation.length === 0 && (
                <tr><td colSpan={3} className="text-center py-8 text-gray-400">No data in this range</td></tr>
              )}
              {summary?.byOperation.map((o) => (
                <tr key={o.operation} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-900">{o.operation}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{o.callCount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmtUsd(o.costUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Per-consultation table */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Cost per Consultation</h2>
          <span className="text-xs text-gray-400">Top 50 by spend</span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="text-left px-4 py-2">Consultation</th>
              <th className="text-left px-4 py-2">Type</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-right px-4 py-2">Calls</th>
              <th className="text-right px-4 py-2">In / Out</th>
              <th className="text-left px-4 py-2">Last call</th>
              <th className="text-right px-4 py-2">Cost</th>
            </tr>
          </thead>
          <tbody>
            {!loading && byConsultation.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">No tracked LLM calls in this range</td></tr>
            )}
            {byConsultation.map((c) => (
              <tr
                key={c.consultationId ?? "unattributed"}
                className={`border-t border-gray-100 hover:bg-gray-50 ${c.consultationId ? "cursor-pointer" : "cursor-default"}`}
                onClick={() => c.consultationId && openDetail(c.consultationId)}
              >
                <td className="px-4 py-3">
                  <div className="font-mono text-xs text-gray-900">
                    {c.consultationId ? c.consultationId.slice(0, 8) : "—"}
                  </div>
                  <div className="text-xs text-gray-500 truncate max-w-xs">
                    {c.presentingComplaint ?? "—"}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-700">{c.consultationType ?? "—"}</td>
                <td className="px-4 py-3 text-gray-700">{c.status ?? "—"}</td>
                <td className="px-4 py-3 text-right text-gray-700">{c.callCount}</td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {fmtTokens(c.inputTokens)} / {fmtTokens(c.outputTokens)}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{fmtTime(c.lastCallAt)}</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmtUsd(c.costUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Detail drawer */}
      {selectedConsultation && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedConsultation(null)}
        >
          <div
            className="bg-white rounded-xl max-w-3xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Consultation Detail</h3>
                <p className="font-mono text-xs text-gray-500">{selectedConsultation}</p>
              </div>
              <button
                onClick={() => setSelectedConsultation(null)}
                className="text-gray-400 hover:text-gray-700 text-xl"
              >
                ×
              </button>
            </div>
            <div className="p-5">
              {detailLoading && <p className="text-sm text-gray-500">Loading…</p>}
              {detail && detail.length === 0 && (
                <p className="text-sm text-gray-500">No tracked LLM calls for this consultation.</p>
              )}
              {detail && detail.length > 0 && (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="text-left px-3 py-2">When</th>
                      <th className="text-left px-3 py-2">Operation</th>
                      <th className="text-left px-3 py-2">Model</th>
                      <th className="text-right px-3 py-2">In</th>
                      <th className="text-right px-3 py-2">Out</th>
                      <th className="text-right px-3 py-2">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.map((row) => (
                      <tr key={row.id} className="border-t border-gray-100">
                        <td className="px-3 py-2 text-xs text-gray-500">{fmtTime(row.createdAt)}</td>
                        <td className="px-3 py-2 text-gray-700">{row.operation}</td>
                        <td className="px-3 py-2">
                          <div className="text-gray-900">{row.modelId}</div>
                          <div className="text-xs text-gray-400">{row.provider}</div>
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700">{fmtTokens(row.inputTokens)}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{fmtTokens(row.outputTokens)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-900">{fmtUsd(row.costUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  loading,
}: { label: string; value: string; loading?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">{label}</p>
      {loading ? (
        <div className="h-9 w-24 bg-gray-100 rounded animate-pulse" />
      ) : (
        <p className="text-3xl font-bold text-gray-900">{value}</p>
      )}
    </div>
  );
}
