import { notFound } from "next/navigation";
import content from "@country";
import { getTranslator } from "@/i18n/translator";
import { ComingSoon } from "@/ui/ComingSoon";

// Export statique : seules les régions du pays existent comme pages.
export const dynamicParams = false;

export function generateStaticParams() {
  return content.regions.map((region) => ({ slug: region.slug }));
}

export default async function RegionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const region = content.regions.find((candidate) => candidate.slug === slug);
  const shape = content.map.regions.find((candidate) => candidate.regionId === region?.id);
  if (!region || !shape) notFound();

  const { t, tContent } = getTranslator();
  const [x, y, width, height] = shape.bbox;
  const margin = Math.max(width, height) * 0.06;

  return (
    <ComingSoon
      title={tContent(region.nameKey)}
      body={t("soon.region.body")}
      badge={t(region.status === "published" ? "explorer.statusPublished" : "explorer.statusDraft")}
      backHref="/explorer"
      backLabel={t("explorer.backToMap")}
      visual={
        <svg
          aria-hidden
          viewBox={`${x - margin} ${y - margin} ${width + margin * 2} ${height + margin * 2}`}
          className="country-map size-36"
        >
          <path className="map-shape map-shape-solo" d={shape.path} fillRule="evenodd" vectorEffect="non-scaling-stroke" />
        </svg>
      }
    />
  );
}
