import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — Nightingale",
  description: "Nightingale was built to make qualified GP advice available to every Australian, no matter where they are or what time it is.",
};

const principles = [
  {
    title: "Doctors always decide",
    description: "AI accelerates clinical work — it never replaces it. Every response is reviewed and approved by a registered GP before reaching any patient.",
  },
  {
    title: "Transparency over hype",
    description: "We are clear about what Nightingale can and cannot do. We assess — we don't diagnose. We recommend — we don't prescribe without clinical justification.",
  },
  {
    title: "Australian by design",
    description: "Built for Australian healthcare. AHPRA compliance, data residency in Sydney, and a roadmap toward Medicare integration.",
  },
  {
    title: "Privacy without compromise",
    description: "Your health data belongs to you. We encrypt everything, store it in Australia, and will never sell or exploit it.",
  },
];

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-primary">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
          <div className="max-w-2xl">
            <h1 className="font-display text-4xl md:text-5xl font-bold text-on-primary mb-6 leading-tight">
              We built Nightingale because getting medical advice shouldn&apos;t take two weeks.
            </h1>
            <p className="text-on-primary/80 text-lg md:text-xl leading-relaxed">
              In Australia, 1 in 3 people report delaying medical care due to long wait times or cost. We think that&apos;s fixable — with the right technology, in the right hands.
            </p>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="font-display text-3xl font-bold text-primary mb-5">The problem we&apos;re solving</h2>
            <div className="space-y-4 text-on-surface-variant leading-relaxed">
              <p>
                Australia has one of the best healthcare systems in the world — but accessing it has become a bottleneck. The average GP appointment wait time in metro areas is 1–2 weeks. In regional and remote areas, it can be much longer.
              </p>
              <p>
                After-hours clinics are expensive and inconvenient. Emergency departments are overwhelmed with presentations that don&apos;t need emergency care. And a growing number of Australians — particularly younger people and those in rural areas — are turning to unverified internet searches instead of getting real medical advice.
              </p>
              <p>
                Nightingale exists to bridge that gap. Not to replace GPs — to extend them.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { stat: "1–2 weeks", label: "Average GP wait time in metro Australia" },
              { stat: "26M+", label: "Australians who need better access to care" },
              { stat: "40%", label: "Of after-hours presentations are non-emergency" },
              { stat: "$0", label: "Additional clinic infrastructure required" },
            ].map(({ stat, label }) => (
              <div key={label} className="bg-surface-container-low rounded-xl p-6 text-center border border-outline-variant/50">
                <div className="font-display font-bold text-3xl text-secondary mb-2">{stat}</div>
                <div className="text-xs text-on-surface-variant leading-tight">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Approach */}
      <section className="bg-surface-container-low border-y border-outline-variant">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <h2 className="font-display text-3xl font-bold text-primary mb-4">Our approach</h2>
            <p className="text-on-surface-variant text-lg">
              Pure AI telehealth scares us too. So does booking a GP appointment two weeks out for something that needs attention today. Nightingale is the middle path.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="text-center p-6">
              <div className="font-display font-bold text-lg text-on-surface-variant/40 line-through mb-2">Pure AI</div>
              <p className="text-sm text-on-surface-variant">Fast, but no clinical oversight. Regulatory grey area. Risks patient safety.</p>
            </div>
            <div className="bg-secondary rounded-xl p-6 text-center">
              <div className="font-display font-bold text-lg text-on-secondary mb-2">Nightingale</div>
              <p className="text-sm text-on-secondary/80">AI-guided intake + mandatory GP review. Fast and safe. Best of both.</p>
            </div>
            <div className="text-center p-6">
              <div className="font-display font-bold text-lg text-on-surface-variant/40 line-through mb-2">Traditional telehealth</div>
              <p className="text-sm text-on-surface-variant">Doctor-only, no AI assist. Expensive and slow. Doesn&apos;t scale to meet demand.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Principles */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl font-bold text-primary mb-4">What we stand for</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {principles.map(({ title, description }) => (
            <div key={title} className="bg-surface-container-lowest rounded-xl p-6 shadow-card border border-outline-variant/50">
              <h3 className="font-display font-semibold text-lg text-primary mb-3">{title}</h3>
              <p className="text-on-surface-variant leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Built in Australia */}
      <section className="bg-surface-container-low border-y border-outline-variant">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-display text-3xl font-bold text-primary mb-5">Built in Australia, for Australians</h2>
            <div className="space-y-4 text-on-surface-variant leading-relaxed mb-8">
              <p>
                Every part of Nightingale is designed for the Australian healthcare context. Our servers live in AWS Sydney. Our doctors are AHPRA-registered. Our clinical scope is built around the most common presentations to Australian GPs.
              </p>
              <p>
                We&apos;re working toward Medicare integration in Phase 2, and a Southeast Asian expansion (Singapore, Malaysia) to follow. But our home market is Australia — and we&apos;re building here first.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {["AWS Sydney (ap-southeast-2)", "AHPRA compliance", "Australian Privacy Act 1988", "Medicare roadmap"].map((tag) => (
                <span key={tag} className="text-sm font-medium text-secondary bg-secondary/10 px-4 py-2 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <h2 className="font-display text-3xl font-bold text-primary mb-4">Get in touch</h2>
        <p className="text-on-surface-variant text-lg mb-8 max-w-md mx-auto">
          Questions, feedback, or partnership enquiries — we&apos;d love to hear from you.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="mailto:hello@nightingale.health"
            className="inline-flex items-center gap-2 px-8 py-4 bg-secondary text-on-secondary font-semibold rounded-full hover:bg-secondary/90 transition-colors"
          >
            hello@nightingale.health
          </a>
          <Link
            href="/for-doctors"
            className="inline-flex items-center gap-2 px-8 py-4 border border-outline-variant text-primary font-semibold rounded-full hover:bg-surface-container-low transition-colors"
          >
            For doctors
          </Link>
        </div>
      </section>
    </>
  );
}
