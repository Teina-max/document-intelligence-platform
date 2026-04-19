import type { Locale } from "@/lib/i18n";
import type { PaysEnum } from "@/types/database";
import { formatCurrency, formatDate } from "@/lib/formatting";

type Palier = "J-30" | "J-15" | "J-7" | "J-1";

export function getPalier(joursRestants: number | null): Palier {
  if (joursRestants == null || joursRestants <= 0) return "J-1";
  if (joursRestants <= 7) return "J-7";
  if (joursRestants <= 15) return "J-15";
  return "J-30";
}

function getLocaleFromPays(pays: PaysEnum): Locale {
  return pays === "ES" ? "es" : "fr";
}

interface RelanceData {
  reference_offre: string;
  contact_email: string;
  contact_nom: string | null;
  montant_ht: number | null;
  date_expiration: string | null;
  jours_restants: number | null;
  entreprise_pays: PaysEnum;
}

const subjects: Record<Palier, Record<Locale, string>> = {
  "J-30": {
    fr: "Votre offre ThermoPack {{ref}} — Suivi",
    es: "Su oferta ThermoPack {{ref}} — Seguimiento",
  },
  "J-15": {
    fr: "Offre ThermoPack {{ref}} — Demande de retour",
    es: "Oferta ThermoPack {{ref}} — Solicitud de respuesta",
  },
  "J-7": {
    fr: "Offre ThermoPack {{ref}} — Échéance proche",
    es: "Oferta ThermoPack {{ref}} — Vencimiento próximo",
  },
  "J-1": {
    fr: "Offre ThermoPack {{ref}} — Relance",
    es: "Oferta ThermoPack {{ref}} — Recordatorio",
  },
};

const bodies: Record<Palier, Record<Locale, string>> = {
  "J-30": {
    fr: `Bonjour {{nom}},

Nous nous permettons de revenir vers vous concernant notre offre {{ref}} d'un montant de {{montant}}.

N'hésitez pas à nous contacter si vous avez des questions ou si vous souhaitez passer commande.

Cordialement,
ThermoPack Industries — Pièces détachées
Tél : +33 (0)3 88 65 67 00`,
    es: `Estimado/a {{nom}},

Nos permitimos contactarle de nuevo en relación con nuestra oferta {{ref}} por un importe de {{montant}}.

No dude en contactarnos si tiene alguna pregunta o desea realizar un pedido.

Atentamente,
ThermoPack Industries — Piezas de repuesto
Tel: +33 (0)3 88 65 67 00`,
  },
  "J-15": {
    fr: `Bonjour {{nom}},

Nous revenons vers vous au sujet de notre offre {{ref}} ({{montant}}).

Pourriez-vous nous indiquer si cette offre correspond à vos attentes ? Nous restons à votre disposition pour toute question.

Cordialement,
ThermoPack Industries — Pièces détachées
Tél : +33 (0)3 88 65 67 00`,
    es: `Estimado/a {{nom}},

Nos ponemos en contacto de nuevo sobre nuestra oferta {{ref}} ({{montant}}).

¿Podría indicarnos si esta oferta se ajusta a sus necesidades? Quedamos a su disposición para cualquier consulta.

Atentamente,
ThermoPack Industries — Piezas de repuesto
Tel: +33 (0)3 88 65 67 00`,
  },
  "J-7": {
    fr: `Bonjour {{nom}},

Notre offre {{ref}} d'un montant de {{montant}} arrive à échéance le {{expiration}}.

Nous vous invitons à nous contacter rapidement si vous souhaitez donner suite à cette offre.

Cordialement,
ThermoPack Industries — Pièces détachées
Tél : +33 (0)3 88 65 67 00`,
    es: `Estimado/a {{nom}},

Nuestra oferta {{ref}} por un importe de {{montant}} vence el {{expiration}}.

Le invitamos a contactarnos a la brevedad si desea dar curso a esta oferta.

Atentamente,
ThermoPack Industries — Piezas de repuesto
Tel: +33 (0)3 88 65 67 00`,
  },
  "J-1": {
    fr: `Bonjour {{nom}},

Ceci est notre relance concernant l'offre {{ref}} ({{montant}}).

Sans retour de votre part, cette offre ne pourra plus être maintenue aux conditions actuelles.

N'hésitez pas à nous appeler directement pour en discuter.

Cordialement,
ThermoPack Industries — Pièces détachées
Tél : +33 (0)3 88 65 67 00`,
    es: `Estimado/a {{nom}},

Este es nuestro recordatorio sobre la oferta {{ref}} ({{montant}}).

Sin respuesta de su parte, no podremos mantener las condiciones actuales de esta oferta.

No dude en llamarnos directamente para conversarlo.

Atentamente,
ThermoPack Industries — Piezas de repuesto
Tel: +33 (0)3 88 65 67 00`,
  },
};

export function buildMailtoUrl(data: RelanceData): string {
  const locale = getLocaleFromPays(data.entreprise_pays);
  const palier = getPalier(data.jours_restants);

  const nom = data.contact_nom || (locale === "es" ? "Estimado/a cliente" : "Madame, Monsieur");
  const montant = formatCurrency(data.montant_ht);
  const expiration = formatDate(data.date_expiration);

  const subject = subjects[palier][locale].replace("{{ref}}", data.reference_offre);

  const body = bodies[palier][locale]
    .replace(/\{\{nom\}\}/g, nom)
    .replace(/\{\{ref\}\}/g, data.reference_offre)
    .replace(/\{\{montant\}\}/g, montant)
    .replace(/\{\{expiration\}\}/g, expiration);

  const params = new URLSearchParams({
    to: data.contact_email,
    subject,
    body,
  });
  return `https://outlook.office.com/mail/deeplink/compose?${params.toString()}`;
}
