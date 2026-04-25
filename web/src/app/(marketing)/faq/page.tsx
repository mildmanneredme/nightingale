"use client";
import { useState } from "react";
import Link from "next/link";

type FaqItem = { q: string; a: string };

const categories: { label: string; items: FaqItem[] }[] = [
  {
    label: "About the service",
    items: [
      {
        q: "What is Nightingale?",
        a: "Nightingale is an AI-assisted telehealth platform that connects you with AHPRA-registered Australian GPs. You share your symptoms through an AI-guided interview, and a real doctor reviews and approves every response before you receive it.",
      },
      {
        q: "Is it a real doctor reviewing my case?",
        a: "Yes, always. Every consultation is personally reviewed by an AHPRA-registered GP before any response reaches you. The AI prepares a clinical summary — the doctor makes the call.",
      },
      {
        q: "How long does a consultation take?",
        a: "The AI interview takes around 5–10 minutes. Doctor review typically completes within a few hours, often sooner depending on doctor availability.",
      },
      {
        q: "What conditions can you help with?",
        a: "Currently: upper respiratory tract infections, urinary tract infections, skin concerns, musculoskeletal complaints, and mental health support. We expand our clinical scope regularly. If your condition is outside scope, your consultation will be declined and you won't be charged.",
      },
      {
        q: "Can I get a prescription through Nightingale?",
        a: "Reviewing GPs can recommend medication as appropriate. Prescription renewals for existing non-controlled medications are also supported. We cannot issue prescriptions for controlled substances (Schedule 8 drugs).",
      },
    ],
  },
  {
    label: "Safety & trust",
    items: [
      {
        q: "Is my health data secure?",
        a: "Yes. All health records and photos are encrypted at rest (AES-256) and in transit (TLS 1.3). Your data is stored in AWS Sydney (ap-southeast-2) and never leaves Australia.",
      },
      {
        q: "Who can see my information?",
        a: "Your assigned reviewing GP sees your full case — symptoms, history, photos, and the AI summary. Nightingale staff may access records for clinical governance and safety auditing. Your data is never sold or used for advertising.",
      },
      {
        q: "What happens if the doctor rejects my consultation?",
        a: "If a GP determines your case is outside our clinical scope or requires in-person care, they will reject the consultation. You will receive guidance on the most appropriate next step, and you will not be charged.",
      },
      {
        q: "What about emergency conditions?",
        a: "Nightingale is not for emergencies. If you are experiencing a medical emergency, call 000 immediately. We screen for emergency red flags during the consultation and will direct you to call 000 if any are detected.",
      },
    ],
  },
  {
    label: "Using the service",
    items: [
      {
        q: "Do I need to create an account?",
        a: "Yes. You'll need to register with a valid email address and complete a brief medical history before your first consultation. This ensures your GP has the context needed to provide safe, personalised advice.",
      },
      {
        q: "What do I need for a voice consultation?",
        a: "A device with a working microphone and a stable internet connection. We recommend a quiet environment. If voice isn't possible, text-based consultation is available as a fallback.",
      },
      {
        q: "Can I upload photos?",
        a: "Yes. If your condition is visible (rash, wound, skin concern), you can upload up to 5 photos. We check image quality automatically and strip all location metadata before storage.",
      },
      {
        q: "Will I get a medical certificate?",
        a: "Medical certificates may be provided at the reviewing GP's discretion as part of their written response. This is not guaranteed for every consultation.",
      },
    ],
  },
  {
    label: "Pricing & billing",
    items: [
      {
        q: "How much does it cost?",
        a: "Consultations are $50 AUD per session. During our beta period, consultations are free while we onboard our initial cohort of GP partners.",
      },
      {
        q: "Is Nightingale Medicare-rebatable?",
        a: "Not currently. Nightingale consultations are out-of-pocket at $50 AUD. Medicare bulk billing is on our Phase 2 roadmap.",
      },
      {
        q: "What if I'm not satisfied?",
        a: "If your consultation is declined by the reviewing GP, you will not be charged. For other concerns, contact us at hello@nightingale.health and we'll work to make it right.",
      },
    ],
  },
  {
    label: "Our doctors",
    items: [
      {
        q: "Are these real, qualified doctors?",
        a: "Yes. All Nightingale doctors are AHPRA-registered medical practitioners. We verify registration against the national AHPRA register before any doctor joins our platform.",
      },
      {
        q: "How are doctors vetted?",
        a: "Doctors must hold current AHPRA registration, hold professional indemnity insurance that covers AI-assisted telehealth, and complete our onboarding process including a clinical governance review.",
      },
      {
        q: "Can I request a specific doctor?",
        a: "Not currently. Consultations are assigned to available qualified GPs. We're exploring continuity of care features (same doctor for follow-ups) on our roadmap.",
      },
    ],
  },
];

function AccordionItem({ q, a }: FaqItem) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-outline-variant/50 rounded-xl overflow-hidden">
      <button
        className="w-full text-left px-6 py-5 flex items-start justify-between gap-4 bg-surface-container-lowest hover:bg-surface-container-low transition-colors"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="font-display font-semibold text-primary">{q}</span>
        <svg
          className={`flex-shrink-0 mt-0.5 transition-transform ${open ? "rotate-180" : ""}`}
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>
      {open && (
        <div className="px-6 py-5 bg-surface-container-lowest border-t border-outline-variant/50">
          <p className="text-on-surface-variant leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}

export default function FaqPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-surface-container-low border-b border-outline-variant">
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-20 text-center">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-primary mb-5">
            Frequently asked questions
          </h1>
          <p className="text-on-surface-variant text-lg max-w-xl mx-auto">
            Everything you need to know about how Nightingale works.
          </p>
        </div>
      </section>

      {/* FAQ categories */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="max-w-3xl mx-auto space-y-14">
          {categories.map(({ label, items }) => (
            <div key={label}>
              <h2 className="font-display text-xl font-bold text-primary mb-5">{label}</h2>
              <div className="space-y-3">
                {items.map((item) => (
                  <AccordionItem key={item.q} {...item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Still have questions */}
      <section className="bg-surface-container-low border-t border-outline-variant">
        <div className="max-w-6xl mx-auto px-6 py-16 text-center">
          <h2 className="font-display text-2xl font-bold text-primary mb-4">Still have a question?</h2>
          <p className="text-on-surface-variant mb-8 max-w-md mx-auto">
            Email us and we&apos;ll get back to you promptly.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="mailto:hello@nightingale.health"
              className="inline-flex items-center gap-2 px-8 py-4 bg-secondary text-on-secondary font-semibold rounded-full hover:bg-secondary/90 transition-colors"
            >
              Contact us
            </a>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-8 py-4 border border-outline-variant text-primary font-semibold rounded-full hover:bg-surface-container-low transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
