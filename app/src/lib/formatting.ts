export function formatCurrency(value: number | null | undefined, decimals = 0) {
  if (value == null) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatDate(date: string | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("fr-FR").format(new Date(date));
}

export function getDateRange(periode: string): { debut: string; fin: string } | null {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  switch (periode) {
    case "mois": {
      const debut = new Date(year, month, 1);
      const fin = new Date(year, month + 1, 0);
      return { debut: fmtDate(debut), fin: fmtDate(fin) };
    }
    case "trimestre": {
      const qStart = Math.floor(month / 3) * 3;
      const debut = new Date(year, qStart, 1);
      const fin = new Date(year, qStart + 3, 0);
      return { debut: fmtDate(debut), fin: fmtDate(fin) };
    }
    case "annee":
      return { debut: `${year}-01-01`, fin: `${year}-12-31` };
    default:
      return null;
  }
}

function fmtDate(d: Date): string {
  return d.toISOString().split("T")[0];
}
