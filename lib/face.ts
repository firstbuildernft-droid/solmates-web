import "server-only";
import {
  RekognitionClient,
  CompareFacesCommand,
  DetectFacesCommand,
} from "@aws-sdk/client-rekognition";

// The selfie-vs-photo check. Everything here runs server-side and holds
// the selfie bytes for the length of one request, then lets them go. No
// image is ever written to disk or database — only the score and the
// verdict, in face_attempts.

const client = new RekognitionClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Below this CompareFaces similarity we don't call it a match. 90 is
// deliberately strict — a false "verified" on a dating app is worse than
// making a real person retry in better light. Tune with the numbers in
// face_attempts once you have real ones.
const MATCH_THRESHOLD = 90;

export type FaceResult =
  | { passed: true; similarity: number; reason: "ok" }
  | {
      passed: false;
      similarity: number | null;
      reason: "no_face" | "multiple_faces" | "no_match" | "error";
    };

/**
 * Step 1: is the selfie usable? Exactly one clearly-visible face.
 * Catches held-up-phone shots, group photos, and empty frames before we
 * spend a CompareFaces call on them.
 */
async function gateSelfie(selfie: Buffer): Promise<
  { ok: true } | { ok: false; reason: "no_face" | "multiple_faces" }
> {
  const out = await client.send(
    new DetectFacesCommand({ Image: { Bytes: selfie }, Attributes: ["DEFAULT"] })
  );
  const faces = out.FaceDetails ?? [];
  if (faces.length === 0) return { ok: false, reason: "no_face" };
  if (faces.length > 1) return { ok: false, reason: "multiple_faces" };
  return { ok: true };
}

/**
 * Compare the selfie against each profile photo until one matches.
 * Their photos are the SOURCE of truth we match against — this answers
 * "is the live person the one in these pictures", which is the whole
 * point. It does NOT prove the pictures are really them; that's the known
 * limit of photo-based matching, and the reason a government-ID tier
 * would exist later.
 */
export async function compareToPhotos(
  selfie: Buffer,
  photoBuffers: Buffer[]
): Promise<FaceResult> {
  try {
    const gate = await gateSelfie(selfie);
    if (!gate.ok) return { passed: false, similarity: null, reason: gate.reason };

    let best = 0;

    for (const photo of photoBuffers) {
      const out = await client.send(
        new CompareFacesCommand({
          SourceImage: { Bytes: selfie },
          TargetImage: { Bytes: photo },
          SimilarityThreshold: 1, // return the score even when low, so we can log it
        })
      );

      for (const m of out.FaceMatches ?? []) {
        if ((m.Similarity ?? 0) > best) best = m.Similarity ?? 0;
      }

      if (best >= MATCH_THRESHOLD) {
        return { passed: true, similarity: Math.round(best), reason: "ok" };
      }
    }

    return {
      passed: false,
      similarity: best > 0 ? Math.round(best) : null,
      reason: "no_match",
    };
  } catch (err) {
    console.error("Rekognition error:", err);
    return { passed: false, similarity: null, reason: "error" };
  }
}
