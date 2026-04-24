"use client";

interface StepDef {
  number: number;
  label: string;
  tooltip: string;
  optional?: boolean;
}

const STEPS: StepDef[] = [
  {
    number: 1,
    label: "Consultation",
    tooltip: "Describe your symptoms and choose your consultation mode — voice call or text chat.",
  },
  {
    number: 2,
    label: "Diagnosis Underway",
    tooltip: "Your AI-assisted triage is in progress. A qualified doctor reviews your case before confirming any diagnosis.",
  },
  {
    number: 3,
    label: "Results & Treatment",
    tooltip: "Receive your doctor-reviewed diagnosis, any prescription recommendations, and a personalised care plan.",
  },
  {
    number: 4,
    label: "Follow-up",
    tooltip: "A scheduled check-in to review your progress and adjust treatment if needed. Only added when recommended by your doctor.",
    optional: true,
  },
];

interface ConsultationStepperProps {
  activeStep: 1 | 2 | 3 | 4;
  showFollowUp?: boolean;
  variant?: "light" | "dark";
}

export default function ConsultationStepper({
  activeStep,
  showFollowUp = false,
  variant = "light",
}: ConsultationStepperProps) {
  const steps = STEPS.filter((s) => s.number < 4 || showFollowUp);
  const isDark = variant === "dark";

  return (
    <div className="flex items-start overflow-x-auto pb-1 select-none">
      {steps.map((step, idx) => {
        const isActive = step.number === activeStep;
        const isCompleted = step.number < activeStep;
        const isLast = idx === steps.length - 1;

        return (
          <div key={step.number} className="flex items-center flex-1 min-w-0">
            {/* Step + tooltip wrapper */}
            <div className="relative group/step flex flex-col items-center flex-shrink-0 cursor-default">
              {/* Circle */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                  isActive
                    ? "bg-secondary text-white shadow-md shadow-secondary/40"
                    : isCompleted
                    ? isDark
                      ? "bg-white/25 text-white"
                      : "bg-secondary/20 text-secondary"
                    : isDark
                    ? "border-2 border-white/20 text-white/30"
                    : "border-2 border-outline text-on-surface-variant opacity-40"
                }`}
              >
                {isCompleted ? (
                  <span
                    className="material-symbols-outlined text-[14px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check
                  </span>
                ) : (
                  step.number
                )}
              </div>

              {/* Label — hidden on mobile */}
              <span
                className={`mt-1.5 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap hidden sm:block transition-all ${
                  isActive
                    ? isDark
                      ? "text-secondary"
                      : "text-secondary"
                    : isDark
                    ? "text-white/30"
                    : "text-on-surface-variant opacity-40"
                }`}
              >
                {step.label}
                {step.optional && (
                  <span className="normal-case font-normal tracking-normal ml-1 opacity-60">
                    *
                  </span>
                )}
              </span>

              {/* Tooltip — desktop hover only */}
              <div
                className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-56 rounded-xl px-3 py-2.5 text-xs leading-relaxed
                            opacity-0 group-hover/step:opacity-100 transition-opacity duration-150
                            pointer-events-none z-50 shadow-xl hidden md:block ${
                              isDark ? "bg-white text-primary" : "bg-primary text-white"
                            }`}
              >
                <p className="font-medium mb-0.5">{step.label}</p>
                <p className="opacity-80">{step.tooltip}</p>
                {step.optional && (
                  <p className="mt-1 opacity-50 italic text-[10px]">
                    * Only when recommended by your doctor
                  </p>
                )}
                {/* Arrow */}
                <div
                  className={`absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent ${
                    isDark ? "border-t-white" : "border-t-primary"
                  }`}
                />
              </div>
            </div>

            {/* Connector */}
            {!isLast && (
              <div
                className={`flex-1 h-[2px] mx-2 mt-[-14px] sm:mt-[-20px] transition-colors ${
                  isCompleted
                    ? isDark
                      ? "bg-white/30"
                      : "bg-secondary/30"
                    : isDark
                    ? "bg-white/10"
                    : "bg-outline-variant"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
