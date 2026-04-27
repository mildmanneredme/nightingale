"use client";
import TopAppBar from "@/components/TopAppBar";
import BottomNavBar from "@/components/BottomNavBar";
import { useProfile } from "@/hooks/useProfile";

function Field({ id, label, value, onChange, type = "text", readOnly = false, note, placeholder }: {
  id: string;
  label: string;
  value: string;
  onChange?: (v: string) => void;
  type?: string;
  readOnly?: boolean;
  note?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="font-clinical-data text-label-sm text-on-surface-variant uppercase tracking-wider block">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        readOnly={readOnly}
        placeholder={placeholder}
        className={`w-full px-4 py-3 rounded-xl font-body-md transition-all ${
          readOnly
            ? "bg-surface-container border border-outline-variant/30 text-on-surface-variant cursor-default"
            : "bg-surface-container-lowest border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        }`}
      />
      {note && <p className="font-label-sm text-[11px] text-on-surface-variant">{note}</p>}
    </div>
  );
}

function SectionHeader({ title, description, completeness }: {
  title: string;
  description?: string;
  completeness?: { pct: number; filled: number; total: number };
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <h2 className="font-headline-md text-headline-md text-primary">{title}</h2>
        {completeness && (
          <span className="font-clinical-data text-secondary text-sm shrink-0">
            {completeness.pct}% &middot; {completeness.filled}/{completeness.total}
          </span>
        )}
      </div>
      {description && <p className="font-body-md text-on-surface-variant text-sm">{description}</p>}
      {completeness && (
        <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-secondary h-full rounded-full transition-all duration-500"
            style={{ width: `${completeness.pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

// Lightweight inline help — uses native browser tooltip via title for now;
// can be upgraded to a popover component without changing call sites.
function WhyWeAsk({ children }: { children: string }) {
  return (
    <span
      title={children}
      className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-surface-container text-on-surface-variant text-[11px] cursor-help align-middle ml-1"
    >
      ?
    </span>
  );
}

export default function ProfilePage() {
  const p = useProfile();

  return (
    <>
      <TopAppBar />

      <main className="pt-24 pb-20 md:pb-8 px-4 md:px-patient-margin max-w-2xl mx-auto">
        {/* Avatar header */}
        <div className="flex items-center gap-6 mb-stack-lg pb-stack-lg border-b border-outline-variant/30">
          <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-white text-2xl font-manrope font-bold shadow-lg">
            {p.initials}
          </div>
          <div>
            <h1 className="font-headline-lg text-headline-lg text-primary">{p.displayName}</h1>
            <p className="font-body-md text-on-surface-variant">{p.patient?.email}</p>
          </div>
        </div>

        {p.loading ? (
          <div className="flex items-center justify-center py-24 text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl animate-spin">progress_activity</span>
          </div>
        ) : (
          <form onSubmit={p.handleSubmit} className="space-y-6">

            {/* Personal details */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-card p-6">
              <SectionHeader title="Personal details" completeness={p.personalCompleteness} />
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field id="firstName" label="First name" value={p.firstName} onChange={p.setFirstName} />
                  <Field id="lastName" label="Last name" value={p.lastName} onChange={p.setLastName} />
                </div>
                <Field
                  id="preferredName"
                  label="Preferred name"
                  value={p.preferredName}
                  onChange={p.setPreferredName}
                  placeholder="What you'd like the doctor to call you"
                  note="Optional. Used in greetings instead of your first name."
                />
                <Field id="dateOfBirth" label="Date of birth" value={p.dateOfBirth} onChange={p.setDateOfBirth} type="date" />
                <div className="space-y-2">
                  <label htmlFor="biologicalSex" className="font-clinical-data text-label-sm text-on-surface-variant uppercase tracking-wider block">
                    Biological sex
                  </label>
                  <select
                    id="biologicalSex"
                    value={p.biologicalSex}
                    onChange={(e) => p.setBiologicalSex(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl font-body-md transition-all bg-surface-container-lowest border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">Select…</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="intersex">Intersex</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                  <p className="font-label-sm text-[11px] text-on-surface-variant">
                    Used by the doctor for clinical assessment (e.g. dosing, screening guidelines).
                  </p>
                </div>
                <Field id="phone" label="Phone number" value={p.phone} onChange={p.setPhone} type="tel" />
                <Field
                  id="email"
                  label="Email address"
                  value={p.patient?.email ?? ""}
                  readOnly
                  note="To change your email, contact support."
                />
              </div>
            </div>

            {/* Address & healthcare */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-card p-6">
              <SectionHeader
                title="Address & healthcare"
                description="Used for prescriptions, in-person referrals, and continuity of care with your usual GP."
                completeness={p.addressHealthcareCompleteness}
              />
              <div className="space-y-4">
                <Field
                  id="address"
                  label="Address"
                  value={p.address}
                  onChange={p.setAddress}
                  placeholder="Street, suburb, state, postcode"
                />
                <Field
                  id="medicareNumber"
                  label="Medicare number"
                  value={p.medicareNumber}
                  onChange={(v) => p.setMedicareNumber(v.replace(/\D/g, "").slice(0, 11))}
                  placeholder="10 or 11 digits"
                  note="Optional. We don't bulk-bill yet — kept on file for continuity of care."
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field id="gpName" label="Your usual GP" value={p.gpName} onChange={p.setGpName} placeholder="Dr Jane Smith" />
                  <Field id="gpClinic" label="Clinic name" value={p.gpClinic} onChange={p.setGpClinic} placeholder="Bondi Junction Medical" />
                </div>
              </div>
            </div>

            {/* Clinical baseline */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-card p-6">
              <SectionHeader
                title="Clinical baseline"
                description="The doctor and AI assistant use this to skip basic questions and to flag drug interactions or contraindications."
                completeness={p.baselineCompleteness}
              />

              {/* Allergies */}
              <BaselineList
                title="Allergies"
                why="Helps the doctor avoid prescribing anything you react to. Even mild allergies are worth listing."
                items={p.allergies.map((a) => ({
                  id: a.id,
                  label: a.severity ? `${a.name} (${a.severity})` : a.name,
                }))}
                onDelete={p.handleDeleteAllergy}
                noneLabel="No known allergies"
                none={p.allergiesNone}
                onNoneChange={p.setAllergiesNone}
                addRow={
                  <div className="flex flex-col md:flex-row gap-2">
                    <input
                      type="text"
                      value={p.newAllergy.name}
                      onChange={(e) => p.setNewAllergy({ ...p.newAllergy, name: e.target.value })}
                      placeholder="e.g. Penicillin"
                      className="flex-1 px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                    <select
                      value={p.newAllergy.severity}
                      onChange={(e) => p.setNewAllergy({ ...p.newAllergy, severity: e.target.value as typeof p.newAllergy.severity })}
                      className="px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="mild">Mild</option>
                      <option value="moderate">Moderate</option>
                      <option value="severe">Severe</option>
                    </select>
                    <button
                      type="button"
                      onClick={p.handleAddAllergy}
                      className="px-4 py-2 bg-secondary text-white font-manrope font-bold rounded-lg hover:opacity-90"
                    >
                      Add
                    </button>
                  </div>
                }
              />

              {/* Medications */}
              <BaselineList
                title="Current medications"
                why="Both prescribed and over-the-counter. Helps detect interactions and dosing conflicts."
                items={p.medications.map((m) => ({
                  id: m.id,
                  label: [m.name, m.dose, m.frequency].filter(Boolean).join(" — "),
                }))}
                onDelete={p.handleDeleteMedication}
                noneLabel="Not taking any regular medications"
                none={p.medicationsNone}
                onNoneChange={p.setMedicationsNone}
                addRow={
                  <div className="flex flex-col md:flex-row gap-2">
                    <input
                      type="text"
                      value={p.newMedication.name}
                      onChange={(e) => p.setNewMedication({ ...p.newMedication, name: e.target.value })}
                      placeholder="Name (e.g. Sertraline)"
                      className="flex-1 px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                    <input
                      type="text"
                      value={p.newMedication.dose}
                      onChange={(e) => p.setNewMedication({ ...p.newMedication, dose: e.target.value })}
                      placeholder="Dose"
                      className="md:w-32 px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                    <input
                      type="text"
                      value={p.newMedication.frequency}
                      onChange={(e) => p.setNewMedication({ ...p.newMedication, frequency: e.target.value })}
                      placeholder="Frequency"
                      className="md:w-40 px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={p.handleAddMedication}
                      className="px-4 py-2 bg-secondary text-white font-manrope font-bold rounded-lg hover:opacity-90"
                    >
                      Add
                    </button>
                  </div>
                }
              />

              {/* Conditions */}
              <BaselineList
                title="Known conditions"
                why="Diagnosed conditions or chronic issues your doctor knows about. Anchors the AI's clinical reasoning."
                items={p.conditions.map((c) => ({ id: c.id, label: c.name }))}
                onDelete={p.handleDeleteCondition}
                noneLabel="No diagnosed conditions"
                none={p.conditionsNone}
                onNoneChange={p.setConditionsNone}
                addRow={
                  <div className="flex flex-col md:flex-row gap-2">
                    <input
                      type="text"
                      value={p.newCondition}
                      onChange={(e) => p.setNewCondition(e.target.value)}
                      placeholder="e.g. Type 2 diabetes"
                      className="flex-1 px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={p.handleAddCondition}
                      className="px-4 py-2 bg-secondary text-white font-manrope font-bold rounded-lg hover:opacity-90"
                    >
                      Add
                    </button>
                  </div>
                }
              />
            </div>

            {/* Guardian section (paediatric only) */}
            {p.patient?.isPaediatric && (
              <div className="bg-white rounded-xl border border-slate-100 shadow-card p-6 space-y-4">
                <SectionHeader
                  title="Guardian / parent"
                  description="This account is registered for a minor. Keep guardian contact details current."
                />
                <Field id="guardianName" label="Guardian name" value={p.guardianName} onChange={p.setGuardianName} />
                <Field id="guardianEmail" label="Guardian email" value={p.guardianEmail} onChange={p.setGuardianEmail} type="email" />
                <Field
                  id="guardianRelationship"
                  label="Relationship to patient"
                  value={p.guardianRelationship}
                  onChange={p.setGuardianRelationship}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={p.saving}
              className="w-full bg-primary text-white font-manrope font-bold py-4 rounded-xl shadow-lg hover:bg-primary-container transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>save</span>
              {p.saving ? "Saving…" : "Save changes"}
            </button>

            <button
              type="button"
              onClick={p.handleSignOut}
              className="w-full flex items-center justify-center gap-2 text-on-surface-variant font-manrope font-bold py-3 rounded-xl hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-sm">logout</span>
              Sign out
            </button>
          </form>
        )}
      </main>

      <BottomNavBar active="profile" />
    </>
  );
}

// ---------------------------------------------------------------------------
// Reusable baseline category list with inline add + none-known toggle
// ---------------------------------------------------------------------------

function BaselineList({
  title,
  why,
  items,
  onDelete,
  noneLabel,
  none,
  onNoneChange,
  addRow,
}: {
  title: string;
  why: string;
  items: { id: string; label: string }[];
  onDelete: (id: string) => void;
  noneLabel: string;
  none: boolean;
  onNoneChange: (b: boolean) => void;
  addRow: React.ReactNode;
}) {
  return (
    <div className="mt-6 first:mt-0 border-t first:border-t-0 border-outline-variant/20 pt-6 first:pt-0">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="font-manrope font-bold text-primary">{title}</h3>
        <WhyWeAsk>{why}</WhyWeAsk>
      </div>

      {items.length > 0 && (
        <ul className="space-y-2 mb-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 px-3 py-2 bg-surface-container rounded-lg"
            >
              <span className="font-body-md text-on-surface text-sm">{item.label}</span>
              <button
                type="button"
                onClick={() => onDelete(item.id)}
                className="text-on-surface-variant hover:text-error transition-colors"
                title="Remove"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!none && <div className="mb-3">{addRow}</div>}

      <label className="flex items-center gap-2 cursor-pointer text-sm text-on-surface">
        <input
          type="checkbox"
          checked={none}
          onChange={(e) => onNoneChange(e.target.checked)}
          disabled={items.length > 0}
          className="w-4 h-4 rounded border-outline-variant accent-secondary cursor-pointer disabled:opacity-50"
        />
        <span className={items.length > 0 ? "text-on-surface-variant" : ""}>
          {noneLabel}{items.length > 0 && " (uncheck after removing the entries above)"}
        </span>
      </label>
    </div>
  );
}
