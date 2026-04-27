/**
 * Cognito Pre-Signup Lambda Trigger
 *
 * Runs before a new user is registered. Handles:
 * - Setting custom attributes (role, is_anonymous, is_paediatric)
 * - Blocking admin self-registration (doctors can self-register per PRD-025)
 * - Flagging paediatric accounts (DOB under 18)
 */
exports.handler = async (event) => {
  const { triggerSource, request } = event;
  const attrs = request.userAttributes;

  const role = attrs["custom:role"];

  // Admins cannot self-register — PRD-004 F-006
  if (role === "admin") {
    throw new Error("Admin accounts must be created by an administrator.");
  }

  // Default new self-registrations to patient role
  if (!role) {
    event.response.autoConfirmUser = false;
    event.request.userAttributes["custom:role"] = "patient";
  }

  // Doctor self-registration (PRD-025): allowed but lands in status='pending'
  // until admin verifies AHPRA on the public register. The doctors table row
  // and the pending gate are enforced by the API — not here.
  if (role === "doctor") {
    event.response.autoConfirmUser = false;
  }

  // Paediatric flag — PRD-004 F-022, F-023
  const dob = attrs.birthdate;
  if (dob) {
    const age = getAgeInYears(dob);
    if (age < 18) {
      event.request.userAttributes["custom:is_paediatric"] = "true";
    }
  }

  // Anonymous flag — PRD-004 F-018, F-019
  // Anonymous patients omit name/DOB; flagged here for Clinical AI to restrict scope
  const isAnonymous = !attrs.name && !dob;
  event.request.userAttributes["custom:is_anonymous"] = isAnonymous ? "true" : "false";

  return event;
};

function getAgeInYears(dobString) {
  const dob = new Date(dobString);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}
