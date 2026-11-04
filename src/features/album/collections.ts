import content from "@country";
import { albumCollections } from "@/engine/album";
import type { Level, SouvenirCard, Territory } from "@/engine/types";

export const collections: Territory[] = albumCollections(content.territories);

export const allCards: SouvenirCard[] = collections.flatMap((territory) => territory.souvenirCards);

export const territoryOfCard = (card: SouvenirCard): Territory | undefined =>
  collections.find((territory) => territory.id === card.territoryId);

export const levelOfCard = (card: SouvenirCard): Level | undefined =>
  territoryOfCard(card)?.levels.find((level) => level.id === card.unlock.levelId);

export const cardsOfLevel = (levelId: string): SouvenirCard[] => allCards.filter((card) => card.unlock.levelId === levelId);

export const cardPath = (card: SouvenirCard) => `/album/${card.id}`;
