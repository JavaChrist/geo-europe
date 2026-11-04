import type { CountryContent, CountryMap, GameMap, MediaCredit, Region, Territory } from "../../src/engine/types.ts";
import { country } from "./country.ts";
import map from "./map.json";
import credits from "./media/credits.json";
import fr from "./locales/fr.json";
import mapGrandEstDepartements from "./maps/grand-est-departements.json";
import mapGrandEstTerritoires from "./maps/grand-est-territoires.json";
import alsace from "./territories/alsace.json";
import lorraine from "./territories/lorraine.json";
import region0 from "./regions/auvergne-rhone-alpes.json";
import region1 from "./regions/bourgogne-franche-comte.json";
import region2 from "./regions/bretagne.json";
import region3 from "./regions/centre-val-de-loire.json";
import region4 from "./regions/corse.json";
import region5 from "./regions/grand-est.json";
import region6 from "./regions/hauts-de-france.json";
import region7 from "./regions/ile-de-france.json";
import region8 from "./regions/normandie.json";
import region9 from "./regions/nouvelle-aquitaine.json";
import region10 from "./regions/occitanie.json";
import region11 from "./regions/pays-de-la-loire.json";
import region12 from "./regions/provence-alpes-cote-d-azur.json";
import region13 from "./regions/guadeloupe.json";
import region14 from "./regions/martinique.json";
import region15 from "./regions/guyane.json";
import region16 from "./regions/la-reunion.json";
import region17 from "./regions/mayotte.json";

const content: CountryContent = {
  country,
  regions: [region0, region1, region2, region3, region4, region5, region6, region7, region8, region9, region10, region11, region12, region13, region14, region15, region16, region17] as Region[],
  map: map as CountryMap,
  territories: [alsace, lorraine] as Territory[],
  gameMaps: [mapGrandEstDepartements, mapGrandEstTerritoires] as GameMap[],
  credits: credits as MediaCredit[],
  messages: { fr },
};

export default content;
