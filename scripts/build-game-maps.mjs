// Génère content/<pays>/maps/<id>.json, les cartes des défis, depuis game-maps.config.json.
// Chaque zone regroupe une ou plusieurs entités de la source. Le résultat est versionné,
// l'application ne dépend pas de mapshaper. La carte nationale reste produite par build-map.mjs.
// Usage : node scripts/build-game-maps.mjs [pays]
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const WIDTH = 1000;
const PADDING = 6;

const code = process.argv[2] ?? "fr";
const config = JSON.parse(readFileSync(`content/${code}/game-maps.config.json`, "utf8"));

const response = await fetch(config.source.url, { headers: { "User-Agent": "geofr-build" } });
if (!response.ok) throw new Error(`Téléchargement impossible : ${response.status}`);
const raw = Buffer.from(await response.arrayBuffer());
const sha256 = createHash("sha256").update(raw).digest("hex");
if (sha256 !== config.source.sha256) throw new Error(`Empreinte inattendue : ${sha256}`);

const source = JSON.parse(raw.toString("utf8"));
const work = mkdtempSync(join(tmpdir(), "geo-game-map-"));

const ringsOf = (geometry) => (geometry.type === "Polygon" ? geometry.coordinates : geometry.coordinates.flat());
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

mkdirSync(`content/${code}/maps`, { recursive: true });

for (const { id, simplify, zones } of config.maps) {
  const features = source.features
    .filter((feature) => zones[feature.properties[config.idProperty]])
    .map((feature) => ({ ...feature, properties: { zone: zones[feature.properties[config.idProperty]] } }));

  const input = join(work, `${id}.json`);
  const output = join(work, `${id}-out.json`);
  writeFileSync(input, JSON.stringify({ type: "FeatureCollection", features }));
  execSync(
    `npx --yes mapshaper@0.6.121 "${input}" -dissolve zone -proj "${config.projection}" -simplify ${simplify} keep-shapes -clean -o "${output}" format=geojson`,
    { stdio: "pipe" },
  );
  const projected = JSON.parse(readFileSync(output, "utf8")).features;

  const points = projected.flatMap((feature) => ringsOf(feature.geometry).flat());
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const scale = (WIDTH - PADDING * 2) / (maxX - minX);
  const place = ([x, y]) => [PADDING + (x - minX) * scale, PADDING + (maxY - y) * scale];

  const map = {
    id,
    viewBox: `0 0 ${WIDTH} ${Math.ceil((maxY - minY) * scale + PADDING * 2)}`,
    zones: projected
      .map((feature) => ({ id: feature.properties.zone, path: toPath(ringsOf(feature.geometry).map((ring) => ring.map(place))) }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };

  const target = `content/${code}/maps/${id}.json`;
  writeFileSync(target, `${JSON.stringify(map)}\n`);
  console.log(`${target} : ${map.zones.length} zones, ${JSON.stringify(map).length} octets, viewBox ${map.viewBox}`);
}
