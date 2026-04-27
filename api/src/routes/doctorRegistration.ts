import { Router } from "express";
import { z } from "zod";
import { validateBody } from "../middleware/validate";
import { requireAuth, requireRole } from "../middleware/auth";
import { pool } from "../db";
import { config } from "../config";
import { logger } from "../logger";
import {
  createDoctorApplication,
  findDoctorApplicationById,
  listPendingDoctorApplications,
  approveDoctorApplication,
  rejectDoctorApplication,
} from "../repositories/doctor.repository";
import { sendEmail } from "../services/emailService";

const router = Router();

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const DoctorRegisterSchema = z.object({
  fullName: z.string().min(2).max(200),
  ahpraNumber: z
    .string()
    .regex(/^[A-Za-z]{3}\d{10}$/, "AHPRA number must be 3 letters followed by 10 digits")
    .transform((s: string) => s.toUpperCase()),
  mobile: z.string().regex(/^\+61[0-9]{9}$/, "Mobile must be an Australian E.164 number (e.g. +61412345678)"),
  specialty: z.enum(["GP-FRACGP", "GP-FACRRM", "GP-non-vocational", "Specialist-other", "Other"]),
  primaryState: z.enum(["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"]),
  hoursPerWeek: z.enum(["0-10", "10-20", "20+"]).optional(),
});

const DemoRequestSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  ahpraNumber: z.string().optional(),
  specialty: z.string().optional(),
  message: z.string().max(2000).optional(),
});

const ApproveApplicationSchema = z.object({
  verifiedOnAhpraRegister: z.literal(true, "You must confirm AHPRA verification before approving."),
});

const RejectApplicationSchema = z.object({
  reason: z.string().min(10).max(500),
});

