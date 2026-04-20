import type { Metadata } from "next";

export const metadata: Metadata = { title: "Politique de cookies — AI Reputation Shield" };

export default function CookiesPage() {
  return (
    <>
      <h1>Politique de cookies</h1>
      <p className="subtitle">
        Conformément aux recommandations de la CNIL et au RGPD — version du{" "}
        <span className="fill">[JJ/MM/AAAA]</span>
      </p>

      {/* ── 1. Qu'est-ce qu'un cookie ── */}
      <h2>1. Qu'est-ce qu'un cookie ?</h2>
      <p>
        Un cookie est un petit fichier texte déposé sur votre terminal (ordinateur, smartphone, tablette) lors de la visite d'un site web. Il permet au site de mémoriser des informations sur votre visite (langue préférée, identifiants de session, préférences d'affichage, etc.).
      </p>
      <p>
        Les cookies sont régis en France par l'article 82 de la loi Informatique et Libertés et par les lignes directrices de la CNIL du 17 septembre 2020.
      </p>

      {/* ── 2. Cookies utilisés ── */}
      <h2>2. Cookies et technologies similaires utilisés</h2>

      <h3>2.1 Cookies strictement nécessaires (exemptés de consentement)</h3>
      <p>Ces cookies sont indispensables au fonctionnement du Service. Ils ne peuvent pas être désactivés.</p>
      <table>
        <thead>
          <tr><th>Nom / clé</th><th>Type</th><th>Finalité</th><th>Durée</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><code>reputation.token</code></td>
            <td>localStorage</td>
            <td>Stockage du token JWT d'authentification — maintien de la session utilisateur</td>
            <td>Jusqu'à déconnexion ou expiration</td>
          </tr>
          <tr>
            <td><code>reputation.user</code></td>
            <td>localStorage</td>
            <td>Cache minimal des informations de l'utilisateur connecté (email, nom)</td>
            <td>Jusqu'à déconnexion</td>
          </tr>
          <tr>
            <td><code>theme</code></td>
            <td>localStorage</td>
            <td>Préférence de thème de l'interface (clair / sombre)</td>
            <td>Indéfinie (préférence locale)</td>
          </tr>
        </tbody>
      </table>
      <p>
        <strong>Note technique :</strong> Les éléments ci-dessus sont stockés dans le <strong>localStorage</strong> du navigateur, et non dans des cookies HTTP au sens strict. Ils ne sont pas transmis automatiquement au serveur à chaque requête et restent sur votre terminal. Ils sont couverts par la réglementation sur les traceurs (Art. 82 loi I&L) dès lors qu'ils accèdent à des informations stockées sur votre terminal.
      </p>

      <h3>2.2 Cookies Stripe (paiement)</h3>
      <p>
        Lors du processus de paiement, <strong>Stripe</strong> peut déposer des cookies sur votre terminal pour assurer la sécurité des transactions et la prévention de la fraude. Ces cookies sont soumis à la <a href="https://stripe.com/fr/privacy" target="_blank" rel="noopener noreferrer">politique de confidentialité de Stripe</a>.
      </p>

      <h3>2.3 Cookies analytiques <span className="fill">[À activer ou supprimer selon votre choix]</span></h3>
      <div className="warn-box">
        <p>⚠️ Si vous n'utilisez pas d'outil analytique (Google Analytics, Plausible, Posthog…), supprimez cette section. Si vous en utilisez un, complétez le tableau ci-dessous et mettez en place un bandeau de consentement CNIL conforme.</p>
      </div>
      <table>
        <thead>
          <tr><th>Nom</th><th>Outil</th><th>Finalité</th><th>Durée</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><span className="fill">[_ga, _ga_XXX]</span></td>
            <td><span className="fill">[Google Analytics 4]</span></td>
            <td>Mesure d'audience, statistiques de navigation anonymisées</td>
            <td><span className="fill">[13 mois]</span></td>
          </tr>
        </tbody>
      </table>

      {/* ── 3. Consentement ── */}
      <h2>3. Gestion de votre consentement</h2>
      <p>
        Conformément aux recommandations de la CNIL, les cookies strictement nécessaires (section 2.1) ne requièrent pas votre consentement préalable. En revanche, les cookies analytiques et publicitaires ne sont déposés qu'après votre consentement explicite.
      </p>
      <p>
        Vous pouvez retirer votre consentement à tout moment :
      </p>
      <ul>
        <li><strong>Via les paramètres de votre navigateur</strong> — vous pouvez bloquer ou supprimer tous les cookies (attention, cela peut affecter le fonctionnement du Service) ;</li>
        <li><strong>Depuis le panneau de gestion des cookies</strong> <span className="fill">[lien vers votre CMP si vous en avez une — ex. Axeptio, Didomi, Cookiebot]</span> ;</li>
        <li><strong>En vidant le localStorage</strong> — via les outils de développement de votre navigateur (F12 → Application → LocalStorage).</li>
      </ul>

      <h3>Comment supprimer les données du localStorage ?</h3>
      <ul>
        <li><strong>Chrome / Edge :</strong> F12 → Application → Local Storage → clic droit → Clear</li>
        <li><strong>Firefox :</strong> F12 → Stockage → Stockage local → Supprimer tout</li>
        <li><strong>Safari :</strong> Développement → Afficher l'inspecteur web → Stockage → Stockage local</li>
      </ul>

      {/* ── 4. Opt-out tiers ── */}
      <h2>4. Opt-out des services tiers</h2>
      <table>
        <thead>
          <tr><th>Service</th><th>Lien de désinscription</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Stripe</td>
            <td><a href="https://stripe.com/fr/privacy" target="_blank" rel="noopener noreferrer">stripe.com/fr/privacy</a></td>
          </tr>
          <tr>
            <td><span className="fill">[Google Analytics]</span></td>
            <td><a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer">tools.google.com/dlpage/gaoptout</a></td>
          </tr>
        </tbody>
      </table>

      {/* ── 5. Mises à jour ── */}
      <h2>5. Mises à jour de la présente politique</h2>
      <p>
        Cette politique peut être mise à jour pour refléter l'ajout de nouveaux cookies ou les évolutions réglementaires. La date de dernière mise à jour figure en haut de cette page. Nous vous invitons à la consulter régulièrement.
      </p>

      {/* ── 6. Contact ── */}
      <h2>6. Contact</h2>
      <p>
        Pour toute question relative à l'utilisation des cookies :{" "}
        <span className="fill">[privacy@votre-domaine.fr]</span>
      </p>

      <p className="subtitle" style={{ marginTop: "3rem" }}>
        Dernière mise à jour : <span className="fill">[JJ/MM/AAAA]</span>
      </p>
    </>
  );
}
