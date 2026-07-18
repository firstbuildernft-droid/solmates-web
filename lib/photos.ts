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

export async function uploadPhoto(userId: string, file: File, position: number) {
  if (!file.type.startsWith("image/")) {
    throw new Error("That's not an image.");
  }

  const supabase = createClient();
  const blob = await shrink(file);

  // {user_id}/{random}.jpg — the folder name is what the storage policy
  // checks, so this path shape is load-bearing, not cosmetic.
  const path = `${userId}/${crypto.randomUUID()}.jpg`;

  const { error: upErr } = await supabase.storage
    .from("photos")
    .upload(path, blob, { contentType: "image/jpeg" });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from("photos")
    .insert({ user_id: userId, storage_path: path, position })
    .select()
    .single();

  // If the DB row fails, don't leave the file orphaned in the bucket.
  if (error) {
    await supabase.storage.from("photos").remove([path]);
    throw error;
  }

  return data;
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
