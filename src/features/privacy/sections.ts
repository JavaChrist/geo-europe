import {
  CircleUserRound,
  Cookie,
  Download,
  FileText,
  Landmark,
  type LucideIcon,
  Receipt,
  ScrollText,
  Trash2,
} from "lucide-react";
import type { TranslationKey } from "@/i18n/translator";

export interface PrivacyBlock {
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
  /** Signale le bloc tant que cette information n'est pas confirmée dans la configuration du pays. */
  pendsOn?: "vat" | "mediator";
}

export interface PrivacySection {
  /** Dernier segment de l'adresse : /profil/confidentialite/<slug>. */
  slug: string;
  icon: LucideIcon;
  titleKey: TranslationKey;
  summaryKey: TranslationKey;
  blocks: PrivacyBlock[];
  /** Affiche l'identité de l'éditeur, de l'hébergeur et du médiateur issue de la configuration du pays. */
  showsIdentity?: boolean;
}

const MEDIATION_BLOCK: PrivacyBlock = {
  titleKey: "privacy.mediation.title",
  bodyKey: "privacy.mediation.body",
  pendsOn: "mediator",
};

/** Rubriques communes à tous les pays, dans l'ordre d'affichage. */
export const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    slug: "politique",
    icon: ScrollText,
    titleKey: "privacy.sections.policy.title",
    summaryKey: "privacy.sections.policy.summary",
    blocks: [
      { titleKey: "privacy.sections.policy.blocks.controller.title", bodyKey: "privacy.sections.policy.blocks.controller.body" },
      { titleKey: "privacy.sections.policy.blocks.local.title", bodyKey: "privacy.sections.policy.blocks.local.body" },
      { titleKey: "privacy.sections.policy.blocks.hosting.title", bodyKey: "privacy.sections.policy.blocks.hosting.body" },
      { titleKey: "privacy.sections.policy.blocks.firebase.title", bodyKey: "privacy.sections.policy.blocks.firebase.body" },
      { titleKey: "privacy.sections.policy.blocks.purchases.title", bodyKey: "privacy.sections.policy.blocks.purchases.body" },
      { titleKey: "privacy.sections.policy.blocks.promotions.title", bodyKey: "privacy.sections.policy.blocks.promotions.body" },
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
      { titleKey: "privacy.sections.terms.blocks.forbidden.title", bodyKey: "privacy.sections.terms.blocks.forbidden.body" },
      { titleKey: "privacy.sections.terms.blocks.availability.title", bodyKey: "privacy.sections.terms.blocks.availability.body" },
      { titleKey: "privacy.sections.terms.blocks.liability.title", bodyKey: "privacy.sections.terms.blocks.liability.body" },
      { titleKey: "privacy.sections.terms.blocks.law.title", bodyKey: "privacy.sections.terms.blocks.law.body" },
    ],
  },
  {
    slug: "conditions-de-vente",
    icon: Receipt,
    titleKey: "privacy.sections.sales.title",
    summaryKey: "privacy.sections.sales.summary",
    blocks: [
      { titleKey: "privacy.sections.sales.blocks.state.title", bodyKey: "privacy.sections.sales.blocks.state.body" },
      { titleKey: "privacy.sections.sales.blocks.seller.title", bodyKey: "privacy.sections.sales.blocks.seller.body", pendsOn: "vat" },
      { titleKey: "privacy.sections.sales.blocks.product.title", bodyKey: "privacy.sections.sales.blocks.product.body" },
      { titleKey: "privacy.sections.sales.blocks.web.title", bodyKey: "privacy.sections.sales.blocks.web.body" },
      { titleKey: "privacy.sections.sales.blocks.android.title", bodyKey: "privacy.sections.sales.blocks.android.body" },
      { titleKey: "privacy.sections.sales.blocks.withdrawal.title", bodyKey: "privacy.sections.sales.blocks.withdrawal.body" },
      { titleKey: "privacy.sections.sales.blocks.warranty.title", bodyKey: "privacy.sections.sales.blocks.warranty.body" },
      { titleKey: "privacy.sections.sales.blocks.claims.title", bodyKey: "privacy.sections.sales.blocks.claims.body" },
      MEDIATION_BLOCK,
      { titleKey: "privacy.sections.sales.blocks.law.title", bodyKey: "privacy.sections.sales.blocks.law.body" },
    ],
  },
  {
    slug: "mentions-legales",
    icon: Landmark,
    titleKey: "privacy.sections.notice.title",
    summaryKey: "privacy.sections.notice.summary",
    blocks: [MEDIATION_BLOCK],
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
