// Génère content/<pays>/map.json depuis les contours décrits dans map.config.json.
// À lancer une seule fois par pays : le résultat est versionné, l'application ne dépend pas de mapshaper.
// Usage : node scripts/build-map.mjs [pays]
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const WIDTH = 1000;
const PADDING = 6;
const INSET_GAP = 16;
const INSET_HEIGHT = 170;
const INSET_LABEL = 44;
const INSET_MARGIN = 12;
const TOUCH_MIN_SIZE = 140; // Sous cette taille, une région passe sous les 44 px sur un téléphone.
const TOUCH_RADIUS = 72; // Diamètre d'environ 46 px sur un écran de 375 px.

const code = process.argv[2] ?? "fr";
const config = JSON.parse(readFileSync(`content/${code}/map.config.json`, "utf8"));

const response = await fetch(config.source.url, { headers: { "User-Agent": "geofr-build" } });
if (!response.ok) throw new Error(`Téléchargement impossible : ${response.status}`);
const raw = Buffer.from(await response.arrayBuffer());
const sha256 = createHash("sha256").update(raw).digest("hex");
if (sha256 !== config.source.sha256) throw new Error(`Empreinte inattendue : ${sha256}`);

const source = JSON.parse(raw.toString("utf8"));
const work = mkdtempSync(join(tmpdir(), "geo-map-"));
const idOf = (feature) => config.ids[feature.properties[config.idProperty]];

/** Projette et simplifie un groupe de régions : les encarts, agrandis, gardent plus de détail. */
function prepare(name, features, simplify) {
  const input = join(work, `${name}.json`);
  const output = join(work, `${name}-out.json`);
  writeFileSync(input, JSON.stringify({ type: "FeatureCollection", features }));
  execSync(
    `npx --yes mapshaper@0.6.121 "${input}" -proj "${config.projection}" -simplify ${simplify} keep-shapes -clean -o "${output}" format=geojson`,
    { stdio: "pipe" },
  );
  return JSON.parse(readFileSync(output, "utf8")).features;
}

const ringsOf = (geometry) => (geometry.type === "Polygon" ? geometry.coordinates : geometry.coordinates.flat());

function boundsOf(features) {
  const points = features.flatMap((feature) => ringsOf(feature.geometry).flat());
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

const round = (value) => Math.round(value * 10) / 10;

/** Chemin SVG en coordonnées relatives, plus court et sans cumul d'arrondis. */
function toPath(rings) {
  return rings
    .map((ring) => {
      const points = ring.slice(0, -1).map(([x, y]) => [round(x), round(y)]);
      const [first, ...rest] = points;
      let [px, py] = first;
      const steps = rest.map(([x, y]) => {
        const step = `${round(x - px)} ${round(y - py)}`;
        [px, py] = [x, y];
        return step;
      });
      return `M${first[0]} ${first[1]}l${steps.join(" ")}z`;
    })
    .join("");
}

/** Place un groupe dans un cadre, sans déformation et y vers le bas. */
function fit(features, box) {
  const bounds = boundsOf(features);
  const scale = Math.min(box.width / (bounds.maxX - bounds.minX), box.height / (bounds.maxY - bounds.minY));
  const offsetX = box.x + (box.width - (bounds.maxX - bounds.minX) * scale) / 2;
  const offsetY = box.y + (box.height - (bounds.maxY - bounds.minY) * scale) / 2;
  const place = ([x, y]) => [offsetX + (x - bounds.minX) * scale, offsetY + (bounds.maxY - y) * scale];
  return features.map((feature) => ({
    regionId: idOf(feature),
    rings: ringsOf(feature.geometry).map((ring) => ring.map(place)),
  }));
}

function describe({ regionId, rings }, extra = {}) {
  const points = rings.flat();
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const small = !extra.inset && Math.min(maxX - minX, maxY - minY) < TOUCH_MIN_SIZE;
  return {
    regionId,
    path: toPath(rings),
    bbox: [round(minX), round(minY), round(maxX - minX), round(maxY - minY)],
    center: [round((minX + maxX) / 2), round((minY + maxY) / 2)],
    ...(small && { hitRadius: TOUCH_RADIUS }),
    ...extra,
  };
}

const insetIds = new Set(config.insets);
const main = prepare("main", source.features.filter((f) => !insetIds.has(idOf(f))), config.simplify.main);
const insets = prepare("insets", source.features.filter((f) => insetIds.has(idOf(f))), config.simplify.insets);

const mainBounds = boundsOf(main);
const inner = WIDTH - PADDING * 2;
const mainHeight = (inner * (mainBounds.maxY - mainBounds.minY)) / (mainBounds.maxX - mainBounds.minX);
const mainBox = { x: PADDING, y: PADDING, width: inner, height: mainHeight };

const rowY = PADDING + mainHeight + INSET_GAP * 1.5;
const cellWidth = (inner - INSET_GAP * (config.insets.length - 1)) / config.insets.length;

const insetRegions = config.insets.map((regionId, index) => {
  const cell = { x: PADDING + index * (cellWidth + INSET_GAP), y: rowY, width: cellWidth, height: INSET_HEIGHT };
  const box = {
    x: cell.x + INSET_MARGIN,
    y: cell.y + INSET_MARGIN,
    width: cell.width - INSET_MARGIN * 2,
    height: cell.height - INSET_MARGIN - INSET_LABEL,
  };
  const [placed] = fit(insets.filter((feature) => idOf(feature) === regionId), box);
  const inset = { x: round(cell.x), y: round(cell.y), width: round(cell.width), height: cell.height };
  return describe(placed, { inset });
});

// Les régions à zone tactile élargie passent en dernier, donc au-dessus de leurs voisines.
const mainRegions = fit(main, mainBox)
  .map((region) => describe(region))
  .sort((a, b) => Number(Boolean(a.hitRadius)) - Number(Boolean(b.hitRadius)));

const map = {
  viewBox: `0 0 ${WIDTH} ${Math.ceil(rowY + INSET_HEIGHT + PADDING)}`,
  regions: [...mainRegions, ...insetRegions],
};

const target = `content/${code}/map.json`;
writeFileSync(target, `${JSON.stringify(map)}\n`);
console.log(`${target} : ${map.regions.length} régions, ${JSON.stringify(map).length} octets, viewBox ${map.viewBox}`);
console.log(`Zones tactiles élargies : ${map.regions.filter((r) => r.hitRadius).map((r) => r.regionId).join(", ") || "aucune"}`);