// ---------------------------------------------------------------------------
// POST /v1/marketing/demo-request — public, rate-limited by SEC-003 global limit
// ---------------------------------------------------------------------------
router.post("/marketing/demo-request", validateBody(DemoRequestSchema), async (req, res, next) => {
  try {
    const { name, email, ahpraNumber, specialty, message } = req.body;
    const ip = req.ip ?? "unknown";

    await pool.query(
      `INSERT INTO audit_log (event_type, actor_id, actor_role, metadata)
       VALUES ('doctor.demo_requested', $1, 'public', $2)`,
      [email, JSON.stringify({ name, ahpraNumber, specialty, ip })]
    );

    sendEmail({
      to: config.sendgrid.adminNotificationEmail,
      subject: "New Nightingale Doctor Demo Request",
      html: `
        <h2>Demo Request</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>AHPRA:</strong> ${ahpraNumber ?? "—"}</p>
        <p><strong>Specialty:</strong> ${specialty ?? "—"}</p>
        <p><strong>Message:</strong> ${message ?? "—"}</p>
        <p><strong>IP:</strong> ${ip}</p>
      `,
    }).catch((err: unknown) => logger.error({ err }, "Failed to send demo request notification"));

    res.status(202).json({ message: "Demo request received. We'll be in touch within 1–2 business days." });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /v1/doctors/register — authenticated doctor creates their application
// ---------------------------------------------------------------------------
router.post(
  "/doctors/register",
  requireAuth,
  requireRole("doctor"),
  validateBody(DoctorRegisterSchema),
  async (req, res, next) => {
    try {
      const sub = req.user.sub;
      const email = req.user.email as string | undefined ?? "";
      const ip = req.ip ?? "unknown";
      const { fullName, ahpraNumber, mobile, specialty, primaryState, hoursPerWeek } = req.body;

      // Reject duplicate AHPRA numbers from a *different* cognito_sub
      const { rows: existing } = await pool.query(
        `SELECT cognito_sub FROM doctors WHERE ahpra_number = $1`,
        [ahpraNumber]
      );
      if (existing.length > 0 && existing[0].cognito_sub !== sub) {
        res.status(409).json({ error: "An application with this AHPRA number already exists." });
        return;
      }

      const doctor = await createDoctorApplication({
        cognitoSub: sub,
        fullName,
        ahpraNumber,
        email,
        mobile,
        specialty,
        primaryState,
        hoursPerWeek: hoursPerWeek ?? null,
        applicationIp: ip,
      });

      await pool.query(
        `INSERT INTO audit_log (event_type, actor_id, actor_role, ahpra_number, metadata)
         VALUES ('doctor.application_submitted', $1, 'doctor', $2, $3)`,
        [sub, ahpraNumber, JSON.stringify({ doctor_id: doctor.id, applied_at: doctor.applied_at })]
      );

      // Notify applicant
      sendEmail({
        to: email,
        subject: "We received your Nightingale application",
        html: `
          <h2>Application received, ${fullName.split(" ")[0]}.</h2>
          <p>We've received your application to practise on Nightingale and are verifying your AHPRA registration.</p>
          <p>This usually takes <strong>1–2 business days</strong>. You'll receive an email as soon as we've completed our review.</p>
          <p>In the meantime, you can log in to see your application status.</p>
          <p style="color:#888;font-size:12px;">Nightingale Health &mdash; AHPRA-registered practitioners only.</p>
        `,
      }).catch((err: unknown) => logger.error({ err }, "Failed to send doctor application received email"));

      // Notify admin
      sendEmail({
        to: config.sendgrid.adminNotificationEmail,
        subject: `New doctor application: ${fullName} (${ahpraNumber})`,
        html: `
          <h2>New Doctor Application</h2>
          <p><strong>Name:</strong> ${fullName}</p>
          <p><strong>AHPRA:</strong> ${ahpraNumber}</p>
          <p><strong>Specialty:</strong> ${specialty}</p>
          <p><strong>State:</strong> ${primaryState}</p>
          <p><strong>Mobile:</strong> ${mobile}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>IP:</strong> ${ip}</p>
          <p><a href="${process.env.ADMIN_BASE_URL ?? "https://nightingale-gray.vercel.app"}/admin/doctors/applications/${doctor.id}">Review application →</a></p>
        `,
      }).catch((err: unknown) => logger.error({ err }, "Failed to send doctor application internal notification"));

      res.status(201).json({ status: "pending", doctorId: doctor.id });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /v1/admin/doctors/applications — list pending applications
// ---------------------------------------------------------------------------
router.get(
  "/admin/doctors/applications",
  requireAuth,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const applications = await listPendingDoctorApplications();
      res.status(200).json({ data: applications });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /v1/admin/doctors/applications/:id — application detail
// ---------------------------------------------------------------------------
router.get(
  "/admin/doctors/applications/:id",
  requireAuth,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const application = await findDoctorApplicationById(req.params.id);
      if (!application) {
        res.status(404).json({ error: "Application not found" });
        return;
      }
      res.status(200).json(application);
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /v1/admin/doctors/applications/:id/approve
// ---------------------------------------------------------------------------
router.post(
  "/admin/doctors/applications/:id/approve",
  requireAuth,
  requireRole("admin"),
  validateBody(ApproveApplicationSchema),
  async (req, res, next) => {
    try {
      const adminSub = req.user.sub;
      const application = await findDoctorApplicationById(req.params.id);
      if (!application) {
        res.status(404).json({ error: "Application not found" });
        return;
      }

      // Defence-in-depth: admin cannot approve their own application
      if (application.cognito_sub === adminSub) {
        res.status(403).json({ error: "Administrators cannot approve their own application." });
        return;
      }

      await approveDoctorApplication(application.id, adminSub);

      await pool.query(
        `INSERT INTO audit_log (event_type, actor_id, actor_role, ahpra_number, metadata)
         VALUES ('doctor.application_approved', $1, 'admin', $2, $3)`,
        [adminSub, application.ahpra_number, JSON.stringify({
          doctor_id: application.id,
          verified_on_ahpra_register: true,
        })]
      );

      sendEmail({
        to: application.email,
        subject: "Your Nightingale application has been approved",
        html: `
          <h2>Welcome to Nightingale, ${application.full_name.split(" ")[0]}.</h2>
          <p>Your AHPRA registration has been verified and your practitioner account is now active.</p>
          <p><a href="${process.env.ADMIN_BASE_URL ?? "https://nightingale-gray.vercel.app"}/doctor/queue">Log in and start reviewing →</a></p>
          <p style="color:#888;font-size:12px;">Nightingale Health &mdash; If you have questions, contact support@nightingale.com.au</p>
        `,
      }).catch((err: unknown) => logger.error({ err }, "Failed to send doctor approval email"));

      res.status(200).json({ status: "approved" });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /v1/admin/doctors/applications/:id/reject
// ---------------------------------------------------------------------------
router.post(
  "/admin/doctors/applications/:id/reject",
  requireAuth,
  requireRole("admin"),
  validateBody(RejectApplicationSchema),
  async (req, res, next) => {
    try {
      const adminSub = req.user.sub;
      const { reason } = req.body;
      const application = await findDoctorApplicationById(req.params.id);
      if (!application) {
        res.status(404).json({ error: "Application not found" });
        return;
      }

      if (application.cognito_sub === adminSub) {
        res.status(403).json({ error: "Administrators cannot reject their own application." });
        return;
      }

      await rejectDoctorApplication(application.id, adminSub, reason);

      await pool.query(
        `INSERT INTO audit_log (event_type, actor_id, actor_role, ahpra_number, metadata)
         VALUES ('doctor.application_rejected', $1, 'admin', $2, $3)`,
        [adminSub, application.ahpra_number, JSON.stringify({ doctor_id: application.id, reason })]
      );

      sendEmail({
        to: application.email,
        subject: "Update on your Nightingale application",
        html: `
          <h2>Application update</h2>
          <p>Thank you for applying to practise on Nightingale. Unfortunately we were unable to verify your application at this time.</p>
          <p><strong>Reason:</strong> ${reason}</p>
          <p>If you believe this is an error, please contact <a href="mailto:applications@nightingale.health">applications@nightingale.health</a>.</p>
          <p style="color:#888;font-size:12px;">Nightingale Health</p>
        `,
      }).catch((err: unknown) => logger.error({ err }, "Failed to send doctor rejection email"));

      res.status(200).json({ status: "rejected" });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
