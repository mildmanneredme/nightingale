import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Nightingale",
  description: "How Nightingale Health collects, uses, and protects your personal and health information.",
};

export default function PrivacyPage() {
  return (
    <section className="max-w-4xl mx-auto px-6 py-16 md:py-20">
      {/* Legal review banner */}
      <div className="mb-10 bg-error-container border border-error/20 rounded-xl px-5 py-4 text-sm text-on-error-container">
        <strong>⚠️ Draft — Requires legal review before public launch.</strong> This document is a placeholder and has not been reviewed by a solicitor. It must be reviewed and approved by a qualified Australian privacy lawyer before Nightingale launches publicly.
      </div>

      <h1 className="font-display text-4xl font-bold text-primary mb-2">Privacy Policy</h1>
      <p className="text-on-surface-variant mb-10">Last updated: April 2026</p>

      <div className="prose prose-slate max-w-none space-y-10 text-on-surface">

        <section>
          <h2 className="font-display text-xl font-bold text-primary mb-3">Overview</h2>
          <p className="text-on-surface-variant leading-relaxed">
            Nightingale Health Pty Ltd (&ldquo;Nightingale&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) operates a telehealth platform connecting patients with AHPRA-registered medical practitioners. We are committed to protecting your personal and health information in accordance with the <em>Privacy Act 1988</em> (Cth) and the Australian Privacy Principles (APPs).
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-primary mb-3">Information we collect</h2>
          <p className="text-on-surface-variant leading-relaxed mb-3">We collect the following categories of information:</p>
          <ul className="list-disc pl-5 space-y-2 text-on-surface-variant">
            <li><strong>Identity and contact:</strong> Name, email address, date of birth</li>
            <li><strong>Health information:</strong> Symptoms, medical history, current medications, allergies, chronic conditions, and any information you share during a consultation</li>
            <li><strong>Photos:</strong> Medical images you upload as part of your consultation (EXIF metadata is stripped before storage)</li>
            <li><strong>Device and usage:</strong> IP address, device type, browser, session data (for security and service improvement)</li>
            <li><strong>Communication:</strong> Email correspondence with our support team</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-primary mb-3">How we use your information</h2>
          <p className="text-on-surface-variant leading-relaxed mb-3">We use your information to:</p>
          <ul className="list-disc pl-5 space-y-2 text-on-surface-variant">
            <li>Provide the telehealth consultation service, including presenting your case to reviewing GPs</li>
            <li>Send you consultation responses, follow-up check-ins, and service notifications</li>
            <li>Maintain your secure health record</li>
            <li>Comply with our legal and regulatory obligations, including AHPRA audit requirements</li>
            <li>Improve the safety and quality of our service (aggregated, de-identified analysis only)</li>
          </ul>
          <p className="text-on-surface-variant leading-relaxed mt-3">
            We do <strong>not</strong> use your health information for advertising, sell it to third parties, or share it with any party not involved in your care without your consent.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-primary mb-3">Third parties</h2>
          <p className="text-on-surface-variant leading-relaxed mb-3">We share data with the following service providers solely to operate the platform:</p>
          <ul className="list-disc pl-5 space-y-2 text-on-surface-variant">
            <li><strong>Amazon Web Services (AWS):</strong> Cloud infrastructure and data storage (ap-southeast-2, Sydney)</li>
            <li><strong>AWS Cognito:</strong> Authentication and identity management</li>
            <li><strong>SendGrid (Twilio):</strong> Transactional email delivery</li>
            <li><strong>Stripe:</strong> Payment processing (when billing is active)</li>
            <li><strong>Google (Gemini API):</strong> Voice interview processing</li>
            <li><strong>Anthropic (Claude API via AWS Bedrock):</strong> Clinical summary generation</li>
          </ul>
          <p className="text-on-surface-variant leading-relaxed mt-3">All third-party providers are required to handle your data in accordance with applicable privacy laws and our data processing agreements.</p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-primary mb-3">Data storage and security</h2>
          <p className="text-on-surface-variant leading-relaxed">
            Your data is stored in AWS Sydney (ap-southeast-2) and never transferred outside Australia without your explicit consent. All health records and photos are encrypted at rest using AES-256 and in transit using TLS 1.3. Access is restricted to authorised personnel and your assigned GP.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-primary mb-3">Data retention</h2>
          <p className="text-on-surface-variant leading-relaxed">
            We retain your health records for a minimum of 7 years from the date of your last consultation, in accordance with Australian medical record retention requirements. After this period, records are securely deleted.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-primary mb-3">Your rights</h2>
          <p className="text-on-surface-variant leading-relaxed mb-3">Under the Privacy Act 1988 and APPs, you have the right to:</p>
          <ul className="list-disc pl-5 space-y-2 text-on-surface-variant">
            <li>Access the personal information we hold about you</li>
            <li>Request correction of inaccurate information</li>
            <li>Request deletion of your account and non-clinical data (subject to our retention obligations)</li>
            <li>Lodge a complaint with the Office of the Australian Information Commissioner (OAIC)</li>
          </ul>
          <p className="text-on-surface-variant leading-relaxed mt-3">
            To exercise these rights, contact us at <a href="mailto:privacy@nightingale.health" className="text-secondary underline">privacy@nightingale.health</a>.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-primary mb-3">Contact</h2>
          <p className="text-on-surface-variant leading-relaxed">
            Privacy Officer, Nightingale Health Pty Ltd<br />
            Email: <a href="mailto:privacy@nightingale.health" className="text-secondary underline">privacy@nightingale.health</a>
          </p>
        </section>
      </div>
    </section>
  );
}
