"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const MESSAGES: Record<string, { heading: string; body: string; color: string }> = {
  better: {
    heading: "Great to hear you're feeling better!",
    body: "Thanks for letting us know. Your consultation has been marked as resolved. If you need care again in the future, Nightingale is here for you.",
    color: "bg-emerald-50 border-emerald-200 text-emerald-800",
  },
  same: {
    heading: "Thanks for your response",
    body: "We've recorded that your symptoms are about the same. If things don't improve in the next day or two, we recommend booking an in-person appointment with a GP.",
    color: "bg-blue-50 border-blue-200 text-blue-800",
  },
  worse: {
    heading: "We're sorry to hear that",
    body: "We've flagged your consultation and a doctor will review it shortly. In the meantime, if your symptoms are severe or you're worried, please seek urgent in-person care or call 000.",
    color: "bg-amber-50 border-amber-200 text-amber-800",
  },
};

function ConfirmedContent() {
  const params = useSearchParams();
  const response = params.get("response") ?? "";
  const msg = MESSAGES[response];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <img
          src="/logo.png"
          alt="Nightingale Health"
          className="h-8 mx-auto mb-6"
        />
        {msg ? (
          <div className={`rounded-lg border p-5 mb-6 text-left ${msg.color}`}>
            <h1 className="font-semibold text-lg mb-2">{msg.heading}</h1>
            <p className="text-sm">{msg.body}</p>
          </div>
        ) : (
          <p className="text-gray-600 mb-6">Your response has been recorded.</p>
        )}
        <p className="text-xs text-gray-400 mt-6">
          This advice is not a substitute for in-person medical care.
          For emergencies, call <strong>000</strong>.
          HealthDirect: 1800 022 222
        </p>
      </div>
    </div>
  );
}

export default function FollowUpConfirmedPage() {
  return (
    <Suspense>
      <ConfirmedContent />
    </Suspense>
  );
}
