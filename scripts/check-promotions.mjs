// Vérifie les promotions JavaChrist : conversion REST Firestore, contrôle des campagnes, tirage, fréquence, droits.
// Usage : node scripts/check-promotions.mjs
import assert from "node:assert/strict";
import {
  afterGameCompleted,
  afterPromoShown,
  campaignFrom,
  campaignsFromCatalogDocument,
  catalogUrl,
  fromFirestoreValue,
  INITIAL_PROMO_STATE,
  isPromoDue,
  mayFetchCatalog,
  pickCampaign,
  PROMO_RULES,
  promotionsAllowed,
  promotionsConfigErrors,
  stillValid,
} from "../src/engine/promotions.ts";
import { computeEntitlements } from "../src/engine/entitlements.ts";
import { country } from "../content/fr/country.ts";
import { editions } from "../content/fr/editions.ts";

const NOW = new Date("2026-11-08T12:00:00.000Z");
const str = (stringValue) => ({ stringValue });
const int = (n) => ({ integerValue: String(n) });

const restCampaign = (overrides = {}) => ({
  mapValue: {
    fields: {
      id: str("souspli"),
      name: str("SousPli"),
      audience: str("adult"),
      locale: str("fr"),
      videoUrl: str("https://firebasestorage.googleapis.com/v0/b/b/o/campaigns%2Fa%2Fpromo.mp4?alt=media"),
      durationMs: int(14016),
      destinationUrl: str("https://play.google.com/store/apps/details?id=fr.javachrist.souspli"),
      weight: int(5),
      startsAt: str("2026-11-03T00:35:00.000Z"),
      endsAt: str("2027-05-02T22:30:00.000Z"),
      ...overrides,
    },
  },
});
const restDocument = (...campaigns) => ({
  name: "projects/p/databases/(default)/documents/public_catalogs/geofr",
  fields: {
    schemaVersion: int(1),
    sourceAppId: str("geofr"),
    generatedAt: { timestampValue: "2026-11-08T10:00:00Z" },
    campaigns: { arrayValue: campaigns.length > 0 ? { values: campaigns } : {} },
  },
});

// Conversion des valeurs REST.
assert.equal(fromFirestoreValue(str("a")), "a");
assert.equal(fromFirestoreValue(int(42)), 42);
assert.equal(fromFirestoreValue({ doubleValue: 1.5 }), 1.5);
assert.equal(fromFirestoreValue({ nullValue: null }), null);
assert.equal(fromFirestoreValue({ booleanValue: true }), true);
assert.deepEqual(fromFirestoreValue({ arrayValue: {} }), []);
assert.deepEqual(fromFirestoreValue({ mapValue: { fields: { a: int(1) } } }), { a: 1 });
assert.equal(fromFirestoreValue({ geoPointValue: {} }), undefined);
assert.equal(fromFirestoreValue(null), undefined);

// Catalogue complet.
const ridecloud = restCampaign({ id: str("ridecloud"), name: str("RideCloud"), weight: int(5), durationMs: int(14000) });
const list = campaignsFromCatalogDocument(restDocument(restCampaign(), ridecloud), "fr", NOW);
assert.deepEqual(list.map((c) => c.id), ["souspli", "ridecloud"]);
assert.equal(list[0].durationMs, 14016);
assert.equal(list[0].weight, 5);
assert.deepEqual(campaignsFromCatalogDocument(restDocument(), "fr", NOW), [], "catalogue vide");
assert.deepEqual(campaignsFromCatalogDocument({ error: { code: 404 } }, "fr", NOW), [], "document absent");
assert.deepEqual(campaignsFromCatalogDocument("x", "fr", NOW), []);
assert.equal(campaignsFromCatalogDocument(restDocument(restCampaign(), restCampaign()), "fr", NOW).length, 1, "doublon écarté");

// Campagnes refusées.
const refused = {
  "public non adulte": { audience: str("all") },
  "autre langue": { locale: str("de") },
  "vidéo en http": { videoUrl: str("http://example.com/v.mp4") },
  "destination hors Google Play": { destinationUrl: str("https://example.com/app") },
  "plus de 15 s": { durationMs: int(15_001) },
  "durée nulle": { durationMs: int(0) },
  "pas encore commencée": { startsAt: str("2026-12-01T00:00:00.000Z") },
  "terminée": { endsAt: str("2026-11-01T00:00:00.000Z") },
  "date illisible": { endsAt: str("bientôt") },
  "sans nom": { name: str(" ") },
  "sans identifiant": { id: str("") },
};
for (const [label, overrides] of Object.entries(refused)) {
  assert.deepEqual(campaignsFromCatalogDocument(restDocument(restCampaign(overrides)), "fr", NOW), [], label);
}
assert.ok(campaignFrom({ ...list[0], audience: "adult", locale: "fr", startsAt: null, endsAt: null }, "fr", NOW), "dates nulles acceptées");
assert.equal(campaignFrom({ ...list[0], audience: "adult", locale: "fr", weight: -3 }, "fr", NOW).weight, 1, "poids minimal 1");

