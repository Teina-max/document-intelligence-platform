# Analyse PDF — Structure des documents ThermoPack Industries

## Regles de nommage

- **Offres** : `504xxxxx` (commence toujours par 504)
- **Commandes** : `704xxxxx` (commence toujours par 704)
- **V2** : suffixe quand un document est modifie (meme numero + "V2")

## Structure Offre

Titre du document : **"Offre"**

| Champ | Emplacement dans le PDF | Exemple |
|-------|------------------------|---------|
| Type document | Titre principal | "Offre" |
| Reference | N° de reference | 50429405 |
| Validite | Valable jusqu'au | 12. Fevrier 2026 |
| N° client ThermoPack | N° client | 701441 |
| Correspondant ThermoPack | Correspondant | Monsieur DUBOIS |
| Client (nom) | Bloc adresse droite | Toutherm SAS |
| Client (adresse) | Bloc adresse droite | 57, Route de Montargis |
| Client (code postal) | Bloc adresse droite | 89300 Joigny |
| Contact client (nom) | Votre nom | mr ALAEF REMY |
| Contact client (tel) | Tel | 03 86193240 |
| Date offre | Date | 13. Janvier 2026 |
| Date expedition | date d'expedition | 16.01.2026 |
| Lignes articles | Pos. / Materiel / Quantite / Prix unitaire / Prix total | Multi-pages |
| Somme articles | Somme des articles | 14 707,74 EUR |
| Frais transport | Frais de transport | 130,00 EUR |
| Frais emballage | Frais d'emballage | 30,00 EUR |
| TVA | T.V.A. 20% | 2 973,55 EUR |
| Total TTC | Somme Total | 17 841,29 EUR |
| Conditions paiement | Conditions de paiement | a 30 jours date de facture net |
| Conditions livraison | Conditions de livraison | CPT Port paye jusqu'a JOIGNY emballe |

### Detail ligne article

Chaque position contient :
- **Pos.** : numero de position (10, 20, 30...)
- **Reference materiel** : code article (ex: 9164103)
- **Designation** : nom de la piece (ex: "pont")
- **Quantite** : nombre + unite (ex: 1 PCE, 2 PCE)
- **Prix unitaire** : en EUR (format: 6.174,00 EUR)
- **Prix total** : quantite x prix unitaire

Metadata optionnelles par ligne :
- Document/mod.n° (reference technique)
- Matiere
- Dimensions/mesure
- Poids net
- Nomenclature douaniere
- Pays d'origine
- Machine (reference machine client)
- Disponibilite ("disponible")

## Structure Commande (avec offre liee)

Titre du document : **"Confirmation de commande"**

| Champ | Emplacement dans le PDF | Exemple |
|-------|------------------------|---------|
| Type document | Titre principal | "Confirmation de commande" |
| Reference commande | N° de reference | 70431366 |
| **Reference offre liee** | **N° de l'offre** | **50429576** ← cle de rapprochement |
| N° client ThermoPack | N° client | 201912 |
| Correspondant ThermoPack | Correspondant | Madame Durand |
| Client (nom) | Bloc adresse droite | Dynaplast S.A.S. |
| Client (code postal) | Bloc adresse droite | 89600 Saint Florentin |
| N° commande client | Votre n° de commande | 6DY164322 |
| Contact client (nom) | Votre nom | Kosal SAR |
| Date commande | Date | 12. Mars 2026 |
| Date expedition | date d'expedition | 17.03.2026 |
| Lignes articles | Meme structure que offre | identique |
| Remises | Remise % / Remise en % | -20% puis -11% (cascading) |
| Total TTC | Somme Total | 1 066,78 EUR |

## Structure Commande directe (sans offre)

Meme structure que commande, mais **pas de champ "N° de l'offre"**.
→ `offre_id = NULL` → type = "directe"

Exemple : 70431226 NordPack Annecy — commande directe sans offre prealable.

Cas particulier mentionne par Alice : quand le client n'a pas de numero de commande,
elle indique "BPA le [date]" (Bon Pour Accord) a la place.

## Points cles pour l'OCR

1. **Distinction offre/commande** : le titre dit "Offre" ou "Confirmation de commande"
2. **Rapprochement** : le champ `N° de l'offre` dans les commandes fait le lien
3. **Remises cascadees** : certaines commandes ont des remises empilees (ex: -20% puis -11%)
4. **Pages CGV** : pages 3+ sont toujours les CGV → ignorer pour l'extraction
5. **Format prix** : `6.174,00 EUR` (point = separateur milliers, virgule = decimales)
6. **Format date** : `13. Janvier 2026` ou `05.03.2026` (deux formats coexistent)
7. **Code postal client** → determine FR/ES (ex: Termoformados Iberia = Espagne)
8. **Correspondants ThermoPack** : Monsieur DUBOIS (Steven) ou Madame Durand (Alice)

## Exemples disponibles

| Dossier | Contenu | Nombre |
|---------|---------|--------|
| `docs/Offres non valides/` | Offres non transformees | 2 PDF |
| `docs/commandes sans offres/` | Commandes directes (sans offre) | 15 PDF |
| `docs/commandes transformer/` | Paires offre+commande transformees | 22 PDF (11 paires) |
| `docs/Mail workflow actuel/` | Screenshots + mail explicatif Alice | 7 fichiers |
