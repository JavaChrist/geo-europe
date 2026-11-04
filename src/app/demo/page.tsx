import { notFound } from "next/navigation";
import { ModalDemo } from "@/features/demo/ModalDemo";

// Outil de développement : accessible avec `npm run dev`, page introuvable dans tous les builds.
export default function DemoPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ModalDemo />;
}
