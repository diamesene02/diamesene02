import Carte from "@/components/ios/Carte";
import Ecusson from "@/components/ios/Ecusson";
import { lettre } from "@/lib/ini";
import type { Derby } from "@/lib/stats";

// Le derby de la saison.
//
// Le club ne joue pas contre des adversaires qui changent : il joue contre
// lui-même, avec les deux mêmes chasubles, quarante lundis par an. C'est la
// seule confrontation qui dure toute l'année, et rien ne la comptait.
export default function DerbyCarte({ derby }: { derby: Derby | null }) {
  if (!derby || derby.matchs === 0) return null;
  const d = derby;
  const total = d.victoiresA + d.victoiresB + d.nuls;
  const mene =
    d.victoiresA > d.victoiresB ? "A" : d.victoiresB > d.victoiresA ? "B" : null;

  const serieTexte =
    d.serie === 0
      ? null
      : `${Math.abs(d.serie)} victoire${Math.abs(d.serie) > 1 ? "s" : ""} d'affilée pour ${d.serie > 0 ? d.nomA : d.nomB}`;

  return (
    <Carte className="stats-derby" titre={`${d.nomA} contre ${d.nomB}`}>
      <div className="derby-camps">
        <div className="camp">
          <Ecusson camp="A" lettre={lettre(d.nomA)} taille={44} />
          <span className="nom">{d.nomA}</span>
          <span className={`compte${mene === "A" ? " mene" : ""}`}>{d.victoiresA}</span>
          <span className="unite">victoire{d.victoiresA > 1 ? "s" : ""}</span>
        </div>
        <div className="milieu">
          <span className="nuls">
            {d.nuls} nul{d.nuls > 1 ? "s" : ""}
          </span>
          <span className="matchs">
            sur {total} match{total > 1 ? "s" : ""}
          </span>
        </div>
        <div className="camp">
          <Ecusson camp="B" lettre={lettre(d.nomB)} taille={44} />
          <span className="nom">{d.nomB}</span>
          <span className={`compte${mene === "B" ? " mene" : ""}`}>{d.victoiresB}</span>
          <span className="unite">victoire{d.victoiresB > 1 ? "s" : ""}</span>
        </div>
      </div>

      <div className="derby-jauge" role="img" aria-label={`${d.nomA} ${d.victoiresA}, ${d.nomB} ${d.victoiresB}, ${d.nuls} nuls`}>
        <span className="a" style={{ flexGrow: d.victoiresA }} />
        <span className="nul" style={{ flexGrow: d.nuls }} />
        <span className="b" style={{ flexGrow: d.victoiresB }} />
      </div>

      <div className="derby-lignes">
        <div className="ligne">
          <span className="g">{d.butsA}</span>
          <span className="l">Buts marqués</span>
          <span className="d">{d.butsB}</span>
        </div>
        {(d.soireesA > 0 || d.soireesB > 0 || d.soireesPartagees > 0) && (
          <div className="ligne">
            <span className="g">{d.soireesA}</span>
            <span className="l">
              Soirées gagnées
              {d.soireesPartagees > 0 && (
                <span className="note"> · {d.soireesPartagees} partagée{d.soireesPartagees > 1 ? "s" : ""}</span>
              )}
            </span>
            <span className="d">{d.soireesB}</span>
          </div>
        )}
      </div>

      {serieTexte && <p className="derby-serie">{serieTexte}</p>}
    </Carte>
  );
}
