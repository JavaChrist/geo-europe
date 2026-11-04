import { notFound } from "next/navigation";
import { SPECIAL_CHALLENGES } from "@/engine/special-challenges";
import { RegionalChallenges } from "@/features/journey/RegionalChallenges";

// Export statique : seuls les défis communs existent comme listes.
export const dynamicParams = false;

export function generateStaticParams() {
  return SPECIAL_CHALLENGES.map((rules) => ({ defi: rules.slug }));
}

export default async function RegionalChallengesPage({ params }: { params: Promise<{ defi: string }> }) {
  const { defi } = await params;
  const rules = SPECIAL_CHALLENGES.find((candidate) => candidate.slug === defi);
  if (!rules) notFound();
  return <RegionalChallenges kind={rules.kind} />;
}
