# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projet

EVA Note est un MVP web pour kinésithérapeutes européens. Le flux principal :

1. Authentification via Clerk (tenant EU, UI DE par défaut).
2. Gestion minimale des patients (prénom/nom, sélection).
3. Démarrage d'une visite : enregistrement audio navigateur (streaming temps réel) ou saisie manuelle.
4. Transcription live via Deepgram (Nova-3 DE) avec suppression immédiate des audios une fois traités.
5. Génération d'une note SOAP détaillée (S/O/A/P) via Azure OpenAI (gpt-4o-mini) + validation JSON (Zod).
6. Révision/édition/sauvegarde, versions, copie formatée.

Le PRD détaillé et la stratégie d'implémentation se trouvent dans `eva_note_mvp_prd_system_design_build_plan.md`.

## Commandes essentielles

```bash
# Développement local (avec Turbopack)
npm run dev

# Build de production
npm run build

# Démarrage de la version production (après build)
npm run start

# Linting
npm run lint
```

## Stack & conventions

- **Framework** : Next.js 15 (App Router), React 19, TypeScript strict, Server Actions.
- **UI** : Tailwind CSS v4, shadcn/ui (New York), tokens dans `src/app/globals.css`.
- **Auth** : Clerk (`ClerkProvider` dans `layout.tsx`, middleware dans `src/middleware.ts`).
- **Data** : Supabase (RLS basées sur `auth.jwt() ->> 'sub'` des utilisateurs Clerk). Les migrations par défaut du starter ont été supprimées.
- **AI** : Vercel AI SDK configuré vers Azure OpenAI, prompts SOAP en allemand avec validation Zod.
- **Transcription** : Deepgram WebSocket (stream Opus). Prévoir proxy côté serveur pour gérer les clés et purger l’audio.
- **Langue** : Interface en allemand pour le MVP. Internationalisation post-MVP (prévoir `language_pref`).

## Architecture & Structure

### Pattern général
- **Server Components par défaut** : privilégier les Server Components. Basculer en Client Component (`"use client"`) uniquement si nécessaire (audio, toasts, interactions riches).
- **Server Actions** : utilisées pour mutations et opérations Supabase côté serveur.
- **Client Supabase** : deux patterns selon le contexte :
  - `supabase` (client basique) : pour les appels depuis les Server Components sans auth.
  - `createSupabaseServerClient()` : injecte le token Clerk dans les headers pour les appels authentifiés depuis Server Components/Actions.

### Authentification Clerk ↔ Supabase
- **Middleware** (`src/middleware.ts`) : protège les routes `/dashboard` et `/profile` via Clerk.
- **JWT Clerk** : le token obtenu via `auth().getToken()` est passé comme `Authorization: Bearer <token>` à Supabase.
- **RLS Supabase** : les policies doivent vérifier `auth.jwt() ->> 'sub'` = `profiles.clerk_user_id`.
- **Sync utilisateurs** : utiliser un webhook Clerk → Supabase Edge Function pour UPSERT automatique dans `profiles` (cf. PRD section 5.7).

### Structure des dossiers

```
src/
├── app/
│   ├── layout.tsx        # Root layout : ClerkProvider, ThemeProvider, metadata
│   ├── page.tsx          # Dashboard MVP (à implémenter : patients/visites)
│   ├── globals.css       # Tokens Tailwind v4 + thème dark/light
│   └── api/              # À créer : endpoints pour Deepgram WS proxy + SOAP
├── components/
│   ├── theme-provider.tsx
│   ├── theme-toggle.tsx
│   └── ui/               # shadcn/ui (New York) — supprimer les composants inutilisés
├── lib/
│   ├── supabase.ts       # Clients Supabase (basique + server avec auth Clerk)
│   ├── user.ts
│   └── utils.ts          # cn() + helpers
└── middleware.ts         # Protection Clerk des routes app
```

### Composants à créer (selon PRD)
- **Patients** : liste, création, sélection patient.
- **Visites** : démarrage visite, choix audio/texte, états (draft/recording/processing/completed/failed).
- **AudioRecorder** : Client Component pour `MediaRecorder` + WebSocket vers `/api/stt/stream`.
- **TranscriptDisplay** : affichage live des partials + transcript final.
- **SoapNoteEditor** : sections S/O/A/P éditables, autosave, bouton copier, versioning.

## Points d’attention

- **Sécurité données** : audio, transcript et note doivent rester privés. Pas de stockage public. Supprimer les audios dès que la transcription est confirmée.
- **Réglementaire** : noter le consentement patient (v2) et maintenir la possibilité de revue humaine (note toujours modifiable).
- **Langue** : toutes les sorties (UI + prompts) en allemand au MVP.
- **Performances** : latence sous-titres < 1 s, génération SOAP < 10 s. Prévoir retries (3) sur Deepgram / Azure.
- **Versioning notes** : stocker `model`, `version`, timestamps; conserver historique.

## Flux de données critiques

### Enregistrement audio → Transcription
1. Client : `MediaRecorder` → `audio/webm;codecs=opus` (Chrome/Edge) ou `audio/ogg;codecs=opus` (Firefox).
2. Client : ouvre WebSocket `/api/stt/stream` avec auth Clerk (cookie/header).
3. Serveur : proxy vers Deepgram WS (`wss://api.deepgram.com/v1/listen?model=nova-3&language=de`).
4. Deepgram → serveur : partials (événements temps réel) → relayés au client.
5. Fin : client envoie `{type:"stop"}` → serveur envoie `CloseStream` à Deepgram → transcript final enregistré dans `transcripts` → audio **supprimé immédiatement** (GDPR).
6. Timeout : 30s sans audio → fermeture automatique (code 4000).
7. Retry : 3 tentatives côté client avec backoff progressif (1s, 2s, 3s). Fallback saisie manuelle si échec.

