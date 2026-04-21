/**
 * Cognito Pre-Signup Lambda Trigger
 *
 * Runs before a new user is registered. Handles:
 * - Setting custom attributes (role, is_anonymous, is_paediatric)
 * - Blocking self-registration for doctor/admin roles
 * - Flagging paediatric accounts (DOB under 18)
 */
exports.handler = async (event) => {
  const { triggerSource, request } = event;
  const attrs = request.userAttributes;

  // Doctors and admins cannot self-register — PRD-004 F-005, F-006
  const role = attrs["custom:role"];
  if (role === "doctor" || role === "admin") {
    throw new Error("Doctor and admin accounts must be created by an administrator.");
  }

  // Default new self-registrations to patient role
  if (!role) {
    event.response.autoConfirmUser = false;
    event.request.userAttributes["custom:role"] = "patient";
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
