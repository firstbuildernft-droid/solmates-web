import "server-only";
import {
  RekognitionClient,
  DetectModerationLabelsCommand,
} from "@aws-sdk/client-rekognition";

// Same Rekognition setup as face.ts — same keys, same region.
const client = new RekognitionClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Rekognition returns hierarchical labels: a top-level category plus a
// specific sub-label. We block on the TOP-LEVEL category so we catch the
// whole family, but we deliberately DON'T block the categories that are
// normal on a dating app (swimwear, shirtless, "suggestive").
//
// Full taxonomy: https://docs.aws.amazon.com/rekognition/latest/dg/moderation.html
//
// BLOCK — genuinely harmful:
const BLOCKED_CATEGORIES = new Set([
  "Explicit Nudity",         // actual nudity, sexual activity
  "Explicit",                // newer top-level name for the same
  "Violence",                // fighting, weapons used on people
  "Visually Disturbing",     // gore, corpses, self-harm — the dead-body case
  "Non-Explicit Nudity of Intimate parts and Kissing", // partial explicit
  "Weapons",                 // guns/knives brandished
  "Hate Symbols",            // extremist imagery
  "Drugs & Tobacco",         // hard drug use / paraphernalia
  "Drugs",
]);

// ALLOW even if flagged — normal for dating:
//   "Swimwear or Underwear", "Female Swimwear Or Underwear",
//   "Male Swimwear Or Underwear", "Suggestive", "Revealing Clothes",
//   "Barechested Male", "Implied Nudity"
// These are simply never in the blocked set above, so they pass.

// Only act on a label we're fairly sure about. Below this we let it
// through — a dating app that wrongly rejects real photos loses real
// users, and false positives on borderline shots are common.
const MIN_CONFIDENCE = 80;

export type ModerationResult =
  | { allowed: true }
  | { allowed: false; category: string; confidence: number };

export async function moderateImage(bytes: Buffer): Promise<ModerationResult> {
  try {
    const out = await client.send(
      new DetectModerationLabelsCommand({
        Image: { Bytes: bytes },
        MinConfidence: MIN_CONFIDENCE,
      })
    );

    for (const label of out.ModerationLabels ?? []) {
      const top = label.ParentName || label.Name || "";
      const name = label.Name || "";
      const conf = label.Confidence ?? 0;

      // Match either the parent category or the label itself against the
      // block set. ParentName is "" for top-level labels, so check both.
      if (BLOCKED_CATEGORIES.has(top) || BLOCKED_CATEGORIES.has(name)) {
        return {
          allowed: false,
          category: top || name,
          confidence: Math.round(conf),
        };
      }
    }

    return { allowed: true };
  } catch (err) {
    // FAIL OPEN, and log loudly. If Rekognition is down, we let the upload
    // through rather than blocking every user from adding photos — a
    // moderation outage shouldn't take down onboarding. The tradeoff:
    // during an outage, bad images could slip in. Acceptable for a rare
    // event; revisit if it ever happens often.
    console.error("Moderation error (failing open):", err);
    return { allowed: true };
  }
}
