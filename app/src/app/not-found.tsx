import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="text-center">
        <p className="font-mono text-6xl font-bold text-thermopack-red">404</p>
        <h1 className="mt-4 font-condensed text-xl font-semibold tracking-tight">
          Page introuvable
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          La page que vous cherchez n&apos;existe pas ou a été déplacée.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Retour au dashboard
        </Link>
      </div>
    </div>
  );
}
