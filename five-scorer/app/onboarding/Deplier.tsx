"use client";

import { useState } from "react";

export default function Deplier({
  libelle,
  aide,
  children,
}: {
  libelle: string;
  aide?: string;
  children: React.ReactNode;
}) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <>
      <button type="button" className="bv-club" style={{ border: 0, background: "none", font: "inherit", cursor: "pointer", textAlign: "left" }} onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert}>
        <span className="nom">
          {libelle}
          {aide && <span style={{ display: "block", fontSize: 13, fontWeight: 400, color: "var(--i2)" }}>{aide}</span>}
        </span>
        <span className="chevron">{ouvert ? "⌃" : "›"}</span>
      </button>
      {ouvert && <div style={{ padding: "0 4px 12px" }}>{children}</div>}
    </>
  );
}
