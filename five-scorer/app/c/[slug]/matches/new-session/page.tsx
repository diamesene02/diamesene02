import { redirect } from "next/navigation";
import { requireClub } from "@/lib/guard";
import NewSessionForm from "./NewSessionForm";

export const dynamic = "force-dynamic";

export default async function NewSessionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireClub(slug);
  if (!ctx.canScore) redirect(`/c/${slug}`);

  return (
    <main className="mx-auto max-w-xl">
      <span className="kicker">Organisation</span>
      <h1 className="display-md mt-1">Programmer une session</h1>
      <p className="mt-3 text-sm text-[color:var(--ink-1)]">
        La soirée five : une date, un lieu, et chacun répond présent.
      </p>

      <div className="mt-6">
        <NewSessionForm slug={slug} />
      </div>
    </main>
  );
}
