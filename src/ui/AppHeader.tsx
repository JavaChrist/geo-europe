import Image from "next/image";
import Link from "next/link";
import content from "@country";

/** En-tête commun à tous les jeux : seule la configuration du pays change. */
export function AppHeader() {
  const { appName, icons } = content.country;
  return (
    <header className="mx-auto flex w-full max-w-5xl items-center px-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <Link href="/" className="flex min-h-12 items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-gold">
        <Image src={icons.icon192} alt="" width={44} height={44} className="rounded-xl" priority />
        <span className="font-display text-2xl font-semibold">{appName}</span>
      </Link>
    </header>
  );
}
