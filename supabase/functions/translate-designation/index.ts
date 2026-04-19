import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("TRANSLATE_WEBHOOK_SECRET");

// Strict allowlist — NEVER let callers name arbitrary tables.
// The service_role client below bypasses RLS, so the only safety net
// against injection is this whitelist.
const ALLOWED_TABLES = new Set(["offre_lignes", "commande_lignes"]);

const TABLE_PARENT: Record<string, { parent: string; fk: string }> = {
  offre_lignes: { parent: "offres", fk: "offre_id" },
  commande_lignes: { parent: "commandes", fk: "commande_id" },
};

async function translateText(text: string): Promise<string> {
  // Bound prompt size to limit token cost and prompt-injection impact.
  const safeText = text.slice(0, 500).replace(/[\r\n`]/g, " ");
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash-001",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: `Is this product designation in French? If yes, return it as-is. If not, translate to French. Return ONLY the text, no explanation.\n\n"${safeText}"`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`translation backend returned ${response.status}`);
  }
  const data = await response.json();
  const out = data?.choices?.[0]?.message?.content;
  if (typeof out !== "string") {
    throw new Error("translation backend returned an unexpected shape");
  }
  return out.replace(/^["']|["']$/g, "").trim();
}

Deno.serve(async (req) => {
  try {
    // Defense in depth: require a shared secret so only the Supabase
    // trigger or explicitly authorized callers can invoke the function.
    // Supabase edge auto-verifies the JWT unless verify_jwt: false is
    // set, but layering a shared secret closes that gap.
    if (WEBHOOK_SECRET) {
      const presented = req.headers.get("x-webhook-secret");
      if (presented !== WEBHOOK_SECRET) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
        });
      }
    }

    const payload = await req.json();
    const { record, table } = payload ?? {};

    // Reject unknown tables — service_role bypasses RLS, the whitelist
    // is the only safety net against arbitrary-table update.
    if (typeof table !== "string" || !ALLOWED_TABLES.has(table)) {
      return new Response(JSON.stringify({ error: "invalid table" }), {
        status: 400,
      });
    }

    // Validate the record shape.
    if (
      !record ||
      typeof record !== "object" ||
      typeof record.id !== "string" ||
      typeof record.designation_brute !== "string"
    ) {
      return new Response(JSON.stringify({ error: "invalid record" }), {
        status: 400,
      });
    }

    if (record.designation_fr) {
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }

    const translated = await translateText(record.designation_brute);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    await supabase.from(table).update({ designation_fr: translated }).eq("id", record.id);

    const { parent: parentTable, fk: fkColumn } = TABLE_PARENT[table];
    const parentId = record[fkColumn];

    if (parentId && typeof parentId === "string") {
      const { data: parent } = await supabase
        .from(parentTable)
        .select("designations")
        .eq("id", parentId)
        .single();

      if (parent?.designations && Array.isArray(parent.designations)) {
        const updated = parent.designations.map((d: Record<string, unknown>) =>
          d.designation === record.designation_brute
            ? { ...d, designation_fr: translated }
            : d
        );
        await supabase.from(parentTable).update({ designations: updated }).eq("id", parentId);
      }
    }

    return new Response(JSON.stringify({ translated }), { status: 200 });
  } catch (err) {
    // Never leak the raw error to the caller. Log for the operator.
    console.error("[translate-designation]", err);
    return new Response(JSON.stringify({ error: "internal error" }), {
      status: 500,
    });
  }
});
