import type { CountryContent, CountryMap, GameMap, MediaCredit, Region, Territory } from "../../src/engine/types.ts";
import { country } from "./country.ts";
import map from "./map.json";
import credits from "./media/credits.json";
import fr from "./locales/fr.json";
import mapGrandEstDepartements from "./maps/grand-est-departements.json";
import mapGrandEstTerritoires from "./maps/grand-est-territoires.json";
import mapBourgogneFrancheComteDepartements from "./maps/bourgogne-franche-comte-departements.json";
import mapBourgogneFrancheComteTerritoires from "./maps/bourgogne-franche-comte-territoires.json";
import mapOccitanieDepartements from "./maps/occitanie-departements.json";
import mapOccitanieTerritoires from "./maps/occitanie-territoires.json";
import mapAuvergneRhoneAlpesDepartements from "./maps/auvergne-rhone-alpes-departements.json";
import mapAuvergneRhoneAlpesTerritoires from "./maps/auvergne-rhone-alpes-territoires.json";
import mapProvenceAlpesCoteDAzurDepartements from "./maps/provence-alpes-cote-d-azur-departements.json";
import mapNouvelleAquitaineDepartements from "./maps/nouvelle-aquitaine-departements.json";
import mapNouvelleAquitaineTerritoires from "./maps/nouvelle-aquitaine-territoires.json";
import mapPaysDeLaLoireDepartements from "./maps/pays-de-la-loire-departements.json";
import mapCentreValDeLoireDepartements from "./maps/centre-val-de-loire-departements.json";
import alsace from "./territories/alsace.json";
import aquitaine from "./territories/aquitaine.json";
import limousin from "./territories/limousin.json";
import poitouCharentes from "./territories/poitou-charentes.json";
import paysDeLaLoire from "./territories/pays-de-la-loire.json";
import centreValDeLoire from "./territories/centre-val-de-loire.json";
import auvergne from "./territories/auvergne.json";
import bourgogne from "./territories/bourgogne.json";
import francheComte from "./territories/franche-comte.json";
import champagneArdenne from "./territories/champagne-ardenne.json";
import languedocRoussillon from "./territories/languedoc-roussillon.json";
import midiPyrenees from "./territories/midi-pyrenees.json";
import lorraine from "./territories/lorraine.json";
import provenceAlpesCoteDAzur from "./territories/provence-alpes-cote-d-azur.json";
import rhoneAlpes from "./territories/rhone-alpes.json";
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
  territories: [alsace, lorraine, champagneArdenne, languedocRoussillon, midiPyrenees, bourgogne, francheComte, auvergne, rhoneAlpes, provenceAlpesCoteDAzur, aquitaine, limousin, poitouCharentes, paysDeLaLoire, centreValDeLoire] as Territory[],
  gameMaps: [mapGrandEstDepartements, mapGrandEstTerritoires, mapOccitanieDepartements, mapOccitanieTerritoires, mapBourgogneFrancheComteDepartements, mapBourgogneFrancheComteTerritoires, mapAuvergneRhoneAlpesDepartements, mapAuvergneRhoneAlpesTerritoires, mapProvenceAlpesCoteDAzurDepartements, mapNouvelleAquitaineDepartements, mapNouvelleAquitaineTerritoires, mapPaysDeLaLoireDepartements, mapCentreValDeLoireDepartements] as GameMap[],
  credits: credits as MediaCredit[],
  messages: { fr },
};

export default content;
