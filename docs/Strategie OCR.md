# Strategie OCR — ThermoPack Industries

## Approche

Calibrer sur les vrais PDF d'Alice avant de choisir l'outil definitif.

## Plan de test (des reception des 10-15 PDF exemples)

### Phase 1 — Claude Vision direct (baseline)

1. Tester Claude Sonnet via OpenRouter sur les 10-15 PDF (offres + commandes)
2. Prompt structure : extraction JSON (reference, entreprise, montants HT/TTC, designations avec quantites et prix unitaires)
3. Mesurer :
   - Taux d'extraction correcte par champ (reference, montant, entreprise, lignes)
   - Score de confiance moyen
   - Cas d'echec : scans vs PDF natifs, formats exotiques, references alphanumeriques complexes
4. Seuil de validation : **90%+ precision sur les champs critiques** (reference, montant HT)

### Phase 2 — Azure Document Intelligence (si Claude < 90%)

1. Creer un tier F0 Azure (gratuit, 500 pages/mois)
2. Utiliser le modele prebuilt Invoice sur les memes PDF
3. Comparer precision par champ vs Claude
4. Tester specifiquement l'extraction des lignes de commande (Azure = 87% benchmark)

### Phase 3 — Hybride (si un seul outil ne suffit pas)

- Mistral OCR ($1/1000 pages) pour extraction texte brut
- Claude pour structuration JSON derriere
- Ou Azure pour l'OCR + Claude pour les champs que Azure rate

## Criteres de decision

| Critere | Claude seul | Azure seul | Hybride |
|---------|-------------|------------|---------|
| Precision references | A tester | 93% benchmark | Meilleur des deux |
| Precision lignes | A tester | 87% benchmark | Meilleur des deux |
| Cout/mois (500 docs) | ~$5 | Gratuit (F0) | ~$3-8 |
| Complexite n8n | 1 node | 1 HTTP Request | 2-3 nodes |
| Deja dans la stack | Oui | Non | Partiellement |

## A eviter

- Google Document AI : 40% sur lignes, inutilisable
- AWS Textract : 78% precision globale
- Rossum / Veryfi : $500-18k/an, hors budget
