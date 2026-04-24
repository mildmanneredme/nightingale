import { reportClientError } from "./errors";

// ---------------------------------------------------------------------------
// Token store — in-memory for XSS safety
// ---------------------------------------------------------------------------

let _token: string | null = null;

export function setToken(token: string | null) {
  _token = token;
}

export function getToken(): string | null {
  return _token;
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly correlationId?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ---------------------------------------------------------------------------
// Core fetch wrapper — uses relative paths so Next.js rewrites proxy to the API
// ---------------------------------------------------------------------------

async function apiFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  if (!_token) throw new ApiError(401, "Not authenticated");

  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${_token}`,
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    const correlationId = res.headers.get("x-correlation-id") ?? undefined;
    let message = "Request failed";
    try {
      const body = await res.json();
      message = body.error ?? message;
    } catch {}
    if (res.status >= 500) {
      reportClientError(
        "CLIENT.FETCH.5XX",
        message,
        correlationId,
        typeof window !== "undefined" ? window.location.pathname : undefined
      );
    }
    throw new ApiError(res.status, message, correlationId);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Consultation {
  id: string;
  status: string;
  consultationType: string;
  presentingComplaint?: string;
  transcript?: TranscriptTurn[];
  redFlags?: { phrase: string; detected_at: string }[];
  assessment?: string;
  doctorDraft?: string;
  rejectionMessage?: string;
  prescription?: string;
  createdAt: string;
  sessionStartedAt?: string;
  sessionEndedAt?: string;
}

export interface TranscriptTurn {
  speaker: "ai" | "patient";
  text: string;
  timestamp_ms: number;
}

export interface Patient {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  dateOfBirth?: string;
  biologicalSex?: string;
  phone?: string;
  address?: string;
  medicareNumber?: string;
  ihiNumber?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRel?: string;
  isPaediatric?: boolean;
  guardianName?: string;
  guardianEmail?: string;
  guardianRelationship?: string;
  allergies: Allergy[];
  medications: Medication[];
  conditions: Condition[];
}

export interface Allergy {
  id: string;
  name: string;
  severity: "mild" | "moderate" | "severe";
}

export interface Medication {
  id: string;
  name: string;
  dose?: string;
  frequency?: string;
}

export interface Condition {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Consultation endpoints
// ---------------------------------------------------------------------------

export function getConsultations(): Promise<Consultation[]> {
  return apiFetch("/api/v1/consultations");
}

export function createConsultation(
  consultationType: "voice" | "text",
  presentingComplaint?: string
): Promise<Consultation> {
  return apiFetch("/api/v1/consultations", {
    method: "POST",
    body: JSON.stringify({ consultationType, presentingComplaint }),
  });
}

export function getConsultation(id: string): Promise<Consultation> {
  return apiFetch(`/api/v1/consultations/${id}`);
}

export function endConsultation(
  id: string,
  transcript: TranscriptTurn[]
): Promise<Consultation> {
  return apiFetch(`/api/v1/consultations/${id}/end`, {
    method: "POST",
    body: JSON.stringify({ transcript }),
  });
}

export function getStreamToken(
  consultationId: string
): Promise<{ wsToken: string; expiresInSeconds: number }> {
  return apiFetch(`/api/v1/consultations/${consultationId}/stream-token`, {
    method: "POST",
  });
}

// ---------------------------------------------------------------------------
// Patient endpoints
// ---------------------------------------------------------------------------

export function registerPatient(
  email: string,
  privacyPolicyVersion: string
): Promise<{ id: string; email: string }> {
  return apiFetch("/api/v1/patients/register", {
    method: "POST",
    body: JSON.stringify({ email, privacyPolicyVersion }),
  });
}

export function getMe(): Promise<Patient> {
  return apiFetch("/api/v1/patients/me");
}

export function updateMe(fields: Partial<Omit<Patient, "id" | "email" | "allergies" | "medications" | "conditions">>): Promise<Partial<Patient>> {
  return apiFetch("/api/v1/patients/me", {
    method: "PUT",
    body: JSON.stringify(fields),
  });
}

// ---------------------------------------------------------------------------
// Medical history
// ---------------------------------------------------------------------------

export function addAllergy(name: string, severity: Allergy["severity"]): Promise<Allergy> {
  return apiFetch("/api/v1/patients/me/allergies", {
    method: "POST",
    body: JSON.stringify({ name, severity }),
  });
}

export function deleteAllergy(id: string): Promise<void> {
  return apiFetch(`/api/v1/patients/me/allergies/${id}`, { method: "DELETE" });
}

export function addMedication(name: string, dose?: string, frequency?: string): Promise<Medication> {
  return apiFetch("/api/v1/patients/me/medications", {
    method: "POST",
    body: JSON.stringify({ name, dose, frequency }),
  });
}

export function deleteMedication(id: string): Promise<void> {
  return apiFetch(`/api/v1/patients/me/medications/${id}`, { method: "DELETE" });
}

export function addCondition(name: string): Promise<Condition> {
  return apiFetch("/api/v1/patients/me/conditions", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function deleteCondition(id: string): Promise<void> {
  return apiFetch(`/api/v1/patients/me/conditions/${id}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Text chat
// ---------------------------------------------------------------------------

export interface ChatResponse {
  consultationId: string;
  aiResponse: {
    type: "question" | "complete" | "emergency";
    text?: string;
    options?: string[] | null;
    summary?: string;
    message?: string;
  };
  status: string;
}

export function sendChatMessage(
  consultationId: string,
  message: string
): Promise<ChatResponse> {
  return apiFetch(`/api/v1/consultations/${consultationId}/chat`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

// ---------------------------------------------------------------------------
// Photo upload
// ---------------------------------------------------------------------------

export interface PhotoQualityCheck {
  passed: boolean;
  issues: Array<"blurry" | "too_dark" | "overexposed" | "low_resolution">;
  overridden: boolean;
}

export interface ConsultationPhoto {
  id: string;
  consultationId: string;
  mimeType: string;
  sizeBytes: number;
  widthPx: number;
  heightPx: number;
  qualityPassed: boolean;
  qualityIssues: string[];
  qualityOverridden: boolean;
  createdAt: string;
}

export async function uploadConsultationPhoto(
  consultationId: string,
  file: File,
  quality: PhotoQualityCheck
): Promise<ConsultationPhoto> {
  if (!_token) throw new ApiError(401, "Not authenticated");

  const form = new FormData();
  form.append("photo", file);
  form.append("qualityPassed", String(quality.passed));
  form.append("qualityOverridden", String(quality.overridden));
  form.append("qualityIssues", JSON.stringify(quality.issues));

  const res = await fetch(`/api/v1/consultations/${consultationId}/photos`, {
    method: "POST",
    headers: { Authorization: `Bearer ${_token}` },
    body: form,
  });

  if (!res.ok) {
    let message = "Upload failed";
    try {
      const body = await res.json();
      message = body.error ?? message;
    } catch {}
    throw new ApiError(res.status, message);
  }

  return res.json();
}

export function getConsultationPhotoCount(
  consultationId: string
): Promise<{ count: number }> {
  return apiFetch(`/api/v1/consultations/${consultationId}/photos`);
}

// ---------------------------------------------------------------------------
// Doctor portal
// ---------------------------------------------------------------------------

export interface DoctorQueueItem {
  id: string;
  status: string;
  consultationType: string;
  presentingComplaint?: string;
  priorityFlags: string[];
  createdAt: string;
}

export interface DoctorConsultation {
  id: string;
  status: string;
  consultationType: string;
  presentingComplaint?: string;
  transcript?: Array<{ speaker: string; text: string; timestamp_ms: number }>;
  redFlags?: Array<{ phrase: string }>;
  soapNote?: Record<string, string> | null;
  differentialDiagnoses?: Array<{ diagnosis: string; rank: number }> | null;
  aiDraft?: string;
  priorityFlags: string[];
  createdAt: string;
  patientName?: string;
  patientDob?: string;
  patientSex?: string;
  allergies?: unknown;
  medications?: unknown;
  conditions?: unknown;
}

export function getDoctorQueue(): Promise<DoctorQueueItem[]> {
  return apiFetch("/api/v1/doctor/queue");
}

export function getDoctorConsultation(id: string): Promise<DoctorConsultation> {
  return apiFetch(`/api/v1/doctor/consultations/${id}`);
}

export function approveConsultation(id: string): Promise<{ id: string; status: string }> {
  return apiFetch(`/api/v1/doctor/consultations/${id}/approve`, { method: "POST" });
}

export function amendConsultation(
  id: string,
  doctorDraft: string
): Promise<{ id: string; status: string }> {
  return apiFetch(`/api/v1/doctor/consultations/${id}/amend`, {
    method: "POST",
    body: JSON.stringify({ doctorDraft }),
  });
}

export function rejectConsultation(
  id: string,
  reasonCode: string,
  message?: string
): Promise<{ id: string; status: string }> {
  return apiFetch(`/api/v1/doctor/consultations/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reasonCode, message }),
  });
}

// ---------------------------------------------------------------------------
// Patient inbox
// ---------------------------------------------------------------------------

export interface InboxConsultation {
  id: string;
  status: string;
  reviewedAt: string | null;
  presentingComplaint: string | null;
  responsePreview: string | null;
  doctorName: string | null;
}

export interface InboxItem {
  notificationId: string;
  notificationType: "response_ready" | "rejected";
  deliveryStatus: string;
  sentAt: string;
  readAt: string | null;
  isUnread: boolean;
  consultation: InboxConsultation;
}

export interface InboxResponse {
  unreadCount: number;
  items: InboxItem[];
}

export function getInbox(): Promise<InboxResponse> {
  return apiFetch("/api/v1/inbox");
}

export function markNotificationRead(notificationId: string): Promise<{ id?: string; readAt?: string; alreadyRead?: boolean }> {
  return apiFetch(`/api/v1/inbox/${notificationId}/read`, { method: "PATCH" });
}

// ---------------------------------------------------------------------------
// Doctor schedule & availability
// ---------------------------------------------------------------------------

export interface AvailabilityWindow {
  day: number;        // 0=Sun … 6=Sat
  start_time: string; // "HH:MM" AEST
  end_time: string;   // "HH:MM" AEST
}

export interface DateOverride {
  date: string;       // YYYY-MM-DD
  available: boolean;
  windows?: AvailabilityWindow[];
  note?: string;
}

export interface DoctorSchedule {
  weeklyWindows: AvailabilityWindow[];
  dailyCap: number;
  overrides: DateOverride[];
}

export interface CapacityStats {
  reviewedThisMonth: number;
  monthlyCapEstimate: number;
  utilisationPct: number;
  dailyCap: number;
  todayReviewCount: number;
  dailyCapHit: boolean;
}

export interface ResponseTimeEstimate {
  available: boolean;
  estimatedResponseText: string;
  nextSlotAt: string | null;
}

export function getDoctorSchedule(): Promise<DoctorSchedule> {
  return apiFetch("/api/v1/doctor/schedule");
}

export function updateDoctorSchedule(
  updates: { weeklyWindows?: AvailabilityWindow[]; dailyCap?: number }
): Promise<{ weeklyWindows: AvailabilityWindow[]; dailyCap: number }> {
  return apiFetch("/api/v1/doctor/schedule", {
    method: "PUT",
    body: JSON.stringify(updates),
  });
}

export function addDateOverride(override: DateOverride): Promise<DateOverride & { id: string }> {
  return apiFetch("/api/v1/doctor/schedule/overrides", {
    method: "POST",
    body: JSON.stringify(override),
  });
}

export function removeDateOverride(date: string): Promise<void> {
  return apiFetch(`/api/v1/doctor/schedule/overrides/${date}`, { method: "DELETE" });
}

export function getCapacityStats(): Promise<CapacityStats> {
  return apiFetch("/api/v1/doctor/schedule/capacity");
}

export function getResponseTime(): Promise<ResponseTimeEstimate> {
  return apiFetch("/api/v1/consultations/response-time");
}

// ---------------------------------------------------------------------------
// Script renewals (PRD-018)
// ---------------------------------------------------------------------------

export interface RenewalRequest {
  id: string;
  status: "pending" | "approved" | "declined";
  medicationName: string;
  dosage?: string;
  reviewNote?: string;
  validUntil?: string;
  remindersEnabled: boolean;
  createdAt: string;
  reviewedAt?: string;
  doctorName?: string;
}

export interface RenewalQueueItem {
  id: string;
  medicationName: string;
  dosage?: string;
  noAdverseEffects: boolean;
  conditionUnchanged: boolean;
  patientNotes?: string;
  createdAt: string;
  validUntil?: string;
  isExpiryAlert: boolean;
  patient: { name?: string; dob?: string; sex?: string };
}

export function getRenewals(): Promise<RenewalRequest[]> {
  return apiFetch("/api/v1/renewals");
}

export function submitRenewal(data: {
  medicationName: string;
  dosage?: string;
  sourceConsultationId?: string;
  noAdverseEffects?: boolean;
  conditionUnchanged?: boolean;
  patientNotes?: string;
  remindersEnabled?: boolean;
}): Promise<{ id: string; status: string }> {
  return apiFetch("/api/v1/renewals", { method: "POST", body: JSON.stringify(data) });
}

export function getRenewalQueue(): Promise<RenewalQueueItem[]> {
  return apiFetch("/api/v1/renewals/queue");
}

export function approveRenewal(
  id: string,
  reviewNote?: string,
  validDays?: number
): Promise<{ id: string; status: string; validUntil: string }> {
  return apiFetch(`/api/v1/renewals/${id}/approve`, {
    method: "POST",
    body: JSON.stringify({ reviewNote, validDays }),
  });
}

export function declineRenewal(
  id: string,
  reviewNote?: string
): Promise<{ id: string; status: string }> {
  return apiFetch(`/api/v1/renewals/${id}/decline`, {
    method: "POST",
    body: JSON.stringify({ reviewNote }),
  });
}

// ---------------------------------------------------------------------------
// Admin portal (UX-003)
// ---------------------------------------------------------------------------

export interface AdminStats {
  patients: { total: number };
  consultations: {
    total: number;
    pending: number;
    approved: number;
    amended: number;
    rejected: number;
    emergencyEscalated: number;
    cannotAssess: number;
    resolved: number;
    followupConcern: number;
  };
  rates: {
    approvalPct: number | null;
    amendmentPct: number | null;
    rejectionPct: number | null;
    avgReviewMinutes: number | null;
  };
  followUp: {
    sent: number;
    responded: number;
    better: number;
    same: number;
    worse: number;
  };
}

export interface AdminQueueItem {
  id: string;
  patientInitials: string;
  presentingComplaint: string | null;
  assignedDoctorId: string | null;
  assignedDoctorName: string | null;
  createdAt: string;
  queuedAt: string;
}

export interface AdminDoctor {
  id: string;
  name: string;
}

export function getAdminStats(): Promise<AdminStats> {
  return apiFetch("/api/v1/admin/stats");
}

export function getAdminQueue(): Promise<AdminQueueItem[]> {
  return apiFetch("/api/v1/admin/queue");
}

export function getAdminDoctors(): Promise<AdminDoctor[]> {
  return apiFetch("/api/v1/admin/doctors");
}

export function reassignConsultation(
  consultationId: string,
  doctorId: string
): Promise<{ id: string; assignedDoctorId: string }> {
  return apiFetch(`/api/v1/admin/consultations/${consultationId}/reassign`, {
    method: "POST",
    body: JSON.stringify({ doctorId }),
  });
}
