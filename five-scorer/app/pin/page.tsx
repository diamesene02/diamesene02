import { Suspense } from "react";
import PinGate from "@/components/PinGate";

export const metadata = { title: "Code d'accès · Five Scorer" };

export default function PinPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Suspense>
        <PinGate />
      </Suspense>
    </main>
  );
}
