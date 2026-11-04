import { CircleUserRound, Cookie, Download, FileText, Landmark, type LucideIcon, ScrollText, Trash2 } from "lucide-react";
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
  blocks: PrivacyBlock[];
  /** Affiche l'identité de l'éditeur et de l'hébergeur issue de la configuration du pays. */
  showsIdentity?: boolean;
}

/** Rubriques communes à tous les pays, dans l'ordre d'affichage. */
export const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    slug: "politique",
    icon: ScrollText,
    titleKey: "privacy.sections.policy.title",
    summaryKey: "privacy.sections.policy.summary",
    blocks: [
      { titleKey: "privacy.sections.policy.blocks.controller.title", bodyKey: "privacy.sections.policy.blocks.controller.body" },
      { titleKey: "privacy.sections.policy.blocks.collected.title", bodyKey: "privacy.sections.policy.blocks.collected.body" },
      { titleKey: "privacy.sections.policy.blocks.hosting.title", bodyKey: "privacy.sections.policy.blocks.hosting.body" },
      { titleKey: "privacy.sections.policy.blocks.minors.title", bodyKey: "privacy.sections.policy.blocks.minors.body" },
      { titleKey: "privacy.sections.policy.blocks.rights.title", bodyKey: "privacy.sections.policy.blocks.rights.body" },
      { titleKey: "privacy.sections.policy.blocks.changes.title", bodyKey: "privacy.sections.policy.blocks.changes.body" },
    ],
  },
  {
    slug: "conditions",
    icon: FileText,
    titleKey: "privacy.sections.terms.title",
    summaryKey: "privacy.sections.terms.summary",
    blocks: [
      { titleKey: "privacy.sections.terms.blocks.purpose.title", bodyKey: "privacy.sections.terms.blocks.purpose.body" },
      { titleKey: "privacy.sections.terms.blocks.access.title", bodyKey: "privacy.sections.terms.blocks.access.body" },
      { titleKey: "privacy.sections.terms.blocks.content.title", bodyKey: "privacy.sections.terms.blocks.content.body" },
      { titleKey: "privacy.sections.terms.blocks.availability.title", bodyKey: "privacy.sections.terms.blocks.availability.body" },
      { titleKey: "privacy.sections.terms.blocks.law.title", bodyKey: "privacy.sections.terms.blocks.law.body" },
    ],
  },
  {
    slug: "mentions-legales",
    icon: Landmark,
    titleKey: "privacy.sections.notice.title",
    summaryKey: "privacy.sections.notice.summary",
    blocks: [],
    showsIdentity: true,
  },
  {
    slug: "consentements",
    icon: Cookie,
    titleKey: "privacy.sections.consents.title",
    summaryKey: "privacy.sections.consents.summary",
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
    blocks: [
      { titleKey: "privacy.sections.data.blocks.state.title", bodyKey: "privacy.sections.data.blocks.state.body" },
      { titleKey: "privacy.sections.data.blocks.later.title", bodyKey: "privacy.sections.data.blocks.later.body" },
    ],
  },
  {
    slug: "supprimer-mes-donnees",
    icon: Trash2,
    titleKey: "privacy.sections.deleteData.title",
    summaryKey: "privacy.sections.deleteData.summary",
    blocks: [
      { titleKey: "privacy.sections.deleteData.blocks.state.title", bodyKey: "privacy.sections.deleteData.blocks.state.body" },
      { titleKey: "privacy.sections.deleteData.blocks.later.title", bodyKey: "privacy.sections.deleteData.blocks.later.body" },
    ],
  },
  {
    slug: "supprimer-mon-compte",
    icon: CircleUserRound,
    titleKey: "privacy.sections.deleteAccount.title",
    summaryKey: "privacy.sections.deleteAccount.summary",
    blocks: [
      { titleKey: "privacy.sections.deleteAccount.blocks.state.title", bodyKey: "privacy.sections.deleteAccount.blocks.state.body" },
      { titleKey: "privacy.sections.deleteAccount.blocks.later.title", bodyKey: "privacy.sections.deleteAccount.blocks.later.body" },
    ],
  },
];
