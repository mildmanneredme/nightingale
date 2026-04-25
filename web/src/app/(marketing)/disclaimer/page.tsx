import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Medical Disclaimer — Nightingale",
  description: "Important information about the limitations of the Nightingale telehealth service.",
};

export default function DisclaimerPage() {
  return (
    <>
      {/* Emergency strip */}
      <div className="bg-error px-4 py-3 text-center">
        <p className="text-base font-bold text-on-error">
          Medical emergency? Call{" "}
          <a href="tel:000" className="underline text-xl">000</a>{" "}
          immediately. Do not use this service in an emergency.
        </p>
      </div>

      <section className="max-w-4xl mx-auto px-6 py-16 md:py-20">
        <h1 className="font-display text-4xl font-bold text-primary mb-2">Medical Disclaimer</h1>
        <p className="text-on-surface-variant mb-10">Required by AHPRA advertising guidelines. Last updated: April 2026.</p>

        <div className="space-y-8 text-on-surface">

          <div className="bg-error-container border border-error/30 rounded-xl p-6">
            <h2 className="font-display text-lg font-bold text-on-error-container mb-3">
              Nightingale is not for emergencies
            </h2>
            <p className="text-on-error-container/90 leading-relaxed mb-4">
              Do not use Nightingale if you believe you or someone else may be in immediate danger. Call <strong>000</strong> for:
            </p>
            <ul className="space-y-2 text-on-error-container/90">
              {[
                "Chest pain, difficulty breathing, or suspected heart attack or stroke",
                "Severe allergic reaction (anaphylaxis)",
                "Serious injury, heavy bleeding, or loss of consciousness",
                "Sudden severe headache or confusion",
                "Thoughts of self-harm or suicide — call Lifeline on 13 11 14",
                "Any condition that feels immediately life-threatening",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="font-bold mt-0.5">→</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <section>
            <h2 className="font-display text-xl font-bold text-primary mb-3">Assessments, not diagnoses</h2>
            <p className="text-on-surface-variant leading-relaxed">
              Nightingale provides <strong>clinical assessments</strong> — not diagnoses. Reviewing GPs will assess your symptoms and provide their professional opinion on what your condition may be consistent with and what management steps are appropriate. This is not equivalent to a formal diagnosis and does not create a traditional doctor-patient relationship.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-primary mb-3">Not a substitute for in-person care</h2>
            <p className="text-on-surface-variant leading-relaxed">
              Advice received through Nightingale is not a substitute for in-person medical examination. A physical examination may be necessary to accurately assess your condition. If your symptoms are serious, worsening, or do not improve as expected, seek in-person care promptly.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-primary mb-3">Clinical scope limitations</h2>
            <p className="text-on-surface-variant leading-relaxed">
              Nightingale currently covers a defined set of common GP presentations. Conditions outside this scope will result in your consultation being declined. Your reviewing GP may also decline to provide advice if they determine that your situation requires in-person assessment to be safely managed.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-primary mb-3">Individual variation</h2>
            <p className="text-on-surface-variant leading-relaxed">
              Medical advice is personalised based on the information you provide. The accuracy and usefulness of that advice depends on you providing complete and accurate information. Nightingale and its GP partners cannot be held responsible for advice based on inaccurate or incomplete information.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-primary mb-3">Role of AI in our platform</h2>
            <p className="text-on-surface-variant leading-relaxed">
              Artificial intelligence is used to structure your consultation and prepare a clinical summary for review. AI is an assistive tool only — all clinical decisions are made by AHPRA-registered medical practitioners. No AI output reaches patients without explicit GP approval.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-primary mb-3">AHPRA advertising compliance</h2>
            <p className="text-on-surface-variant leading-relaxed">
              Nightingale Health Pty Ltd complies with the AHPRA Guidelines for advertising a regulated health service. Our marketing does not make claims to diagnose, cure, prevent, or treat any medical condition. We do not use testimonials that reference clinical outcomes.
            </p>
          </section>

          <div className="pt-4 border-t border-outline-variant">
            <p className="text-sm text-on-surface-variant">
              Questions about this disclaimer?{" "}
              <a href="mailto:hello@nightingale.health" className="text-secondary underline">hello@nightingale.health</a>
              {" · "}
              <Link href="/safety" className="text-secondary underline">Our safety model</Link>
              {" · "}
              <Link href="/faq" className="text-secondary underline">FAQ</Link>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
