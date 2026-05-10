import { supabase } from "@/integrations/supabase/client";

export type ContributionKind = "avatar" | "sticker";

export async function uploadContribution(
  file: File | Blob,
  kind: ContributionKind,
  stickerCode?: string,
): Promise<{ path: string } | null> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) return null;

  const ext = (file as File).name?.split(".").pop()?.toLowerCase() || "jpg";
  const safeExt = /^[a-z0-9]{1,5}$/.test(ext) ? ext : "jpg";
  const path = `${uid}/${kind}/${Date.now()}-${crypto.randomUUID()}.${safeExt}`;

  const { error: upErr } = await supabase.storage
    .from("user-contributions")
    .upload(path, file, { contentType: (file as File).type || "image/jpeg", upsert: false });
  if (upErr) {
    console.error("contribution upload failed", upErr);
    return null;
  }

  const { error: insErr } = await supabase.from("user_contributions").insert({
    user_id: uid,
    kind,
    storage_path: path,
    sticker_code: stickerCode ?? null,
  });
  if (insErr) {
    // best-effort cleanup
    await supabase.storage.from("user-contributions").remove([path]);
    console.error("contribution metadata insert failed", insErr);
    return null;
  }

  return { path };
}

export async function deleteAllMyContributions(): Promise<number> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) return 0;

  const { data: rows } = await supabase
    .from("user_contributions")
    .select("id, storage_path")
    .eq("user_id", uid);

  if (!rows || rows.length === 0) return 0;

  const paths = rows.map((r) => r.storage_path);
  await supabase.storage.from("user-contributions").remove(paths);
  await supabase.from("user_contributions").delete().eq("user_id", uid);
  return rows.length;
}

export async function countMyContributions(): Promise<number> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) return 0;
  const { count } = await supabase
    .from("user_contributions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", uid);
  return count ?? 0;
}
