// Enums — aligned with scripts/001-schema-initial.sql

export type StatutOffre =
  | "en_attente"
  | "transformee"
  | "partiellement_transformee"
  | "expiree";

export type TypeCommande = "partielle" | "egale" | "superieure" | "directe";

export type PaysEnum = "FR" | "ES" | "MA" | "TN" | "RE";

export type StatutOcr = "success" | "partial" | "failed";

export type StatutLivraison = "liquide" | "non_livre" | "partiellement_livre";

// Table types

export interface Entreprise {
  id: string;
  nom: string;
  code_postal: string | null;
  pays: PaysEnum;
  adresse: string | null;
  contact_nom: string | null;
  contact_email: string | null;
  contact_telephone: string | null;
  numero_client: string | null;
  siret: string | null;
  tva_intracommunautaire: string | null;
  conditions_paiement: string | null;
  email_facturation: string | null;
  contact_email_secondaire: string | null;
  contact_livraison_nom: string | null;
  contact_livraison_email: string | null;
  contact_livraison_telephone: string | null;
  adresse_livraison: string | null;
  code_postal_livraison: string | null;
  ville_livraison: string | null;
  ville: string | null;
  departement: string | null;
  region: string | null;
  notes: string | null;
  source: string | null;
  noms_alternatifs: string[];
  created_at: string;
  updated_at: string;
}

export interface Offre {
  id: string;
  reference_offre: string;
  entreprise_id: string;
  montant_ht: number | null;
  montant_ttc: number | null;
  date_offre: string;
  date_expiration: string | null;
  statut: StatutOffre;
  correspondant: string | null;
  designations: Designation[];
  fichier_source: string | null;
  notes: string | null;
  source_import: string;
  sap_created_by: string | null;
  created_at: string;
  updated_at: string;
  derniere_relance: string | null;
}

export interface Commande {
  id: string;
  reference_commande: string;
  offre_id: string | null;
  entreprise_id: string;
  montant_ht: number | null;
  montant_ttc: number | null;
  date_commande: string;
  date_expedition: string | null;
  type: TypeCommande;
  designations: Designation[];
  fichier_source: string | null;
  notes: string | null;
  numero_commande_client: string | null;
  source_import: string;
  statut_livraison: string | null;
  sap_created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OcrLog {
  id: string;
  fichier_source: string;
  type_document: "offre" | "commande";
  statut: StatutOcr;
  donnees_extraites: Record<string, unknown> | null;
  erreurs: string[] | null;
  score_confiance: number | null;
  record_id: string | null;
  duree_ms: number | null;
  created_at: string;
}

// Shared types

export interface Designation {
  position?: number;
  reference_materiel?: string;
  designation: string;
  designation_fr?: string;
  quantite: number;
  prix_unitaire: number;
  montant_ligne?: number;
}

// Join types (for queries with relations)

export interface OffreWithEntreprise extends Offre {
  entreprises: Entreprise;
}

export interface CommandeWithRelations extends Commande {
  entreprises: Entreprise;
  offres: Offre | null;
}

// RPC return types

export interface TauxTransformation {
  total_offres: number;
  offres_transformees: number;
  offres_partielles: number;
  offres_en_attente: number;
  montant_offres: number;
  montant_commandes: number;
  taux_transformation: number;
}

export interface OffreNonTransformee {
  id: string;
  reference_offre: string;
  entreprise_nom: string;
  entreprise_pays: PaysEnum;
  montant_ht: number | null;
  date_offre: string;
  date_expiration: string | null;
  jours_restants: number | null;
  contact_email: string | null;
  contact_nom: string | null;
  derniere_relance: string | null;
}

export interface TopClient {
  entreprise_id: string;
  entreprise_nom: string;
  pays: PaysEnum;
  nb_offres: number;
  nb_transformees: number;
  taux_transformation: number;
  montant_total_offres: number;
  ca_commandes: number;
}

export interface StatsPays {
  pays: PaysEnum;
  nb_offres: number;
  nb_transformees: number;
  taux_transformation: number;
  montant_offres: number;
  montant_commandes: number;
}

export interface KpisDirection {
  ca_total: number;
  ca_france: number;
  ca_espagne: number;
  nb_offres_emises: number;
  nb_commandes_recues: number;
  montant_offres: number;
  montant_commandes: number;
  taux_conversion: number;
  ca_total_precedent: number;
  evolution_pct: number;
  nb_commandes_directes: number;
  montant_commandes_directes: number;
}

export interface CaMensuel {
  mois: number;
  mois_label: string;
  ca_france: number;
  ca_espagne: number;
  ca_total: number;
  nb_commandes: number;
}

export interface TopMateriau {
  reference_materiel: string;
  designation: string;
  nb_commandes: number;
  quantite_totale: number;
  ca_total: number;
}

export interface RecurrenceClient {
  entreprise_id: string;
  entreprise_nom: string;
  pays: PaysEnum;
  nb_commandes: number;
  frequence_moyenne_jours: number;
  derniere_commande: string;
  ca_total: number;
}

export interface StatsParRegion {
  region: string;
  nb_clients: number;
  nb_offres: number;
  nb_commandes: number;
  ca_total: number;
}

export interface FicheEntrepriseKpis {
  nb_offres: number;
  nb_commandes: number;
  nb_transformees: number;
  taux_transformation: number;
  ca_offres: number;
  ca_commandes: number;
}

export interface Piece {
  id: string;
  reference: string;
  nom_fr: string;
  nom_original: string | null;
  variantes: string[];
  categorie: string | null;
  created_at: string;
  updated_at: string;
}

export interface OffreLigne {
  id: string;
  offre_id: string;
  piece_id: string | null;
  poste: number | null;
  designation_brute: string | null;
  quantite: number;
  prix_unitaire: number | null;
  created_at: string;
  pieces?: Piece | null;
}

export interface CommandeLigne {
  id: string;
  commande_id: string;
  piece_id: string | null;
  poste: number | null;
  designation_brute: string | null;
  quantite: number;
  prix_unitaire: number | null;
  created_at: string;
  pieces?: Piece | null;
}

export interface TopPieceEntreprise {
  reference: string;
  nom_fr: string;
  nb_commandes: number;
  quantite_totale: number;
}

export interface AlertesDashboard {
  expirent_7j: number;
  jamais_relancees: number;
  sans_email: number;
}

export interface EntrepriseSansEmail {
  entreprise_id: string;
  entreprise_nom: string;
  pays: PaysEnum;
  nb_offres_en_attente: number;
}
