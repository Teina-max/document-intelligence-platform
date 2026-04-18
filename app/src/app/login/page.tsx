import Image from "next/image";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen">
      {/* Left panel — ThermoPack Blue branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-thermopack-blue p-12 text-white">
        <div className="flex items-center gap-3">
          <Image
            src="https://res.cloudinary.com/dttleawx6/image/upload/v1774510122/copy_of_capture_d_cran_2026-03-25_131424-removebg-preview_eu6n9g_11f077.png"
            alt="ThermoPack"
            width={32}
            height={32}
            priority
          />
          <div className="text-xs text-white/60">France · Pièces Détachées</div>
        </div>

        <div className="space-y-6">
          <h1 className="font-condensed text-4xl font-bold leading-tight tracking-tight">
            Suivi offres &<br />commandes
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-white/70">
            Ingestion automatique des PDF, rapprochement offre/commande
            et suivi du taux de transformation en temps réel.
          </p>
          <div className="flex gap-8 border-t border-primary-foreground/10 pt-6">
            <div>
              <div className="font-mono text-2xl font-bold">43%</div>
              <div className="text-xs text-white/50 font-condensed uppercase tracking-wider">Taux actuel</div>
            </div>
            <div>
              <div className="font-mono text-2xl font-bold">50%</div>
              <div className="text-xs text-white/50 font-condensed uppercase tracking-wider">Objectif</div>
            </div>
            <div>
              <div className="font-mono text-2xl font-bold">+240k</div>
              <div className="text-xs text-white/50 font-condensed uppercase tracking-wider">CA/an visé</div>
            </div>
          </div>
        </div>

        <div className="text-xs text-white/30">
          Thermoformage · Machines · Pièces détachées
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex flex-1 items-center justify-center bg-background p-8">
        <LoginForm />
      </div>
    </div>
  );
}
