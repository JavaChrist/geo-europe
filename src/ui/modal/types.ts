import type { TranslationKey, TranslationValues } from "@/i18n/translator";

export type ModalVariant = "info" | "success" | "error" | "confirm" | "destructive" | "purchase" | "reward";

export interface ModalContent {
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
  values?: TranslationValues;
  confirmKey?: TranslationKey;
  cancelKey?: TranslationKey;
}

export interface ModalRequest {
  id: number;
  variant: ModalVariant;
  content: ModalContent;
  /** Affiche un bouton d'annulation. */
  needsChoice: boolean;
  resolve: (confirmed: boolean) => void;
}

export interface ModalApi {
  info: (content: ModalContent) => Promise<void>;
  success: (content: ModalContent) => Promise<void>;
  reward: (content: ModalContent) => Promise<void>;
  /** Accepte n'importe quelle erreur : seul un message compréhensible est affiché. */
  error: (error: unknown) => Promise<void>;
  /** Les trois suivantes renvoient true seulement si le joueur valide. */
  confirm: (content: ModalContent) => Promise<boolean>;
  destructive: (content: ModalContent) => Promise<boolean>;
  purchase: (content: ModalContent) => Promise<boolean>;
}