### Transcription → Note SOAP
1. Serveur : récupère transcript depuis `transcripts(visit_id)`.
2. Nettoyage : suppression hésitations, doublons, métadonnées.
3. Validation : si `transcript.length < 20` → erreur, proposer réessai ou saisie manuelle.
4. Appel Azure OpenAI : prompts `SOAP_SYSTEM_DE` + `SOAP_USER_TEMPLATE_DE(rawText)` → `response_format: json_object`.
5. Validation Zod : `SoapSchema` → {subjective, objective, assessment, plan}.
6. Enregistrement : `notes(visit_id, soap, model, version)` avec `is_final: false`.
7. Retry : 3 tentatives avec backoff si erreur Azure. Fallback saisie manuelle.

### Variables d'environnement obligatoires

```env
# Clerk (tenant EU)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Supabase (région EU)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Azure OpenAI (région EU uniquement : westeurope, germanywestcentral, etc.)
AZURE_OPENAI_ENDPOINT=https://<resource>.openai.azure.com
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_REGION=germanywestcentral  # MUST be EU region
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini-eu
AZURE_OPENAI_API_VERSION=2024-02-01
LLM_MAX_OUTPUT_TOKENS=1024

# Deepgram
DEEPGRAM_API_KEY=

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**IMPORTANT** : le code **échoue au démarrage** si `AZURE_OPENAI_REGION` n'est pas une région UE autorisée (conformité GDPR).

## Étapes à implémenter (selon PRD)

1. **Migrations Supabase** : tables `profiles`, `patients`, `visits`, `transcripts`, `notes`, `usage_metrics` + RLS.
2. **Webhook Clerk** : Edge Function Supabase pour sync automatique `profiles` (UPSERT sur `user.created/updated`).
3. **UI Patients/Visites** : listes, création, sélection, statuts visite.
4. **API Deepgram** : `/api/stt/stream` (WebSocket proxy), gestion timeout, retry, codes fermeture.
5. **Génération SOAP** : Server Action avec prompts DE, validation Zod, versioning, copie formatée.
6. **Observabilité** : Sentry (logs sans PII), toasts (sonner), métriques coûts (`usage_metrics`).

## Guidelines de développement

### Style & UI
- Utiliser les tokens Tailwind existants : `bg-background`, `text-foreground`, `border`, etc. (définis dans `globals.css`).
- Respecter le style shadcn/ui (New York) pour cohérence visuelle.
- Supprimer les composants `ui/` inutilisés pour optimiser le bundle.
- **Langue UI** : allemand (DE) uniquement au MVP. Pas d'anglais dans l'interface.

### Patterns de code
- **Server Components par défaut** : toujours privilégier Server Components, basculer en Client Component (`"use client"`) seulement si nécessaire.
- **Server Actions** : pour les mutations/writes Supabase. Valider côté serveur avec Zod avant DB.
- **Supabase + Clerk** : utiliser `createSupabaseServerClient()` pour injecter le JWT Clerk dans les appels authentifiés.
- **Pas de PII dans les logs** : logger uniquement IDs, statuts, durées. Jamais de contenu patient.
- **Retry pattern** : 3 tentatives avec backoff progressif (1s, 2s, 3s) pour STT et LLM. Toujours proposer fallback saisie manuelle.

### Sécurité & GDPR
- **Pas de stockage audio** : l'audio est streamé uniquement, supprimé immédiatement après transcription.
- **RLS Supabase** : activer RLS sur toutes les tables sensibles, policies basées sur `profiles.clerk_user_id = auth.jwt()->>'sub'`.
- **Azure OpenAI EU** : région MUST être UE (westeurope, germanywestcentral, etc.). Code échoue si non-EU.
- **Rate limiting** : implémenter limite de 3 visites/heure par utilisateur (MVP).
- **CORS** : autoriser uniquement `localhost:3000` (dev) et domaine Vercel (prod).

### Tests
- Ajouter des tests unitaires pour :
  - Validation Zod (schémas SOAP).
  - Helpers de nettoyage transcript.
  - Calculs coûts (`usage_metrics`).
- Tester manuellement les WebSockets (Deepgram proxy) avec différents navigateurs (Chrome, Edge, Firefox).

### Performance
- **Latence cible** : sous-titres live < 1s, génération SOAP < 10s.
- **Plafonds** : max 15 min d'audio (900s), max 10 000 caractères saisie manuelle, max 1024 tokens sortie LLM.
- **Monitoring** : intégrer Sentry pour tracking erreurs (sans PII), PostHog/Mixpanel pour analytics (facultatif).

### Documentation
- Mettre à jour le PRD (`eva_note_mvp_prd_system_design_build_plan.md`) quand une fonctionnalité est finalisée.
- Commenter le code en anglais (convention dev), UI en allemand (convention produit).

## Références

- **PRD complet** : `eva_note_mvp_prd_system_design_build_plan.md` (architecture, schéma DB, prompts, coûts).
- **Setup Supabase + Clerk** : `SUPABASE_CLERK_SETUP.md` (si disponible).
- **shadcn/ui** : composants dans `src/components/ui/`, configuration dans `components.json`.

Cette base est nettoyée des éléments du starter CodeGuide. Utilise ce document comme référence rapide avant toute modification.
