import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function translateText(text: string): Promise<string> {
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
          content: `Is this product designation in French? If yes, return it as-is. If not, translate to French. Return ONLY the text, no explanation.\n\n"${text}"`,
        },
      ],
    }),
  });

  const data = await response.json();
  return data.choices[0].message.content.replace(/^["']|["']$/g, "").trim();
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const { record, table } = payload;

    if (!record?.designation_brute || record.designation_fr) {
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }

    const translated = await translateText(record.designation_brute);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Update the lignes row
    await supabase.from(table).update({ designation_fr: translated }).eq("id", record.id);

    // Also update the parent JSONB designations array
    const fkColumn = table === "offre_lignes" ? "offre_id" : "commande_id";
    const parentTable = table === "offre_lignes" ? "offres" : "commandes";
    const parentId = record[fkColumn];

    if (parentId) {
      const { data: parent } = await supabase
        .from(parentTable)
        .select("designations")
        .eq("id", parentId)
        .single();

      if (parent?.designations && Array.isArray(parent.designations)) {
        const updated = parent.designations.map((d: any) =>
          d.designation === record.designation_brute
            ? { ...d, designation_fr: translated }
            : d
        );
        await supabase.from(parentTable).update({ designations: updated }).eq("id", parentId);
      }
    }

    return new Response(JSON.stringify({ translated }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
