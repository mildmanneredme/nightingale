interface StatusBadgeProps {
  status: string;
}

const STATUS_MAP: Record<string, { bg: string; text: string; label: string }> = {
  approved:          { bg: "bg-secondary-container",    text: "text-on-secondary-container", label: "Approved" },
  amended:           { bg: "bg-secondary-container",    text: "text-on-secondary-container", label: "Approved" },
  resolved:          { bg: "bg-secondary-container",    text: "text-on-secondary-container", label: "Resolved" },
  pending:           { bg: "bg-tertiary-fixed",         text: "text-on-tertiary-fixed-variant", label: "Pending" },
  active:            { bg: "bg-tertiary-fixed",         text: "text-on-tertiary-fixed-variant", label: "Active" },
  queued_for_review: { bg: "bg-tertiary-fixed",         text: "text-on-tertiary-fixed-variant", label: "Under Review" },
  transcript_ready:  { bg: "bg-tertiary-fixed",         text: "text-on-tertiary-fixed-variant", label: "Under Review" },
  rejected:          { bg: "bg-error-container",        text: "text-on-error-container",     label: "Rejected" },
  emergency_escalated: { bg: "bg-error-container",      text: "text-on-error-container",     label: "Emergency" },
  cannot_assess:     { bg: "bg-error-container",        text: "text-on-error-container",     label: "Cannot Assess" },
  unchanged:         { bg: "bg-surface-container",      text: "text-on-surface-variant",     label: "Follow-Up Sent" },
  followup_concern:  { bg: "bg-surface-container",      text: "text-on-surface-variant",     label: "Doctor Follow-Up" },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = STATUS_MAP[status] ?? {
    bg: "bg-surface-container",
    text: "text-on-surface-variant",
    label: status,
  };

  return (
    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}
