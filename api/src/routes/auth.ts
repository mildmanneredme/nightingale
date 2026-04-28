import { Router } from "express";
import {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
  UserNotFoundException,
} from "@aws-sdk/client-cognito-identity-provider";
import { config } from "../config";
import { logger } from "../logger";

const router = Router();

const cognitoClient = new CognitoIdentityProviderClient({
  region: config.cognito.region,
});

// POST /v1/auth/check-email
// Returns { exists: boolean } for a given email address.
// Uses AdminGetUser which bypasses prevent_user_existence_errors — this is
// intentional: we need the real state to decide whether to show login vs
// registration. Requires cognito-idp:AdminGetUser on the task IAM role.
router.post("/check-email", async (req, res, next) => {
  try {
    const email = (req.body?.email ?? "").toString().trim().toLowerCase();
    if (!email || !email.includes("@")) {
      res.status(400).json({ error: "Valid email required" });
      return;
    }

    if (!config.cognito.userPoolId) {
      // Cognito not configured (e.g. test env) — assume user doesn't exist
      res.json({ exists: false });
      return;
    }

    try {
      await cognitoClient.send(
        new AdminGetUserCommand({
          UserPoolId: config.cognito.userPoolId,
          Username: email,
        })
      );
      res.json({ exists: true });
    } catch (err) {
      if (err instanceof UserNotFoundException) {
        res.json({ exists: false });
        return;
      }
      throw err;
    }
  } catch (err) {
    logger.error({ err }, "check-email failed");
    next(err);
  }
});

export default router;
