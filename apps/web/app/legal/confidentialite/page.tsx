import type { Metadata } from "next";

export const metadata: Metadata = { title: "Politique de confidentialité — AI Reputation Shield" };

export default function ConfidentialitePage() {
  return (
    <>
      <h1>Politique de confidentialité</h1>
      <p className="subtitle">
        Conformément au RGPD (Règlement UE 2016/679) et à la loi Informatique et Libertés — version du{" "}
        <span className="fill">[JJ/MM/AAAA]</span>
      </p>

      <div className="highlight-box">
        <p>
          <strong>Responsable du traitement :</strong> <span className="fill">[NOM DE LA SOCIÉTÉ]</span> —{" "}
          <span className="fill">[ADRESSE]</span> — <span className="fill">[privacy@votre-domaine.fr]</span>
        </p>
      </div>

      {/* ── 1. Données collectées ── */}
      <h2>1. Données collectées et finalités</h2>
      <p>Nous collectons les données suivantes dans le cadre de la fourniture du Service :</p>

      <table>
        <thead>
          <tr>
            <th>Catégorie</th>
            <th>Données</th>
            <th>Finalité</th>
            <th>Base légale (RGPD)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Compte</strong></td>
            <td>Email, nom complet, nom d'organisation</td>
            <td>Création et gestion du compte, authentification</td>
            <td>Exécution du contrat (Art. 6.1.b)</td>
          </tr>
          <tr>
            <td><strong>Abonnement</strong></td>
            <td>Plan souscrit, historique de facturation, identifiant Stripe</td>
            <td>Gestion de l'abonnement et de la facturation</td>
            <td>Exécution du contrat (Art. 6.1.b)</td>
          </tr>
          <tr>
            <td><strong>Données de monitoring</strong></td>
            <td>Noms de marques, prompts de surveillance, résultats d'analyse (JSON)</td>
            <td>Fournir le Service d'analyse IA</td>
            <td>Exécution du contrat (Art. 6.1.b)</td>
          </tr>
          <tr>
            <td><strong>Données techniques</strong></td>
            <td>Adresse IP, user-agent, logs d'accès</td>
            <td>Sécurité, débogage, lutte contre la fraude</td>
            <td>Intérêt légitime (Art. 6.1.f)</td>
          </tr>
          <tr>
            <td><strong>Communications</strong></td>
            <td>Emails transactionnels (alertes, rapports, facturation)</td>
            <td>Notifications liées au Service</td>
            <td>Exécution du contrat (Art. 6.1.b)</td>
          </tr>
          <tr>
            <td><strong>Données d'analyse</strong></td>
            <td>Pages visitées, fonctionnalités utilisées <span className="fill">[si analytics activé]</span></td>
            <td>Amélioration du produit</td>
            <td>Consentement (Art. 6.1.a)</td>
          </tr>
        </tbody>
      </table>

      <p>Nous ne collectons <strong>aucune donnée sensible</strong> au sens de l'article 9 du RGPD (santé, religion, origine ethnique, opinions politiques…).</p>

      {/* ── 2. Durée de conservation ── */}
      <h2>2. Durée de conservation</h2>
      <table>
        <thead>
          <tr><th>Donnée</th><th>Durée de conservation</th></tr>
        </thead>
        <tbody>
          <tr><td>Données de compte actif</td><td>Durée du contrat + 3 ans (prescription commerciale)</td></tr>
          <tr><td>Données de facturation</td><td>10 ans (obligation légale comptable — Art. L123-22 C. Commerce)</td></tr>
          <tr><td>Données d'analyse et runs</td><td>Durée du contrat + 1 an</td></tr>
          <tr><td>Logs techniques</td><td>12 mois</td></tr>
          <tr><td>Compte supprimé</td><td>Suppression sous 30 jours (sauvegarde incluse)</td></tr>
        </tbody>
      </table>

      {/* ── 3. Destinataires ── */}
      <h2>3. Destinataires des données et sous-traitants</h2>
      <p>
        Vos données sont traitées par nos sous-traitants dans le cadre strict de la fourniture du Service. Nous avons conclu un accord de traitement des données (DPA) avec chacun d'eux.
      </p>

      <table>
        <thead>
          <tr><th>Sous-traitant</th><th>Rôle</th><th>Pays</th><th>Garantie RGPD</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Anthropic PBC</strong></td>
            <td>LLM (Claude API) — analyse des prompts</td>
            <td>🇺🇸 USA</td>
            <td>Clauses contractuelles types (SCCs)</td>
          </tr>
          <tr>
            <td><strong>OpenAI, LLC</strong></td>
            <td>LLM (GPT API) — analyse des prompts</td>
            <td>🇺🇸 USA</td>
            <td>DPA OpenAI + SCCs</td>
          </tr>
          <tr>
            <td><strong>Perplexity AI, Inc.</strong></td>
            <td>LLM (Sonar API) — analyse des prompts</td>
            <td>🇺🇸 USA</td>
            <td>SCCs</td>
          </tr>
          <tr>
            <td><strong>Stripe Payments Europe, Ltd.</strong></td>
            <td>Paiement en ligne</td>
            <td>🇮🇪 Irlande (UE)</td>
            <td>Réglementation UE applicable</td>
          </tr>
          <tr>
            <td><span className="fill">[HÉBERGEUR — ex. OVHcloud]</span></td>
            <td>Hébergement serveur & base de données</td>
            <td><span className="fill">[France / UE]</span></td>
            <td><span className="fill">[Certification ISO 27001 / SCCs]</span></td>
          </tr>
          <tr>
            <td><span className="fill">[OUTIL EMAILS — ex. Resend, Sendgrid]</span></td>
            <td>Envoi d'emails transactionnels</td>
            <td><span className="fill">[USA / UE]</span></td>
            <td><span className="fill">[SCCs / DPA]</span></td>
          </tr>
        </tbody>
      </table>

      <div className="warn-box">
        <p>⚠️ <strong>Transferts hors UE (LLM) :</strong> Les prompts que vous soumettez à l'analyse sont transmis aux APIs d'OpenAI, Anthropic et Perplexity, hébergées aux États-Unis. Ces transferts sont encadrés par des Clauses Contractuelles Types (SCCs) adoptées par la Commission européenne. Évitez d'inclure des données personnelles dans vos prompts de monitoring.</p>
      </div>

      <p>Nous ne vendons, ne louons et ne cédons jamais vos données à des tiers à des fins commerciales.</p>

      {/* ── 4. Droits des personnes ── */}
      <h2>4. Vos droits</h2>
      <p>Conformément au RGPD (articles 15 à 22), vous disposez des droits suivants :</p>
      <ul>
        <li><strong>Droit d'accès (Art. 15)</strong> — obtenir une copie de vos données personnelles ;</li>
        <li><strong>Droit de rectification (Art. 16)</strong> — corriger des données inexactes ou incomplètes ;</li>
        <li><strong>Droit à l'effacement (Art. 17)</strong> — demander la suppression de vos données (« droit à l'oubli ») ;</li>
        <li><strong>Droit à la limitation (Art. 18)</strong> — restreindre le traitement de vos données ;</li>
        <li><strong>Droit à la portabilité (Art. 20)</strong> — recevoir vos données dans un format structuré et lisible par machine ;</li>
        <li><strong>Droit d'opposition (Art. 21)</strong> — vous opposer au traitement fondé sur notre intérêt légitime ;</li>
        <li><strong>Droit de retrait du consentement</strong> — retirer votre consentement à tout moment, sans que cela n'affecte la licéité du traitement antérieur.</li>
      </ul>

      <h3>Comment exercer vos droits ?</h3>
      <p>
        Adressez votre demande par email à <span className="fill">[privacy@votre-domaine.fr]</span> ou par courrier à <span className="fill">[ADRESSE POSTALE]</span>, en joignant un justificatif d'identité.
      </p>
      <p>
        Nous accuserons réception de votre demande dans un délai de <strong>72 heures</strong> et y répondrons au plus tard dans le mois suivant la réception.
      </p>
      <p>
        En cas de réclamation non résolue, vous disposez du droit de saisir la <strong>CNIL</strong> (Commission Nationale de l'Informatique et des Libertés) — <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">www.cnil.fr</a> — ou toute autre autorité de contrôle compétente.
      </p>

      {/* ── 5. Sécurité ── */}
      <h2>5. Sécurité des données</h2>
      <p>Nous mettons en œuvre les mesures techniques et organisationnelles suivantes pour protéger vos données :</p>
      <ul>
        <li>Chiffrement des mots de passe avec <strong>bcrypt</strong> ;</li>
        <li>Authentification par <strong>JWT</strong> avec expiration courte ;</li>
        <li>Connexions <strong>HTTPS/TLS</strong> exclusivement ;</li>
        <li>Isolation stricte des données entre organisations (multi-tenancy) ;</li>
        <li>Accès administrateur protégé par un flag dédié ;</li>
        <li>Base de données accessible uniquement depuis le réseau interne ;</li>
        <li>Sauvegardes chiffrées <span className="fill">[à préciser — fréquence, rétention]</span>.</li>
      </ul>
      <p>
        En cas de violation de données susceptible d'engendrer un risque pour vos droits et libertés, nous nous engageons à notifier la CNIL dans les <strong>72 heures</strong> et à vous informer sans délai injustifié (RGPD Art. 33 et 34).
      </p>

      {/* ── 6. Cookies ── */}
      <h2>6. Cookies et traceurs</h2>
      <p>Pour les informations relatives aux cookies, veuillez consulter notre <a href="/legal/cookies">Politique de cookies</a>.</p>

      {/* ── 7. DPO ── */}
      <h2>7. Délégué à la Protection des Données (DPO)</h2>
      <p>
        <span className="fill">[Si votre traitement est à grande échelle ou porte sur des données sensibles, la désignation d'un DPO est obligatoire (RGPD Art. 37). Pour un SaaS B2B au démarrage, ce n'est généralement pas obligatoire mais fortement recommandé.]</span>
      </p>
      <p>
        Notre point de contact pour toute question relative à la protection des données :{" "}
        <span className="fill">[privacy@votre-domaine.fr]</span>
      </p>

      {/* ── 8. Modifications ── */}
      <h2>8. Modifications de la présente politique</h2>
      <p>
        Nous pouvons mettre à jour cette politique à tout moment. En cas de modification substantielle, vous serez notifié par email au moins <strong>30 jours avant</strong> l'entrée en vigueur des changements.
      </p>

      <p className="subtitle" style={{ marginTop: "3rem" }}>
        Dernière mise à jour : <span className="fill">[JJ/MM/AAAA]</span>
      </p>
    </>
  );
}
