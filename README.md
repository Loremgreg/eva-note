# EVA Note

MVP web pour kinésithérapeutes : enregistrer la séance, transcrire en direct, générer une note SOAP en allemand et la sauvegarder par patient.

## Objectifs MVP

- Authentification Clerk (tenant EU).
- Gestion minimale des patients (prénom/nom, sélection).
- Visite avec transcription temps réel Deepgram (Nova-3 DE) ou saisie manuelle.
- Génération SOAP détaillée via Azure OpenAI (gpt-4o-mini).
- Édition / sauvegarde des notes avec historique et copie rapide.

Cf. `eva_note_mvp_prd_system_design_build_plan.md` pour le PRD complet, le design système et la roadmap technique.

## Pile technique

- Next.js 15 (App Router), React 19, TypeScript strict.
- Tailwind CSS v4 + shadcn/ui (New York) pour l’UI.
- Clerk (auth) + Supabase (données, RLS par utilisateur Clerk).
- Deepgram WebSocket pour la transcription, Azure OpenAI pour la génération SOAP.
- Vercel AI SDK (client / server actions) configuré Azure.

## Installation

```bash
npm install
npm run dev
# http://localhost:3000
```

## Variables d’environnement

```
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Azure OpenAI
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o-mini

# Deepgram
DEEPGRAM_API_KEY=

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Structure

```
src/
├── app/
│   ├── layout.tsx           # Providers (Clerk, thème), langue par défaut en DE
│   ├── page.tsx             # Dashboard MVP (patients, transcription, SOAP)
│   └── globals.css          # Tokens Tailwind + thèmes
├── components/              # shadcn/ui & primitives spécifiques
├── lib/                     # Supabase, utils Clerk
└── middleware.ts            # Protection Clerk (routes app)
supabase/
└── migrations/              # Ajoutez ici les migrations patients/visites/notes
```

## Prochaines étapes (résumé)

1. Écrire les migrations Supabase (`patients`, `visits`, `notes`, `transcripts`).
2. Implémenter le module transcription live (client AudioRecorder → API proxy Deepgram).
3. Ajouter les écrans patients/visites avec Server Actions.
4. Intégrer Azure OpenAI via Vercel AI SDK + validation Zod des notes SOAP.
5. Ajouter la purge automatique des audios et le suivi des versions de note.

Pour plus de détails : consulter la section Build Plan du PRD. Toute référence à « CodeGuide Starter » a été retirée ; ce dépôt est maintenant aligné sur EVA Note.
