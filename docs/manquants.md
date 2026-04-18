# Reunion  — 26/03/2026

## Etat d'avancement

| US | Description | Statut |
|----|-------------|--------|
| US-001 | Schema Supabase | ✅ 100% |
| US-002 | App Next.js (upload, dashboard) | ✅ 100% |
| US-003 | Ingestion OCR | ✅ 100% |
| US-004 | Rapprochement offre/commande | ✅ 100% |
| US-005 | Dashboard taux transformation | ✅ 100% |
| US-006 | Relances auto | ⏸️ Bloque sur prerequis |
| US-007 | Dashboard KPI direction | 🔶 60% — donnees Supabase OK |
| US-008 | Analyse comportement client | 🔶 50% — top materiaux + recurrence OK |

**L'app est fonctionnelle** : upload PDF → OCR → rapprochement → dashboard. Il manque les elements ci-dessous pour finaliser.

---

## Ce qu'on a besoin du client

### 1. Tableau Excel KPIs comptables (Gabrielle Petit)

**Bloque US-007 (Dashboard Direction)**

On a deja le CA pieces detachees en temps reel depuis Supabase. Il nous manque les KPIs comptables que seule Gabrielle Petit a :
- CA machines
- CA service
- CA formation
- Resultat mensuel
- Order intake machines

**Action** : Gabrielle Petit envoie son Excel type (un mois suffit pour comprendre la structure). On branche l'import automatique via n8n.

### 2. Dashboard Zite — on le remplace ou pas ?

Le rapport mentionne "dashboard Zite alimente manuellement". On a deja construit un dashboard custom complet (/dashboard + /direction).

**Question** : est-ce qu'ThermoPack utilise vraiment Zite ? Si oui, on le remplace par notre app (plus complet, temps reel, zero ressaisie). Si non, c'est deja fait.

### 3. Templates emails relance (proposition)

**Bloque US-006 (Relances auto)**

Plutot que d'attendre la validation d'Alice/Éric Martin sur le ton et le contenu, on propose de **generer les templates nous-memes** a partir des PDF offres/commandes existants :
- Emails stylises ThermoPack (logo, couleurs, mise en page pro)
- Bilingue FR/ES (detection automatique via pays client)
- 4 paliers : J-30, J-15, J-7, J-1 avant expiration
- Ton professionnel, rappel de la reference offre + montant

**Action** : on prepare les templates, Alice/Éric Martin valident le resultat final. Ca nous fait gagner du temps.

### 4. Acces Outlook ThermoPack (OAuth2)

**Bloque US-006 (Relances auto)**

Pour envoyer les relances depuis une adresse ThermoPack (pas une adresse perso). On a besoin :
- Adresse email d'envoi (ex: pieces@thermopack.fr ou commercial@thermopack.fr)
- Autorisation OAuth2 sur le tenant Microsoft 365 ThermoPack

**Action** : Alice ou IT ThermoPack autorise l'application n8n sur leur tenant M365.

### 5. Domaine + hebergement pour l'app

**Bloque la mise en production**

L'app est prete, il faut la deployer pour qu'Alice/Éric Martin puissent l'utiliser. Options :
- **Vercel** (gratuit, simple) → sous-domaine type thermopack.vercel.app
- **Sous-domaine ** → thermopack.example.com
- **Domaine client** → app.thermopack.fr (necessite config DNS cote ThermoPack)

**Action** :  tranche l'option, on deploie dans la foulee.

---

## Recap des actions

| # | Action | Responsable | Priorite |
|---|--------|-------------|----------|
| 1 | Envoyer Excel KPIs type (1 mois) | Gabrielle Petit | Haute |
| 2 | Confirmer si Zite est utilise ou pas | Éric Martin/ | Moyenne |
| 3 | Valider notre approche templates relance | Alice/Éric Martin | Haute |
| 4 | Autoriser OAuth2 Outlook pour n8n | Alice/IT ThermoPack | Haute |
| 5 | Choisir option hebergement app |  | Haute |
