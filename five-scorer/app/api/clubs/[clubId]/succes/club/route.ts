import { NextResponse } from "next/server";
import { getClubApiContext } from "@/lib/guard";
import { succesDuClub } from "@/lib/succes-serveur";

export const dynamic = "force-dynamic";

/// Le club en succès : les niveaux de chacun, le fil des derniers
/// déblocages, et les places gagnées au tableau depuis la dernière soirée.
///
/// Les invités n'y figurent pas : un copain venu deux fois ne doit ni ouvrir
/// le fil du mardi matin, ni fermer la liste des niveaux.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  const { clubId } = await params;
  const ctx = await getClubApiContext(clubId);
  if (!ctx) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  const succes = await succesDuClub(clubId);
  return NextResponse.json(succes.club);
}
