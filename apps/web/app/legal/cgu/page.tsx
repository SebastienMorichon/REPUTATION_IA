import type { Metadata } from "next";

export const metadata: Metadata = { title: "CGU / CGV — AI Reputation Shield" };

export default function CguPage() {
  return (
    <>
      <h1>Conditions Générales d'Utilisation et de Vente</h1>
      <p className="subtitle">
        Version en vigueur au <span className="fill">[JJ/MM/AAAA]</span> — service B2B fourni par{" "}
        <span className="fill">[NOM DE LA SOCIÉTÉ]</span>
      </p>

      {/* ── Préambule ── */}
      <h2>Préambule</h2>
      <p>
        Les présentes Conditions Générales d'Utilisation et de Vente (ci-après « CGUV ») régissent l'accès et l'utilisation du service <strong>AI Reputation Shield</strong> (ci-après « le Service »), plateforme SaaS de monitoring de la réputation de marque dans les réponses générées par des intelligences artificielles.
      </p>
      <p>
        Le Service est édité et commercialisé par <span className="fill">[NOM DE LA SOCIÉTÉ]</span>, <span className="fill">[FORME JURIDIQUE]</span> au capital de <span className="fill">[MONTANT] €</span>, immatriculée au RCS de <span className="fill">[VILLE]</span> sous le numéro <span className="fill">[SIRET]</span> (ci-après « l'Éditeur »).
      </p>
      <p>
        En s'inscrivant et en utilisant le Service, l'utilisateur (ci-après « le Client ») accepte sans réserve les présentes CGUV. Si le Client n'accepte pas ces conditions, il doit s'abstenir d'utiliser le Service.
      </p>
      <p>
        <strong>Le Service est exclusivement destiné à des professionnels (B2B).</strong> Toute utilisation par un consommateur au sens du Code de la consommation est exclue.
      </p>

      {/* ── 1. Description ── */}
      <h2>1. Description du Service</h2>
      <p>AI Reputation Shield est une plateforme SaaS permettant aux entreprises de :</p>
      <ul>
        <li>Soumettre des questions à des modèles de langage (LLM) tiers — ChatGPT (OpenAI), Claude (Anthropic), Perplexity — afin de mesurer la visibilité de leur marque dans les réponses générées ;</li>
        <li>Analyser automatiquement les réponses pour en extraire des indicateurs : visibilité, sentiment, part de voix, citations ;</li>
        <li>Suivre l'évolution de ces indicateurs dans le temps ;</li>
        <li>Générer des recommandations et des rapports (selon le plan souscrit).</li>
      </ul>
      <p>
        Le Service est fourni « en l'état » (<em>as is</em>). Les analyses produites ont une valeur <strong>indicative</strong> et ne constituent pas un conseil juridique, financier ou stratégique.
      </p>

      {/* ── 2. Inscription ── */}
      <h2>2. Inscription et compte</h2>
      <h3>2.1 Création de compte</h3>
      <p>
        L'accès au Service requiert la création d'un compte en fournissant une adresse email valide, un mot de passe sécurisé et le nom de l'organisation. Le Client s'engage à fournir des informations exactes et à les tenir à jour.
      </p>
      <h3>2.2 Sécurité</h3>
      <p>
        Le Client est seul responsable de la confidentialité de ses identifiants et de toute activité effectuée depuis son compte. Tout accès non autorisé doit être signalé sans délai à <span className="fill">[contact@votre-domaine.fr]</span>.
      </p>
      <h3>2.3 Essai gratuit</h3>
      <p>
        Tout nouveau compte bénéficie d'un essai gratuit de <strong>14 jours</strong> avec les fonctionnalités du plan Pro. À l'issue de cette période, sans souscription d'un abonnement payant, le compte est automatiquement rétrogradé au plan Gratuit.
      </p>

      {/* ── 3. Plans et tarifs ── */}
      <h2>3. Plans tarifaires et abonnement</h2>
      <h3>3.1 Plans disponibles</h3>
      <table>
        <thead>
          <tr><th>Plan</th><th>Prix HT/mois</th><th>Marques</th><th>Fonctionnalités clés</th></tr>
        </thead>
        <tbody>
          <tr><td>Gratuit</td><td>0 €</td><td>1</td><td>Runs manuels, tableau de bord basique</td></tr>
          <tr><td>Starter</td><td>49 €</td><td>1</td><td>PDF, recommandations, runs planifiés, support prioritaire</td></tr>
          <tr><td>Pro</td><td>149 €</td><td>5</td><td>Tout Starter + providers illimités</td></tr>
          <tr><td>Agence</td><td>499 €</td><td>Illimité</td><td>Tout Pro + marques illimitées</td></tr>
        </tbody>
      </table>
      <p>Les prix sont indiqués <strong>hors taxes</strong>. La TVA applicable sera ajoutée au taux en vigueur lors de la facturation.</p>
      <p>L'Éditeur se réserve le droit de modifier les tarifs avec un préavis de <strong>30 jours</strong> par email. Le Client peut résilier avant l'entrée en vigueur du nouveau tarif sans pénalité.</p>

      <h3>3.2 Paiement</h3>
      <p>
        Les paiements sont traités par <strong>Stripe</strong> (Stripe Payments Europe, Ltd.). Le Client accepte les <a href="https://stripe.com/fr/legal/ssa" target="_blank" rel="noopener noreferrer">conditions d'utilisation de Stripe</a>. L'Éditeur ne stocke aucune donnée bancaire.
      </p>
      <p>Les abonnements sont mensuels, à tacite reconduction. Le renouvellement est facturé automatiquement à la date anniversaire.</p>

      <h3>3.3 Absence de droit de rétractation</h3>
      <p>
        Conformément à l'article L221-28 du Code de la consommation, le droit de rétractation de 14 jours <strong>ne s'applique pas</strong> aux contrats de fourniture de contenus numériques dont l'exécution a commencé, avec l'accord express du professionnel. En tout état de cause, le Service étant exclusivement B2B, aucun droit de rétractation légal n'est applicable.
      </p>
      <p>
        Toutefois, l'Éditeur accorde à titre commercial un <strong>remboursement intégral</strong> dans les <strong>7 jours</strong> suivant le premier paiement si le Client n'est pas satisfait, sur simple demande à <span className="fill">[contact@votre-domaine.fr]</span>.
      </p>

      <h3>3.4 Résiliation</h3>
      <p>
        Le Client peut résilier son abonnement à tout moment depuis son espace client ou en contactant le support. La résiliation prend effet à la fin de la période en cours, déjà facturée. Aucun remboursement au prorata n'est effectué sauf disposition contraire.
      </p>

      {/* ── 4. Utilisation acceptable ── */}
      <h2>4. Utilisation acceptable</h2>
      <p>Le Client s'engage à utiliser le Service de manière licite et à ne pas :</p>
      <ul>
        <li>Soumettre des prompts visant à générer des contenus illicites, diffamatoires, discriminatoires ou portant atteinte aux droits de tiers ;</li>
        <li>Tenter de contourner les limitations de son plan ;</li>
        <li>Accéder aux données d'autres clients ou aux systèmes internes de l'Éditeur ;</li>
        <li>Utiliser le Service à des fins de revente ou de sous-location sans accord préalable ;</li>
        <li>Automatiser des appels massifs non prévus par le Service ;</li>
        <li>Violer les conditions d'utilisation des LLM tiers (OpenAI, Anthropic, Perplexity).</li>
      </ul>
      <p>
        En cas de violation, l'Éditeur se réserve le droit de suspendre ou de résilier le compte sans préavis ni remboursement.
      </p>

      {/* ── 5. Propriété intellectuelle ── */}
      <h2>5. Propriété intellectuelle</h2>
      <h3>5.1 Droits de l'Éditeur</h3>
      <p>
        Le Service, sa technologie, son interface, ses algorithmes et son code source sont la propriété exclusive de l'Éditeur. Aucune licence n'est accordée au Client en dehors du droit d'utilisation du Service dans les conditions des présentes CGUV.
      </p>
      <h3>5.2 Données du Client</h3>
      <p>
        Les données que le Client saisit (noms de marques, prompts, données concurrentielles) restent sa propriété. L'Éditeur les utilise uniquement pour fournir le Service et ne les revend pas à des tiers.
      </p>

      {/* ── 6. Disponibilité et SLA ── */}
      <h2>6. Disponibilité du Service</h2>
      <p>
        L'Éditeur s'efforce de maintenir le Service disponible <strong>24h/24, 7j/7</strong>. Des interruptions peuvent survenir pour maintenance, mise à jour ou en raison de la disponibilité des APIs tierces (OpenAI, Anthropic, Perplexity). L'Éditeur s'engage à prévenir les utilisateurs par email avec un préavis raisonnable pour les maintenances planifiées.
      </p>
      <p>
        La disponibilité du Service dépend également de celle des LLM tiers. L'Éditeur ne peut être tenu responsable des interruptions ou dégradations des APIs OpenAI, Anthropic ou Perplexity.
      </p>

      {/* ── 7. Responsabilité ── */}
      <h2>7. Limitation de responsabilité</h2>
      <p>
        Dans les limites permises par la loi applicable, la responsabilité de l'Éditeur est limitée aux dommages directs et prévisibles. En aucun cas l'Éditeur ne sera responsable de pertes de profits, perte de données, perte de clientèle ou tout dommage indirect, même si l'Éditeur a été informé de la possibilité de tels dommages.
      </p>
      <p>
        La responsabilité totale de l'Éditeur envers le Client au titre d'un mois donné est plafonnée au montant de l'abonnement mensuel payé pour ce mois.
      </p>
      <p>
        Les résultats fournis par le Service sont générés par des intelligences artificielles tierces et ont une valeur <strong>strictement indicative</strong>. L'Éditeur ne garantit pas leur exactitude, exhaustivité ou pertinence.
      </p>

      {/* ── 8. Données personnelles ── */}
      <h2>8. Données personnelles et sous-traitance</h2>
      <p>
        La collecte et le traitement des données personnelles sont régis par la <a href="/legal/confidentialite">Politique de confidentialité</a>.
      </p>
      <p>
        Dans le cadre de la fourniture du Service, l'Éditeur agit en tant que <strong>responsable de traitement</strong> pour les données de compte des Clients, et en tant que <strong>sous-traitant</strong> pour les données des marques et prompts que le Client soumet au Service.
      </p>
      <p>
        Les prompts soumis à l'analyse peuvent être transmis aux APIs des LLM tiers (OpenAI, Anthropic, Perplexity). Le Client est invité à ne pas inclure de données personnelles sensibles dans ses prompts de monitoring.
      </p>

      {/* ── 9. Modification ── */}
      <h2>9. Modification des CGUV</h2>
      <p>
        L'Éditeur se réserve le droit de modifier les présentes CGUV à tout moment. Les modifications entrent en vigueur <strong>30 jours</strong> après notification par email. L'utilisation continue du Service après cette période vaut acceptation des nouvelles conditions. En cas de désaccord, le Client peut résilier son compte sans pénalité avant l'entrée en vigueur des modifications.
      </p>

      {/* ── 10. Droit applicable ── */}
      <h2>10. Droit applicable et règlement des litiges</h2>
      <p>
        Les présentes CGUV sont soumises au <strong>droit français</strong>. En cas de litige, et à défaut de résolution amiable dans un délai de 30 jours, le différend sera soumis aux tribunaux compétents du ressort du siège social de l'Éditeur.
      </p>

      {/* ── 11. Contact ── */}
      <h2>11. Contact et support</h2>
      <p>
        Pour toute question relative aux présentes CGUV ou au Service :<br />
        <strong>Email :</strong> <span className="fill">[support@votre-domaine.fr]</span><br />
        <strong>Adresse :</strong> <span className="fill">[ADRESSE POSTALE COMPLÈTE]</span>
      </p>

      <p className="subtitle" style={{ marginTop: "3rem" }}>
        Dernière mise à jour : <span className="fill">[JJ/MM/AAAA]</span>
      </p>
    </>
  );
}
