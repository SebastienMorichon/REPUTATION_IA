import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mentions légales — AI Reputation Shield" };

// ── Champs à compléter avant mise en ligne ──────────────────────────────────
// Remplacez chaque [CHAMP] par vos informations réelles.
// Consultez un expert-comptable ou un avocat pour valider le statut juridique.
// ---------------------------------------------------------------------------

export default function MentionsLegalesPage() {
  return (
    <>
      <h1>Mentions légales</h1>
      <p className="subtitle">Conformément aux articles 6-III et 19 de la Loi n° 2004-575 du 21 juin 2004 pour la Confiance dans l'Économie Numérique (LCEN).</p>

      <div className="warn-box">
        <p>⚠️ Les champs surlignés en rouge <span className="fill">[ COMME CECI ]</span> doivent être complétés avant la mise en ligne. Toute omission constitue une infraction passible d'une amende.</p>
      </div>

      {/* ── 1. Éditeur ── */}
      <h2>1. Éditeur du site</h2>
      <p>
        Le site <strong>AI Reputation Shield</strong> (accessible à l'adresse <span className="fill">[https://votre-domaine.fr]</span>) est édité par :
      </p>
      <div className="highlight-box">
        <p>
          <strong>Raison sociale :</strong> <span className="fill">[NOM DE VOTRE SOCIÉTÉ]</span><br />
          <strong>Forme juridique :</strong> <span className="fill">[SAS / SARL / SASU / Auto-entrepreneur / EI…]</span><br />
          <strong>Capital social :</strong> <span className="fill">[MONTANT] €</span><br />
          <strong>Siège social :</strong> <span className="fill">[ADRESSE COMPLÈTE, CODE POSTAL, VILLE]</span><br />
          <strong>SIRET :</strong> <span className="fill">[14 CHIFFRES]</span><br />
          <strong>RCS :</strong> <span className="fill">[VILLE D'IMMATRICULATION]</span><br />
          <strong>N° TVA intracommunautaire :</strong> <span className="fill">[FR + 11 CHIFFRES — si assujetti]</span><br />
          <strong>Téléphone :</strong> <span className="fill">[+33 X XX XX XX XX]</span><br />
          <strong>Email de contact :</strong> <span className="fill">[contact@votre-domaine.fr]</span>
        </p>
      </div>

      <h3>Directeur de la publication</h3>
      <p>
        <span className="fill">[PRÉNOM NOM]</span>, en qualité de <span className="fill">[Président / Gérant / Auto-entrepreneur]</span>.
      </p>

      {/* ── 2. Hébergement ── */}
      <h2>2. Hébergement</h2>
      <p>Le site et ses services sont hébergés par :</p>
      <div className="highlight-box">
        <p>
          <strong>Frontend (interface web) :</strong> <span className="fill">[Vercel Inc. — 440 N Barranca Ave #4133, Covina, CA 91723, USA]</span><br />
          <strong>Backend (API & base de données) :</strong> <span className="fill">[NOM DE L'HÉBERGEUR — ex. OVHcloud, Scaleway, Hetzner… + adresse]</span><br />
          <strong>Localisation des données :</strong> <span className="fill">[Union Européenne / France — préciser]</span>
        </p>
      </div>

      {/* ── 3. Propriété intellectuelle ── */}
      <h2>3. Propriété intellectuelle</h2>
      <p>
        L'ensemble des contenus présents sur ce site (textes, graphiques, logo, icônes, images, code source, architecture) est la propriété exclusive de <span className="fill">[NOM DE LA SOCIÉTÉ]</span> ou de ses concédants de licence, et est protégé par les lois françaises et internationales relatives au droit d'auteur et à la propriété intellectuelle.
      </p>
      <p>
        Toute reproduction, représentation, modification, publication, adaptation ou exploitation, totale ou partielle, de ces contenus, par quelque procédé que ce soit, sans l'autorisation préalable et écrite de <span className="fill">[NOM DE LA SOCIÉTÉ]</span>, est strictement interdite et constitue une contrefaçon sanctionnée par les articles L335-2 et suivants du Code de la propriété intellectuelle.
      </p>

      {/* ── 4. Responsabilité ── */}
      <h2>4. Limitation de responsabilité</h2>
      <p>
        AI Reputation Shield est un outil d'analyse basé sur l'intelligence artificielle. Les résultats fournis (scores de visibilité, sentiments, citations) sont générés automatiquement à partir de modèles de langage tiers et ont une valeur indicative. <span className="fill">[NOM DE LA SOCIÉTÉ]</span> ne garantit pas l'exactitude, l'exhaustivité ou l'actualité des informations produites.
      </p>
      <p>
        En aucun cas <span className="fill">[NOM DE LA SOCIÉTÉ]</span> ne pourra être tenue responsable de décisions prises sur la base des analyses fournies par le service.
      </p>

      {/* ── 5. Données personnelles ── */}
      <h2>5. Données personnelles</h2>
      <p>
        Le traitement des données à caractère personnel collectées via ce site est régi par notre <a href="/legal/confidentialite">Politique de confidentialité</a>, conforme au Règlement Général sur la Protection des Données (RGPD — Règlement UE 2016/679) et à la loi Informatique et Libertés modifiée.
      </p>
      <p>
        Pour exercer vos droits ou contacter notre responsable du traitement : <span className="fill">[privacy@votre-domaine.fr]</span>
      </p>

      {/* ── 6. Cookies ── */}
      <h2>6. Cookies</h2>
      <p>
        Des cookies et technologies similaires peuvent être utilisés sur ce site. Pour en savoir plus, consultez notre <a href="/legal/cookies">Politique de cookies</a>.
      </p>

      {/* ── 7. Droit applicable ── */}
      <h2>7. Droit applicable et litiges</h2>
      <p>
        Les présentes mentions légales sont soumises au droit français. En cas de litige, les tribunaux français seront seuls compétents, sous réserve d'une disposition légale impérative contraire.
      </p>

      {/* ── 8. Contact ── */}
      <h2>8. Contact</h2>
      <p>
        Pour toute question relative aux présentes mentions légales, vous pouvez nous contacter à l'adresse : <span className="fill">[contact@votre-domaine.fr]</span>
      </p>

      <p className="subtitle" style={{ marginTop: "3rem" }}>
        Dernière mise à jour : <span className="fill">[JJ/MM/AAAA]</span>
      </p>
    </>
  );
}
