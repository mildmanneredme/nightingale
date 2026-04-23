const apiUrl = () => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

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
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

// ---------------------------------------------------------------------------
// Core fetch wrapper
// ---------------------------------------------------------------------------

async function apiFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  if (!_token) throw new ApiError(401, "Not authenticated");

  const res = await fetch(`${apiUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${_token}`,
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    let message = "Request failed";
    try {
      const body = await res.json();
      message = body.error ?? message;
    } catch {}
    throw new ApiError(res.status, message);
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