// Cache recontrôlé : une campagne terminée depuis disparaît.
assert.equal(stillValid(list, "fr", NOW).length, 2);
assert.equal(stillValid(list, "fr", new Date("2027-06-01T00:00:00.000Z")).length, 0);
assert.equal(stillValid([{ id: 1 }], "fr", NOW).length, 0);

// Tirage : jamais deux fois la même vidéo de suite quand une autre existe.
for (let i = 0; i < 50; i += 1) {
  assert.equal(pickCampaign(list, "souspli", Math.random).id, "ridecloud");
  assert.equal(pickCampaign(list, "ridecloud", Math.random).id, "souspli");
}
assert.equal(pickCampaign([list[0]], "souspli", Math.random).id, "souspli", "une seule campagne : elle revient");
assert.equal(pickCampaign([], null, Math.random), null);
const weighted = [
  { ...list[0], id: "a", weight: 1 },
  { ...list[1], id: "b", weight: 3 },
];
assert.equal(pickCampaign(weighted, null, () => 0.1).id, "a");
assert.equal(pickCampaign(weighted, null, () => 0.5).id, "b");
assert.equal(pickCampaign(weighted, null, () => 0.999999).id, "b");

// Fréquence : une promotion après trois parties terminées.
let state = INITIAL_PROMO_STATE;
for (let i = 1; i < PROMO_RULES.gamesBetween; i += 1) {
  state = afterGameCompleted(state);
  assert.equal(isPromoDue(state), false, `${i} partie(s)`);
}
state = afterGameCompleted(state);
assert.equal(isPromoDue(state), true);
state = afterGameCompleted(state);
assert.equal(state.completedSinceLast, PROMO_RULES.gamesBetween, "plafonné : pas de promotions en rafale");
state = afterPromoShown(state, "souspli");
assert.equal(isPromoDue(state), false);
assert.equal(state.lastShownId, "souspli");

// Droits commerciaux : promotions pour le gratuit et les éditions avec publicités seulement.
const ready = (adsRemoved) => ({ configured: true, entitlementsReady: true, adsRemoved });
const rightsOf = (ids) => computeEntitlements(ids.map((editionId) => ({ editionId, status: "paid" })), editions);
const expected = { solo_ads: true, family_ads: true, solo_no_ads: false, family_no_ads: false };
for (const [id, shown] of Object.entries(expected)) {
  const rights = rightsOf([id]);
  assert.equal(promotionsAllowed(ready(rights.adsRemoved)), shown, id);
}
assert.equal(promotionsAllowed(ready(rightsOf([]).adsRemoved)), true, "version gratuite");
assert.equal(promotionsAllowed({ configured: true, entitlementsReady: false, adsRemoved: false }), false, "droits en cours de lecture");
assert.equal(promotionsAllowed({ configured: false, entitlementsReady: true, adsRemoved: false }), false, "pays non raccordé");

// Âge : aucune requête sans réponse « adulte ».
assert.equal(mayFetchCatalog(ready(false), { ...INITIAL_PROMO_STATE, adult: null }), false, "âge inconnu");
assert.equal(mayFetchCatalog(ready(false), { ...INITIAL_PROMO_STATE, adult: "minor" }), false, "mineur");
assert.equal(mayFetchCatalog(ready(false), { ...INITIAL_PROMO_STATE, adult: "adult" }), true);
assert.equal(mayFetchCatalog(ready(true), { ...INITIAL_PROMO_STATE, adult: "adult" }), false, "sans publicités");

// Configuration du pays.
assert.deepEqual(promotionsConfigErrors(country.promotions), [], "configuration fr");
assert.equal(country.promotions.sourceAppId, "geofr");
assert.equal(country.promotions.catalogProjectId, "motissimo-456ba");
assert.equal(
  catalogUrl(country.promotions),
  "https://firestore.googleapis.com/v1/projects/motissimo-456ba/databases/(default)/documents/public_catalogs/geofr",
);
assert.equal(promotionsConfigErrors({ ...country.promotions, sourceAppId: "Geo FR" }).length, 1);
assert.deepEqual(promotionsConfigErrors(null), []);

console.log("Promotions : conversion, contrôle, tirage, fréquence, droits et âge vérifiés.");
