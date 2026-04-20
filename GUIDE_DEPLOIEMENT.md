# Guide de déploiement - AI Reputation Shield

Ce guide explique comment déployer l'application en production sur **Vercel** (frontend) et **Render** (API + base de données).

---

## 📋 Prérequis

1. Un compte GitHub
2. Un compte [Vercel](https://vercel.com/)
3. Un compte [Render](https://render.com/)
4. Une clé API Anthropic (optionnel : OpenAI)

---

## 🚀 Étape 1 : Pousser le code sur GitHub

```bash
cd "/Users/sebastienmorichon/Claude/REPUTATION AI"

# Initialiser le dépôt
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

## 🗄️ Étape 2 : Déployer l'API sur Render

### 2.1 Créer un nouveau Blueprint

1. Connecte-toi sur [Render](https://render.com/)
2. Clique sur **"New +"** → **"Blueprint"**
3. Sélectionne ton dépôt GitHub `reputation-ai`
4. Render va détecter le fichier `render.yaml`

### 2.2 Configurer les variables d'environnement

Dans le Blueprint Render, configure ces variables :

| Variable | Valeur |
|----------|--------|
| `ANTHROPIC_API_KEY` | `sk-ant-...` (ta clé) |
| `FRONTEND_URL` | `https://ton-app.vercel.app` (après déploiement Vercel) |
| `WEB_ORIGIN` | `https://ton-app.vercel.app` |

### 2.3 Lancer le déploiement

- Clique sur **"Apply"**
- Render va créer :
  - Le service web (API FastAPI)
  - La base de données PostgreSQL
  - Le cache Redis
- Note l'URL de l'API (ex: `https://reputation-ai-api.onrender.com`)

> ⚠️ **Plan gratuit** : Le service se met en veille après 15 min d'inactivité. Le premier démarrage peut prendre 30-50 secondes.

---

## 🎨 Étape 3 : Déployer le frontend sur Vercel

### 3.1 Importer le projet

1. Connecte-toi sur [Vercel](https://vercel.com/)
2. Clique sur **"Add New..."** → **"Project"**
3. Importe ton dépôt GitHub `reputation-ai`

### 3.2 Configurer le déploiement

Dans **"Build & Development Settings"** :

- **Framework Preset** : Next.js
- **Root Directory** : `apps/web`
- **Build Command** : `npm run build`
- **Install Command** : `npm install`

### 3.3 Ajouter les variables d'environnement

Ajoute cette variable :

| Variable | Valeur |
|----------|--------|
| `NEXT_PUBLIC_API_URL` | `https://reputation-ai-api.onrender.com` (ton URL Render) |

### 3.4 Déployer

- Clique sur **"Deploy"**
- Vercel va construire et déployer le frontend
- Note l'URL (ex: `https://reputation-ai.vercel.app`)

---

## 🔁 Étape 4 : Mettre à jour Render avec l'URL du frontend

Retourne sur Render et mets à jour :

- `FRONTEND_URL` → `https://ton-app.vercel.app`
- `WEB_ORIGIN` → `https://ton-app.vercel.app`

Puis redémarre le service API.

---

## 🔐 Étape 5 : Sécuriser l'application

### 5.1 Changer le JWT_SECRET

Sur Render, ajoute une variable :
```
JWT_SECRET=une-chaine-aleatoire-longue-et-securisee-xyz123
```

### 5.2 Configurer les clés API

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

---

## 💰 Coûts estimés

| Service | Plan | Coût |
|---------|------|------|
| Vercel | Hobby | Gratuit |
| Render Web Service | Free | Gratuit (avec limitations) |
| Render PostgreSQL | Free | Gratuit |
| Render Redis | Free | Gratuit |
| **Total** | | **$0/mois** |

> ⚠️ Le plan gratuit Render a des limitations :
> - Service en veille après 15 min d'inactivité
> - 750 heures/mois maximum (partagées entre tous les services)
> - PostgreSQL : 1 Go max

Pour une utilisation en production, envisage le plan **Render Standard** (~7$/mois par service).

---

## 🛠️ Dépannage

### L'API ne répond pas
- Vérifie les logs Render
- Assure-toi que `DATABASE_URL` est bien configuré
- Vérifie que les migrations se sont bien exécutées

### Le frontend ne se connecte pas à l'API
- Vérifie `NEXT_PUBLIC_API_URL` dans Vercel
- Vérifie que `WEB_ORIGIN` est correct sur Render
- Ouvre la console navigateur pour voir les erreurs CORS

### Erreur de migration
```bash
# En local, pour tester
cd apps/api
source .venv/bin/activate
python -c "from app.models import engine, metadata; metadata.create_all(engine)"
```

---

## 📧 Support

Pour toute question, consulte :
- [Docs Render](https://render.com/docs)
- [Docs Vercel](https://vercel.com/docs)
- [CLAUDE.md](./CLAUDE.md) pour l'architecture du projet
