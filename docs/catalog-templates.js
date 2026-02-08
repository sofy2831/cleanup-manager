// docs/catalog-templates.js
// Source “front” partagée (sans Firestore) pour :
// - nouvelle-prestation.html (select catalogue + suggestions)
// - devis-free.html (réf + désignation)
// - éventuellement interventions/prestations etc.
//
// ⚠️ Important :
// - key = référence stable (ce que tu veux afficher comme "Réf catalogue")
// - label = désignation affichée
// - category = catégorie
// - unit = unité par défaut (cohérent avec tes pages)
// - suggested = texte “tarif conseillé” (optionnel)
// - kind = "SERVICE" ou "KIT"

function slugifyRef(s){
  return String(s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")     // accents
    .toUpperCase()
    .replace(/&/g," AND ")
    .replace(/[^A-Z0-9]+/g,"_")
    .replace(/^_+|_+$/g,"")
    .replace(/_+/g,"_");
}

// --- mapping “unité” de catalogue.html -> unité standard CleanUp ---
function normalizeUnit(u){
  const x = String(u||"").toLowerCase().trim();
  if(!x) return "unité";

  if(x.includes("passage") || x.includes("rotation")) return "passage";
  if(x.includes("mois")) return "mois";
  if(x.includes("kit")) return "kit";
  if(x.includes("intervention")) return "unité";
  if(x.includes("supp")) return "supplément";
  if(x.includes("inclus")) return "passage"; // “inclus” => 1 passage à 0€
  return "unité";
}

function mapCategoryService(t){
  const x = String(t||"").trim();
  // correspondance avec nouvelle-prestation.html (category select)
  if(x === "Ménage") return "Ménage";
  if(x === "Linge") return "Linge";
  if(x === "Check-in / Check-out") return "Check-in/out";
  if(x === "Maintenance") return "Maintenance";
  if(x === "Suivi") return "Essentiel";
  if(x === "Administratif") return "Autre";
  if(x === "Services complémentaires") return "Autre";
  return "Autre";
}

function mapCategoryKit(t){
  const x = String(t||"").trim();
  if(x === "Essentiel" || x === "Cuisine" || x === "Salle de bain" || x === "Séjour" || x === "Réassort"){
    return "Kits & consommables";
  }
  return "Kits & consommables";
}

// ====== RAW depuis ton catalogue.html (services + kits) ======
const RAW_SERVICES = [
  { id:101, name:"Ménage standard (inter-séjour)", type:"Ménage", priceSuggested:"45 € (studio/1ch) • 60 € (2ch) • 75 € (3ch) • 90 € (4ch)", unit:"par passage" },
  { id:102, name:"Ménage intermédiaire (long séjour)", type:"Ménage", priceSuggested:"+15 €", unit:"supplément" },
  { id:103, name:"Back-to-back (ménage en urgence)", type:"Ménage", priceSuggested:"+20 €", unit:"supplément" },
  { id:104, name:"Remise en état (logement sale / non conforme)", type:"Remise en état", priceSuggested:"+25 €", unit:"supplément" },
  { id:105, name:"Signalement anomalies (photos, dégâts)", type:"Suivi", priceSuggested:"0 €", unit:"inclus" },

  { id:120, name:"Rechange linge (rotation complète)", type:"Linge", priceSuggested:"15 €", unit:"par passage" },
  { id:121, name:"Collecte + lavage + séchage (conciergerie)", type:"Linge", priceSuggested:"25 €", unit:"par rotation" },
  { id:122, name:"Dépose / reprise blanchisserie externe", type:"Linge", priceSuggested:"20 €", unit:"par rotation" },

  { id:130, name:"Check-in autonome (boîte à clés)", type:"Check-in / Check-out", priceSuggested:"0 €", unit:"inclus" },
  { id:131, name:"Check-in physique", type:"Check-in / Check-out", priceSuggested:"25 €", unit:"par passage" },
  { id:132, name:"Check-out", type:"Check-in / Check-out", priceSuggested:"0 €", unit:"inclus" },
  { id:133, name:"Gestion clés / badges", type:"Check-in / Check-out", priceSuggested:"0 €", unit:"inclus" },
  { id:134, name:"Récupération clés après sortie", type:"Check-in / Check-out", priceSuggested:"10 €", unit:"par passage" },

  { id:140, name:"Petite maintenance (ampoule, pile, joint…)", type:"Maintenance", priceSuggested:"15 €", unit:"par intervention" },
  { id:141, name:"Intervention d’urgence (fuite, élec, serrure)", type:"Maintenance", priceSuggested:"40 €", unit:"par intervention" },
  { id:142, name:"Coordination artisans", type:"Maintenance", priceSuggested:"30 €", unit:"par coordination" },

  { id:150, name:"Photos après ménage", type:"Suivi", priceSuggested:"0 €", unit:"inclus" },

  { id:160, name:"Facturation & suivi des prestations", type:"Administratif", priceSuggested:"0 €", unit:"inclus" },
  { id:161, name:"Détail par séjour", type:"Administratif", priceSuggested:"0 €", unit:"inclus" },
  { id:162, name:"Historique des factures", type:"Administratif", priceSuggested:"0 €", unit:"inclus" },
  { id:163, name:"Récapitulatif mensuel propriétaire", type:"Administratif", priceSuggested:"0 €", unit:"inclus" },

  { id:170, name:"Réponses messages voyageurs", type:"Services complémentaires", priceSuggested:"30 € / logement / mois (ou 2 € / message)", unit:"forfait (ou à l’acte)" },
];

const RAW_KITS = [
  { id:201, name:"Kit essentiel", type:"Essentiel", priceSuggested:"6,90 €", unit:"par kit" },
  { id:202, name:"Kit cuisine", type:"Cuisine", priceSuggested:"3,90 €", unit:"par kit" },
  { id:203, name:"Kit bain", type:"Salle de bain", priceSuggested:"3,90 €", unit:"par kit" },
  { id:204, name:"Kit séjour (essentiel + cuisine + bain – 2 pers)", type:"Séjour", priceSuggested:"13,90 €", unit:"par kit" },
  { id:205, name:"Kit séjour (4 pers)", type:"Séjour", priceSuggested:"27,80 €", unit:"par kit" },
  { id:206, name:"Kit séjour (6 pers)", type:"Séjour", priceSuggested:"41,70 €", unit:"par kit" },
  { id:207, name:"Kit séjour (8 pers)", type:"Séjour", priceSuggested:"55,60 €", unit:"par kit" },
  { id:208, name:"Réassort produit unitaire (papier, sac, café…)", type:"Réassort", priceSuggested:"2 €", unit:"par unité" },
];

// ====== Build templates ======
function buildTemplates(){
  const out = [];

  for(const s of RAW_SERVICES){
    const key = "SVC_" + slugifyRef(s.name);
    out.push({
      key,
      label: s.name,
      category: mapCategoryService(s.type),
      unit: normalizeUnit(s.unit),
      suggested: String(s.priceSuggested || "").trim(),
      kind: "SERVICE",
      sourceId: s.id
    });
  }

  for(const k of RAW_KITS){
    const key = "KIT_" + slugifyRef(k.name);
    out.push({
      key,
      label: k.name,
      category: mapCategoryKit(k.type),
      unit: normalizeUnit(k.unit),
      suggested: String(k.priceSuggested || "").trim(),
      kind: "KIT",
      sourceId: k.id
    });
  }

  // “Autre” (texte libre)
  out.push({
    key: "__OTHER__",
    label: "Autre (texte libre)",
    category: "Autre",
    unit: "unité",
    suggested: "",
    kind: "OTHER",
    sourceId: 0
  });

  return out;
}

export const PRODUCT_TEMPLATES = buildTemplates();

// index utiles
export const TPL_BY_KEY = new Map(PRODUCT_TEMPLATES.map(p => [p.key, p]));
export const KEY_BY_LABEL = new Map(PRODUCT_TEMPLATES.map(p => [String(p.label||"").trim(), p.key]));

// Helpers
export function getTemplateByKey(key){
  return TPL_BY_KEY.get(String(key||"").trim()) || null;
}

export function inferRefFromLabel(label){
  return KEY_BY_LABEL.get(String(label||"").trim()) || "";
}

// utile si tu veux filtrer
export function getTemplatesByKind(kind){
  const k = String(kind||"").toUpperCase();
  return PRODUCT_TEMPLATES.filter(p => String(p.kind||"").toUpperCase() === k);
}
