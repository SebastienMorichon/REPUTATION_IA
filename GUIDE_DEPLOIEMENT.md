# Guide de déploiement - AI Reputation Shield

Ce guide explique comment déployer l'application en production sur **Vercel** (frontend) et **Render** (API + base de données).

---

## 📋 Prérequis

1. Un compte GitHub
2. Un compte [Vercel](https://vercel.com/)
3. Un compte [Render](https://render.com/)
4. Un compte [Upstash](https://upstash.com/) (Redis gratuit - sans carte bancaire)
5. Une clé API Anthropic

---

## 🚀 Étape 1 : Pousser le code sur GitHub

```bash
cd "/Users/sebastienmorichon/Claude/REPUTATION AI"

# Initialiser le dépôt (si pas encore fait)
git init

# Ajouter tous les fichiers
git add .

# Créer le premier commit
git commit -m "Initial commit - AI Reputation Shield"

# Créer une branche main si nécessaire
git branch -M main

# Ajouter le remote (remplace par ton URL GitHub)
git remote add origin https://github.com/TON_USERNAME/reputation-ai.git

# Pousser
git push -u origin main
```

---

## 📦 Étape 2 : Créer un Redis gratuit sur Upstash

1. Va sur [Upstash](https://upstash.com/) et connecte-toi (GitHub ou email)
2. Clique sur **"Create Database"**
3. Choisis :
   - **Name** : `reputation-redis`
   - **Region** : `europe-central` (Francfort - proche de Render)
   - **TLS** : activé
4. Clique **Create**
5. Copie les valeurs :
   - `UPSTASH_REDIS_REST_URL` (ex: `https://xxx.eu-central-1.upstash.io`)
   - `UPSTASH_REDIS_REST_TOKEN` (le token)

---

## 🗄️ Étape 3 : Déployer l'API sur Render

### 3.1 Créer un nouveau Blueprint

1. Connecte-toi sur [Render](https://render.com/)
2. Clique sur **"New +"** → **"Blueprint"**
3. Sélectionne ton dépôt GitHub `reputation-ai`
4. Render va détecter le fichier `render.yaml`

### 3.2 Configurer les variables d'environnement

Dans le Blueprint Render, configure ces variables :

| Variable | Valeur |
|----------|--------|
| `CELERY_BROKER_URL` | `redis://default:TOKEN@host:port` (voir note ci-dessous) |
| `CELERY_RESULT_BACKEND` | `db+postgresql://user:pass@host/db` (de la DB Render) |
| `JWT_SECRET` | `une-chaine-aleatoire-longue-et-securisee-xyz123` |
| `ANTHROPIC_API_KEY` | `sk-ant-...` (ta clé) |
| `FRONTEND_URL` | `https://ton-app.vercel.app` (après déploiement Vercel) |
| `WEB_ORIGIN` | `https://ton-app.vercel.app` |

> **Note pour `CELERY_BROKER_URL` avec Upstash** :
> Upstash fournit une URL Redis standard. Utilise le format :
> ```
> redis://default:TON_TOKEN@xxx.eu-central-1.upstash.io:6379
> ```
> Ou utilise l'URL `REDIS_URL` fournie par Upstash directement.

### 3.3 Lancer le déploiement

- Clique sur **"Apply"**
- Render va créer :
  - Le service web (API FastAPI)
  - La base de données PostgreSQL
- Note l'URL de l'API (ex: `https://reputation-ai-api.onrender.com`)

> ⚠️ **Plan gratuit** : Le service se met en veille après 15 min d'inactivité. Le premier démarrage peut prendre 30-50 secondes.

---

## 🎨 Étape 4 : Déployer le frontend sur Vercel

### 4.1 Importer le projet

1. Connecte-toi sur [Vercel](https://vercel.com/)
2. Clique sur **"Add New..."** → **"Project"**
3. Importe ton dépôt GitHub `reputation-ai`

### 4.2 Configurer le déploiement

Dans **"Build & Development Settings"** :

- **Framework Preset** : Next.js
- **Root Directory** : `apps/web`
- **Build Command** : `npm run build`
- **Install Command** : `npm install`

### 4.3 Ajouter les variables d'environnement

Ajoute cette variable :

| Variable | Valeur |
|----------|--------|
| `NEXT_PUBLIC_API_URL` | `https://reputation-ai-api.onrender.com` (ton URL Render) |

### 4.4 Déployer

- Clique sur **"Deploy"**
- Vercel va construire et déployer le frontend
- Note l'URL (ex: `https://reputation-ai.vercel.app`)

---

## 🔁 Étape 5 : Mettre à jour Render avec l'URL du frontend

Retourne sur Render et mets à jour :

- `FRONTEND_URL` → `https://ton-app.vercel.app`
- `WEB_ORIGIN` → `https://ton-app.vercel.app`

Puis redémarre le service API.

---

## 🔐 Étape 6 : Sécuriser l'application

### 6.1 Changer le JWT_SECRET

Sur Render, ajoute une variable :
```
JWT_SECRET=une-chaine-aleatoire-longue-et-securisee-xyz123
```

### 6.2 Configurer les clés API

- `ANTHROPIC_API_KEY` : ta clé Anthropic
- `OPENAI_API_KEY` : (optionnel) ta clé OpenAI

---

## ✅ Vérification

1. Ouvre `https://ton-app.vercel.app`
2. Crée un compte
3. Vérifie que l'API répond (check le dashboard)
4. Teste une analyse de marque

---

## 📊 Monitoring

### Render
- Dashboard → Logs pour voir les erreurs API
- Database → Pour surveiller PostgreSQL

### Vercel
- Dashboard → Analytics pour le trafic
- Functions → Logs des Serverless Functions

### Upstash
- Dashboard → Utilisation Redis (requêtes/jour)

---

## 💰 Coûts estimés

| Service | Plan | Coût |
|---------|------|------|
| Vercel | Hobby | Gratuit |
| Render Web Service | Free | Gratuit (avec limitations) |
| Render PostgreSQL | Free | Gratuit |
| Upstash Redis | Free | Gratuit (10k requêtes/jour) |
| **Total** | | **$0/mois** |

> ⚠️ Le plan gratuit Render a des limitations :
> - Service en veille après 15 min d'inactivité
> - 750 heures/mois maximum (partagées entre tous les services)
> - PostgreSQL : 1 Go max
>
> Upstash Redis gratuit : 10 000 commandes/jour, suffisant pour un petit projet.

Pour une utilisation en production, envisage le plan **Render Standard** (~7$/mois par service).

---

## 🛠️ Dépannage

### L'API ne répond pas
- Vérifie les logs Render
- Assure-toi que `DATABASE_URL` est bien configuré
- Vérifie que `CELERY_BROKER_URL` pointe vers Upstash

### Le frontend ne se connecte pas à l'API
- Vérifie `NEXT_PUBLIC_API_URL` dans Vercel
- Vérifie que `WEB_ORIGIN` est correct sur Render
- Ouvre la console navigateur pour voir les erreurs CORS

### Erreur Celery / Redis
- Vérifie que l'URL Upstash est correcte
- Upstash utilise le port 6379 par défaut
- Le token doit être celui affiché dans le dashboard Upstash

---

## 📧 Support

Pour toute question, consulte :
- [Docs Render](https://render.com/docs)
- [Docs Vercel](https://vercel.com/docs)
- [Docs Upstash](https://upstash.com/docs)
- [CLAUDE.md](./CLAUDE.md) pour l'architecture du projet
