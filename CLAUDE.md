# CLAUDE.md — EVA Note Context

## Projet

EVA Note est un MVP web pour kinésithérapeutes européens. Le flux principal :

1. Authentification via Clerk (tenant EU, UI DE par défaut).
2. Gestion minimale des patients (prénom/nom, sélection).
3. Démarrage d’une visite : enregistrement audio navigateur (streaming temps réel) ou saisie manuelle.
4. Transcription live via Deepgram (Nova-3 DE) avec suppression immédiate des audios une fois traités.
5. Génération d’une note SOAP détaillée (S/O/A/P) via Azure OpenAI (gpt-4o-mini) + validation JSON (Zod).
6. Révision/édition/sauvegarde, versions, copie formatée.

Le PRD détaillé et la stratégie d’implémentation se trouvent dans `eva_note_mvp_prd_system_design_build_plan.md`.

## Stack & conventions

- **Framework** : Next.js 15 (App Router), React 19, TypeScript strict, Server Actions.
- **UI** : Tailwind CSS v4, shadcn/ui (New York), tokens dans `src/app/globals.css`.
- **Auth** : Clerk (`ClerkProvider` dans `layout.tsx`, middleware dans `src/middleware.ts`).
- **Data** : Supabase (RLS basées sur `auth.jwt() ->> 'sub'` des utilisateurs Clerk). Les migrations par défaut du starter ont été supprimées.
- **AI** : Vercel AI SDK configuré vers Azure OpenAI, prompts SOAP en allemand avec validation Zod.
- **Transcription** : Deepgram WebSocket (stream Opus). Prévoir proxy côté serveur pour gérer les clés et purger l’audio.
- **Langue** : Interface en allemand pour le MVP. Internationalisation post-MVP (prévoir `language_pref`).

## Structure actuelle

```
src/
├── app/
│   ├── layout.tsx        # Metadata EVA, ClerkProvider, ThemeProvider
│   ├── page.tsx          # Dashboard MVP (à remplacer par écrans patients/visites)
│   ├── globals.css       # Styles globaux + tokens
│   └── api/              # (vide) — ajouter futurs endpoints Deepgram / SOAP
├── components/
│   ├── theme-provider.tsx
│   ├── theme-toggle.tsx
│   └── ui/               # shadcn/ui (garder seulement les composants utilisés)
├── lib/
│   ├── supabase.ts       # Client Supabase (server/client) avec Clerk
│   ├── user.ts
│   └── utils.ts
└── middleware.ts
```

## Points d’attention

- **Sécurité données** : audio, transcript et note doivent rester privés. Pas de stockage public. Supprimer les audios dès que la transcription est confirmée.
- **Réglementaire** : noter le consentement patient (v2) et maintenir la possibilité de revue humaine (note toujours modifiable).
- **Langue** : toutes les sorties (UI + prompts) en allemand au MVP.
- **Performances** : latence sous-titres < 1 s, génération SOAP < 10 s. Prévoir retries (3) sur Deepgram / Azure.
- **Versioning notes** : stocker `model`, `version`, timestamps; conserver historique.

## Étapes à implémenter

1. Modélisation Supabase : `patients`, `visits`, `visit_audio`, `transcripts`, `notes`.
2. UI patients/visites : listes, détails, état enregistrement/transcription.
3. Service Deepgram : obtention token, streaming, purge audio.
4. Génération SOAP : prompts (system+user), validation Zod, regénération partielle, bouton copier.
5. Observabilité : toasts, logs Sentry (à ajouter), suivi latence.

## Guidelines pour contributions

- Respecter le style Tailwind existant (classe `bg-background`, `text-foreground`, etc.) et la palette définie dans `globals.css`.
- Favoriser les Server Components/Actions quand possible. Basculer en Client Component uniquement si obligation (enregistrement audio, toasts, etc.).
- Ajouter des tests unitaires sur les helpers côté serveur (ex. validation SOAP).
- Les composants `ui/` inutilisés peuvent être supprimés au fur et à mesure pour alléger le bundle.
- Documenter dans le PRD lorsqu’une fonctionnalité est finalisée ou modifiée.

Cette base est nettoyée des éléments CodeGuide. Utilise ce document comme référence rapide avant toute modification.
