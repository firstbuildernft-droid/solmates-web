import { createClient } from "@/lib/supabase/client";

const MAX_DIM = 1200;
const QUALITY = 0.82;

// A photo straight off an iPhone is ~4000px and 8-12MB. Uploading that
// raw over mobile data takes forever and then you serve 12MB into a
// swipe deck. Resize before it ever leaves the phone.
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);

  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Couldn't process that image."))),
      "image/jpeg",
      QUALITY
    )
  );
}

export function publicUrl(storagePath: string) {
  const supabase = createClient();
  return supabase.storage.from("photos").getPublicUrl(storagePath).data
    .publicUrl;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("Couldn't read the image."));
    r.readAsDataURL(blob);
  });
}

export async function uploadPhoto(userId: string, file: File, position: number) {
  if (!file.type.startsWith("image/")) {
    throw new Error("That's not an image.");
  }

  // Shrink in the browser (fast, saves bandwidth), then hand the bytes to
  // the server, which moderates BEFORE anything is stored. userId isn't
  // trusted from here — the route uses the signed-in session — but we keep
  // the arg so callers don't change.
  const blob = await shrink(file);
  const dataUrl = await blobToDataUrl(blob);

  const res = await fetch("/api/photos/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: dataUrl, position }),
  });

  const json = await res.json();
  if (!res.ok) {
    // The route returns a friendly message for rejected images; surface it.
    throw new Error(json.message || json.error || "Upload failed.");
  }

  return json.photo;
}

export async function deletePhoto(id: string, storagePath: string) {
  const supabase = createClient();
  await supabase.from("photos").delete().eq("id", id);
  await supabase.storage.from("photos").remove([storagePath]);
}

export async function reorderPhotos(ids: string[]) {
  const supabase = createClient();
  // Rewrite every position. Cheap — nobody has 200 photos.
  await Promise.all(
    ids.map((id, i) =>
      supabase.from("photos").update({ position: i }).eq("id", id)
    )
  );
}
