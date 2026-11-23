// Catalogue partagé CleanUp Manager — source unique des modèles de prestations.
// Les tarifs sont des suggestions éditables, pas des prix contractuels.
// Les remises négatives ne sont autorisées que pour la référence REMISE_DIAG.
export const PRODUCT_TEMPLATES = [
  { key:'MENAGE_STANDARD', label:'Ménage standard (inter-séjour)', category:'Ménage', suggested:'Ex. 45€ (studio/1ch) • 60€ (2ch) • 75€ (3ch) • 90€ (4ch)', unit:'unité', kind:'SERVICE', lineType:'SERVICE' },
  { key:'MENAGE_INTERMEDIAIRE', label:'Ménage intermédiaire (long séjour)', category:'Ménage', suggested:'Ex. +15€ supplément Long séjour', unit:'supplément', kind:'SERVICE', lineType:'SERVICE' },
  { key:'BACK_TO_BACK', label:'Back-to-back (ménage en urgence)', category:'Ménage', suggested:'Ex. +20€ supplément Urgence', unit:'supplément', kind:'SERVICE', lineType:'SERVICE' },
  { key:'REMISE_EN_ETAT', label:'Remise en état (logement non conforme)', category:'Ménage', suggested:'Ex. +25€ supplément Non conforme', unit:'supplément', kind:'SERVICE', lineType:'SERVICE' },
  { key:'RECHANGE_LINGE', label:'Rechange linge (rotation complète)', category:'Linge', suggested:'Ex. 15€ par passage Rotation', unit:'passage', kind:'SERVICE', lineType:'SERVICE' },
  { key:'LAVAGE_SECHAGE', label:'Collecte + lavage + séchage', category:'Linge', suggested:'Ex. 25€ par rotation', unit:'unité', kind:'SERVICE', lineType:'SERVICE' },
  { key:'BLANCHISSERIE', label:'Dépose / reprise blanchisserie', category:'Linge', suggested:'Ex. 20€ par rotation', unit:'unité', kind:'SERVICE', lineType:'SERVICE' },
  { key:'CHECKIN_AUTONOME', label:'Check-in autonome (boîte à clés)', category:'Check-in/out', suggested:'Ex. 0€ inclus', unit:'passage', kind:'SERVICE', lineType:'SERVICE' },
  { key:'CHECKIN_PHYSIQUE', label:'Check-in physique', category:'Check-in/out', suggested:'Ex. 20€ par passage', unit:'passage', kind:'SERVICE', lineType:'SERVICE' },
  { key:'CHECKOUT', label:'Check-out', category:'Check-in/out', suggested:'Ex. 15€ par passage', unit:'passage', kind:'SERVICE', lineType:'SERVICE' },
  { key:'GESTION_CLES', label:'Gestion clés / badges', category:'Check-in/out', suggested:'Ex. 10€ par intervention', unit:'unité', kind:'SERVICE', lineType:'SERVICE' },
  { key:'RECUP_CLES', label:'Récupération clés après sortie', category:'Check-in/out', suggested:'Ex. 10€ par passage', unit:'passage', kind:'SERVICE', lineType:'SERVICE' },
  { key:'PETITE_MAINTENANCE', label:'Petite maintenance (ampoule, joint…)', category:'Maintenance', suggested:'Ex. 15€ par intervention', unit:'unité', kind:'SERVICE', lineType:'SERVICE' },
  { key:'URGENCE', label:'Intervention d’urgence (fuite, serrure)', category:'Maintenance', suggested:'Ex. 40€ par intervention', unit:'unité', kind:'SERVICE', lineType:'SERVICE' },
  { key:'COORD_ARTISANS', label:'Coordination artisans', category:'Maintenance', suggested:'Ex. 30€ par coordination (hors coût artisan)', unit:'unité', kind:'SERVICE', lineType:'SERVICE' },
  { key:'MESSAGES', label:'Réponses messages voyageurs', category:'Messages voyageurs', suggested:'Ex. 19€/logement/mois (20 mess) + 1,20€/mess supp', unit:'mois', kind:'SERVICE', lineType:'SERVICE' },
  { key:'KIT_ESSENTIEL', label:'Kit essentiel', category:'Kits & consommables', suggested:'Ex. 5€ par kit', unit:'kit', kind:'KIT', lineType:'PRODUCT' },
  { key:'KIT_CUISINE', label:'Kit cuisine', category:'Kits & consommables', suggested:'Ex. 7€ par kit', unit:'kit', kind:'KIT', lineType:'PRODUCT' },
  { key:'KIT_BAIN', label:'Kit bain', category:'Kits & consommables', suggested:'Ex. 4€ par kit', unit:'kit', kind:'KIT', lineType:'PRODUCT' },
  { key:'KIT_SEJOUR_2', label:'Kit séjour (Pack 2 pers)', category:'Kits & consommables', suggested:'Ex. 14€ par kit', unit:'kit', kind:'KIT', lineType:'PRODUCT' },
  { key:'KIT_SEJOUR_4', label:'Kit séjour (Pack 4 pers)', category:'Kits & consommables', suggested:'Ex. 28€ par kit', unit:'kit', kind:'KIT', lineType:'PRODUCT' },
  { key:'KIT_SEJOUR_6', label:'Kit séjour (Pack 6 pers)', category:'Kits & consommables', suggested:'Ex. 42€ par kit', unit:'kit', kind:'KIT', lineType:'PRODUCT' },
  { key:'KIT_SEJOUR_8', label:'Kit séjour (Pack 8 pers)', category:'Kits & consommables', suggested:'Ex. 56€ par kit', unit:'kit', kind:'KIT', lineType:'PRODUCT' },
  { key:'REASSORT', label:'Réassort produit unitaire (papier, café…)', category:'Kits & consommables', suggested:'Ex. 1,20€ par unité', unit:'unité', kind:'KIT', lineType:'PRODUCT' },
  { key:'CREATION_ANNONCE', priceMode:'TTC', label:'Création d’annonce', category:'Essentiel', suggested:'99 € TTC', unit:'unité', kind:'SERVICE', lineType:'SERVICE', defaultPrice:99 },
  { key:'DIAG_RENTABILITE', priceMode:'TTC', label:'Étude de rentabilité personnalisée', category:'Essentiel', suggested:'49 € TTC', unit:'unité', kind:'SERVICE', lineType:'SERVICE', defaultPrice:49 },
  { key:'REMISE_DIAG', priceMode:'TTC', label:'Déduction étude de rentabilité déjà réglée', category:'Remise commerciale', suggested:'−49 € TTC (modifiable, si diagnostic déjà réglé)', unit:'unité', kind:'SERVICE', lineType:'SERVICE', defaultPrice:-49 },
  { key:'SVC_SIGNALEMENT_ANOMALIES_PHOTOS_DEGATS', label:'Signalement anomalies (photos, dégâts)', category:'Essentiel', suggested:'0 €', unit:'unité', kind:'SERVICE', lineType:'SERVICE' },
  { key:'SVC_PHOTOS_APRES_MENAGE', label:'Photos après ménage', category:'Essentiel', suggested:'0 €', unit:'unité', kind:'SERVICE', lineType:'SERVICE' },
  { key:'SVC_FACTURATION_SUIVI_DES_PRESTATIONS', label:'Facturation & suivi des prestations', category:'Essentiel', suggested:'0 €', unit:'unité', kind:'SERVICE', lineType:'SERVICE' },
  { key:'SVC_DETAIL_PAR_SEJOUR', label:'Détail par séjour', category:'Essentiel', suggested:'0 €', unit:'unité', kind:'SERVICE', lineType:'SERVICE' },
  { key:'SVC_HISTORIQUE_DES_FACTURES', label:'Historique des factures', category:'Essentiel', suggested:'0 €', unit:'unité', kind:'SERVICE', lineType:'SERVICE' },
  { key:'SVC_RECAPITULATIF_MENSUEL_PROPRIETAIRE', label:'Récapitulatif mensuel propriétaire', category:'Essentiel', suggested:'0 €', unit:'unité', kind:'SERVICE', lineType:'SERVICE' },
  { key:'__OTHER__', label:'Autre (texte libre)', category:'Autre', suggested:'', unit:'unité', kind:'OTHER', lineType:'SERVICE' }
];
export const TPL_BY_KEY = new Map(PRODUCT_TEMPLATES.map(p => [p.key,p]));
export const KEY_BY_LABEL = new Map(PRODUCT_TEMPLATES.map(p => [p.label,p.key]));
export const getTemplateByKey = key => TPL_BY_KEY.get(String(key||"")) || null;
export const inferRefFromLabel = label => KEY_BY_LABEL.get(String(label||"")) || "";
export const getTemplatesByKind = kind => PRODUCT_TEMPLATES.filter(p => p.kind === String(kind||"").toUpperCase());

// Seules ces trois prestations ont un prix catalogue exprimé en TTC.
// Les autres prestations restent saisies en HT dans les documents de vente.
export const isTtcCatalogPrice = key => ['CREATION_ANNONCE','DIAG_RENTABILITE','REMISE_DIAG'].includes(String(key||''));
export function catalogTtcToHt(ttc, rate){
  const value=Number(ttc), tax=Number(rate)||0;
  if(!Number.isFinite(value)) return NaN;
  return Math.round((value/(1+tax)+Number.EPSILON)*100)/100;
}
