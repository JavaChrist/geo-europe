import {
  CircleUserRound,
  Cookie,
  Download,
  FileText,
  Landmark,
  type LucideIcon,
  Receipt,
  ScrollText,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import type { LegalDocumentName } from "@/features/privacy/legal-documents";
import type { TranslationKey } from "@/i18n/translator";

export interface PrivacyBlock {
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
}

export interface PrivacySection {
  /** Dernier segment de l'adresse : /profil/confidentialite/<slug>. */
  slug: string;
  icon: LucideIcon;
  titleKey: TranslationKey;
  summaryKey: TranslationKey;
  /** Document juridique généré par JavaChrist-Legal-Kit, affiché tel quel. */
  document?: LegalDocumentName;
  /** Explications propres au fonctionnement local du jeu, hors documents du kit. */
  blocks?: PrivacyBlock[];
  /** Affiche les résultats enregistrés sur l'appareil, ou le bouton pour les effacer. */
  localResults?: "view" | "delete";
  /** Lien vers la fonction de rétractation en ligne, sous les conditions de vente. */
  withdrawalLink?: boolean;
  /** Bannière AdMob de l'application Android et bouton « Choix publicitaires ». Rien sur le web. */
  adChoices?: boolean;
}

/** Rubriques communes à tous les pays, dans l'ordre d'affichage. */
export const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    slug: "politique",
    icon: ScrollText,
    titleKey: "privacy.sections.policy.title",
    summaryKey: "privacy.sections.policy.summary",
    document: "confidentialite",
  },
  {
    slug: "conditions",
    icon: FileText,
    titleKey: "privacy.sections.terms.title",
    summaryKey: "privacy.sections.terms.summary",
    document: "conditions-utilisation",
  },
  {
    slug: "conditions-de-vente",
    icon: Receipt,
    titleKey: "privacy.sections.sales.title",
    summaryKey: "privacy.sections.sales.summary",
    document: "conditions-vente",
    withdrawalLink: true,
  },
  {
    slug: "mentions-legales",
    icon: Landmark,
    titleKey: "privacy.sections.notice.title",
    summaryKey: "privacy.sections.notice.summary",
    document: "mentions-legales",
  },
  {
    slug: "droits",
    icon: ShieldCheck,
    titleKey: "privacy.sections.rights.title",
    summaryKey: "privacy.sections.rights.summary",
    document: "droits-rgpd",
  },
  {
    slug: "consentements",
    icon: Cookie,
    titleKey: "privacy.sections.consents.title",
    summaryKey: "privacy.sections.consents.summary",
    adChoices: true,
    blocks: [
      { titleKey: "privacy.sections.consents.blocks.state.title", bodyKey: "privacy.sections.consents.blocks.state.body" },
      { titleKey: "privacy.sections.consents.blocks.later.title", bodyKey: "privacy.sections.consents.blocks.later.body" },
    ],
  },
  {
    slug: "mes-donnees",
    icon: Download,
    titleKey: "privacy.sections.data.title",
    summaryKey: "privacy.sections.data.summary",
    localResults: "view",
    blocks: [
      { titleKey: "privacy.sections.data.blocks.local.title", bodyKey: "privacy.sections.data.blocks.local.body" },
      { titleKey: "privacy.sections.data.blocks.account.title", bodyKey: "privacy.sections.data.blocks.account.body" },
      { titleKey: "privacy.sections.data.blocks.action.title", bodyKey: "privacy.sections.data.blocks.action.body" },
    ],
  },
  {
    slug: "supprimer-mes-donnees",
    icon: Trash2,
    titleKey: "privacy.sections.deleteData.title",
    summaryKey: "privacy.sections.deleteData.summary",
    localResults: "delete",
    blocks: [
      { titleKey: "privacy.sections.deleteData.blocks.local.title", bodyKey: "privacy.sections.deleteData.blocks.local.body" },
      { titleKey: "privacy.sections.deleteData.blocks.account.title", bodyKey: "privacy.sections.deleteData.blocks.account.body" },
      { titleKey: "privacy.sections.deleteData.blocks.action.title", bodyKey: "privacy.sections.deleteData.blocks.action.body" },
    ],
  },
  {
    slug: "supprimer-mon-compte",
    icon: CircleUserRound,
    titleKey: "privacy.sections.deleteAccount.title",
    summaryKey: "privacy.sections.deleteAccount.summary",
    blocks: [
      { titleKey: "privacy.sections.deleteAccount.blocks.state.title", bodyKey: "privacy.sections.deleteAccount.blocks.state.body" },
      { titleKey: "privacy.sections.deleteAccount.blocks.local.title", bodyKey: "privacy.sections.deleteAccount.blocks.local.body" },
      { titleKey: "privacy.sections.deleteAccount.blocks.later.title", bodyKey: "privacy.sections.deleteAccount.blocks.later.body" },
    ],
  },
];
