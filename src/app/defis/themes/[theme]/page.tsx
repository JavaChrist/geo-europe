import { notFound } from "next/navigation";
import content from "@country";
import { ThemeChallenge } from "@/features/national/ThemeChallenge";

// Export statique : un défi par thème du pays.
export const dynamicParams = false;

export function generateStaticParams() {
  return content.family.themes.map((theme) => ({ theme: theme.id }));
}

export default async function ThemeChallengePage({ params }: { params: Promise<{ theme: string }> }) {
  const { theme } = await params;
  if (!content.family.themes.some((candidate) => candidate.id === theme)) notFound();
  return <ThemeChallenge themeId={theme} />;
}
