import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Nightingale",
  description: "Terms governing your use of the Nightingale telehealth platform.",
};

export default function TermsPage() {
  return (
    <section className="max-w-4xl mx-auto px-6 py-16 md:py-20">
      {/* Legal review banner */}
      <div className="mb-10 bg-error-container border border-error/20 rounded-xl px-5 py-4 text-sm text-on-error-container">
        <strong>⚠️ Draft — Requires legal review before public launch.</strong> This document is a placeholder and has not been reviewed by a solicitor. It must be reviewed and approved by a qualified Australian lawyer before Nightingale launches publicly.
      </div>

      <h1 className="font-display text-4xl font-bold text-primary mb-2">Terms of Service</h1>
      <p className="text-on-surface-variant mb-10">Last updated: April 2026</p>

      <div className="space-y-10 text-on-surface">

        <section>
          <h2 className="font-display text-xl font-bold text-primary mb-3">1. About this agreement</h2>
          <p className="text-on-surface-variant leading-relaxed">
            These Terms of Service (&ldquo;Terms&rdquo;) govern your use of the Nightingale telehealth platform operated by Nightingale Health Pty Ltd (&ldquo;Nightingale&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). By creating an account or using our service, you agree to these Terms. If you do not agree, do not use the service.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-primary mb-3">2. Service description</h2>
          <p className="text-on-surface-variant leading-relaxed">
            Nightingale provides an AI-assisted telehealth platform that facilitates asynchronous medical consultations between patients and AHPRA-registered general practitioners. The platform:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-on-surface-variant mt-3">
            <li>Collects patient symptoms and history through an AI-guided interview</li>
            <li>Prepares a clinical summary for review by a registered GP</li>
            <li>Delivers a written, doctor-approved response to the patient</li>
          </ul>
          <p className="text-on-surface-variant leading-relaxed mt-3">
            Nightingale is an asynchronous telehealth service, not a synchronous (real-time) consultation. Response times are not guaranteed.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-primary mb-3">3. Medical limitations</h2>
          <div className="bg-error-container border border-error/20 rounded-xl p-5 mb-4">
            <p className="text-on-error-container font-semibold">
              Nightingale is NOT for medical emergencies. If you are experiencing a life-threatening situation, call <strong>000</strong> immediately.
            </p>
          </div>
          <p className="text-on-surface-variant leading-relaxed">
            The assessments and recommendations provided through Nightingale are not a substitute for in-person medical care. Nightingale provides <strong>assessments</strong>, not diagnoses. Reviewing GPs may recommend — but not guarantee — appropriate treatment pathways. You should always seek in-person care for serious, worsening, or emergency conditions.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-primary mb-3">4. Eligibility</h2>
          <p className="text-on-surface-variant leading-relaxed">
            You must be 18 years or older to use Nightingale independently. Patients under 18 may only use the platform with the active participation of a parent or legal guardian. You must be located in Australia at the time of each consultation.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-primary mb-3">5. Fees and refunds</h2>
          <p className="text-on-surface-variant leading-relaxed">
            Consultations are charged at $50 AUD per session (pricing may be updated with notice). During the beta period, consultations are free. If a reviewing GP declines your consultation as outside clinical scope, you will not be charged. Refunds for other circumstances are assessed on a case-by-case basis.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-primary mb-3">6. Limitation of liability</h2>
          <p className="text-on-surface-variant leading-relaxed">
            To the maximum extent permitted by Australian law, Nightingale&apos;s liability for any claim arising from use of the platform is limited to the fees paid for the consultation giving rise to the claim. Nightingale is not liable for clinical decisions made by independent GP partners, delays in response, or harm arising from failure to seek emergency care.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-primary mb-3">7. Intellectual property</h2>
          <p className="text-on-surface-variant leading-relaxed">
            All platform software, design, and clinical knowledge base content is the intellectual property of Nightingale Health Pty Ltd. Medical advice delivered through the platform is the professional work product of the reviewing GP.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-primary mb-3">8. Termination</h2>
          <p className="text-on-surface-variant leading-relaxed">
            We reserve the right to suspend or terminate accounts that misuse the platform, provide false information, or use the service in ways that could endanger patient or public safety.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-primary mb-3">9. Governing law</h2>
          <p className="text-on-surface-variant leading-relaxed">
            These Terms are governed by the laws of New South Wales, Australia. Any disputes are subject to the exclusive jurisdiction of the courts of New South Wales.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-primary mb-3">10. Contact</h2>
          <p className="text-on-surface-variant leading-relaxed">
            Nightingale Health Pty Ltd<br />
            Email: <a href="mailto:hello@nightingale.health" className="text-secondary underline">hello@nightingale.health</a>
          </p>
        </section>
      </div>
    </section>
  );
}
