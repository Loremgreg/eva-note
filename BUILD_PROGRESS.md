# EVA Note MVP - Build Progress

**Dernière mise à jour** : 2025-01-20

## 🎯 Statut Global : **Phases 1-2 Complétées (Infrastructure)**

Les fondations de l'application sont en place. Les phases 3-6 nécessitent l'implémentation de l'UI et des composants interactifs.

---

## ✅ Phase 1 : Fondations Base de Données (COMPLÉTÉ)

### 1.1 Migration Supabase ✅
- ✅ Fichier créé : `supabase/migrations/20250120000000_initial_schema.sql`
- ✅ Tables créées :
  - `profiles` (liaison Clerk)
  - `patients` (prénom/nom, owner_id)
  - `visits` (statuts, timestamps, language_pref)
  - `transcripts` (texte, raw_json, confidence)
  - `notes` (SOAP jsonb, model, version, is_final)
  - `usage_metrics` (coûts STT/LLM par visite)
- ✅ Vue créée : `monthly_usage` (agrégation mensuelle)
- ✅ Triggers : `updated_at` automatique
- ✅ Commentaires : toutes les tables documentées
- ⚠️ RLS : désactivé pour MVP (sécurité via Server Actions)

### 1.2 Types TypeScript ✅
- ✅ Fichier créé : `src/lib/database.types.ts`
- ✅ Types générés manuellement depuis le schéma
- ✅ Helper types : `Row`, `Insert`, `Update` pour chaque table
- ✅ Type `SoapNote` pour structure SOAP

### 1.3 Configuration Environnement ✅
- ✅ Fichier mis à jour : `.env.example`
- ✅ Variables Clerk (EU tenant)
- ✅ Variables Supabase (EU region)
- ✅ Variables Azure OpenAI (région EU REQUIRED)
- ✅ Variables Deepgram (model, language)
- ✅ Variables WebSocket (timeout, heartbeat)
- ✅ Variables coûts (rates indicatifs 2025)
- ✅ Commentaires détaillés et validation régions EU

---

## ✅ Phase 2 : Infrastructure Serveur (COMPLÉTÉ)

### 2.1 Helpers & Validation ✅
Tous les fichiers créés dans `src/lib/` :

#### `src/lib/schemas.ts` ✅
- ✅ `SoapSchema` : validation 4 sections SOAP
- ✅ `PatientSchema` : validation prénom/nom
- ✅ `VisitSchema` : validation patient_id, language_pref, status
- ✅ `TranscriptSchema` : validation longueur min 20 caractères
- ✅ `UsageMetricsSchema` : validation métriques coûts
- ✅ `NoteSchema` : validation note complète
- ✅ Helpers : `validateSoapNote()`, `validatePatient()`, etc.

#### `src/lib/prompts.ts` ✅
- ✅ `SOAP_SYSTEM_DE` : prompt système allemand détaillé
- ✅ `createSoapUserPromptDE()` : template utilisateur avec contexte
- ✅ `SOAP_SYSTEM_FR` : prompt français (préparé pour i18n post-MVP)
- ✅ Helpers : `getSoapSystemPrompt()`, `createSoapUserPrompt()`

#### `src/lib/azure-openai.ts` ✅
- ✅ Validation région EU au démarrage (fail-fast si non-EU)
- ✅ Liste régions EU autorisées (8 régions)
- ✅ Client Azure OpenAI via Vercel AI SDK
- ✅ Helpers : `getAzureModel()`, `getModelDeployment()`, `getMaxOutputTokens()`
- ✅ Configuration summary (logging sans secrets)

#### `src/lib/transcript-utils.ts` ✅
- ✅ `cleanTranscript()` : suppression fillers allemands, espaces multiples
- ✅ `validateTranscriptLength()` : min 20, max 100k caractères
- ✅ `hasMeaningfulContent()` : vérification contenu réel
- ✅ `estimateWordCount()` : comptage mots
- ✅ `hashTranscript()` : hash simple pour idempotence
- ✅ `formatTranscriptForDisplay()` : formatage avec line breaks
- ✅ `truncateTranscript()` : preview avec ellipsis
- ✅ `extractDeepgramMetadata()` : extraction metadata JSON

#### `src/lib/soap-formatter.ts` ✅
- ✅ `formatSoapForCopy()` : formatage texte UTF-8 avec headers allemands
- ✅ `formatSoapAsJson()` : export JSON
- ✅ `formatSoapWithMetadata()` : formatage avec header (model, version, date)
- ✅ `formatSoapAsMarkdown()` : export Markdown
- ✅ `getSoapSectionLengths()` : comptage caractères par section
- ✅ `validateSoapCompleteness()` : vérification sections remplies
- ✅ `truncateSoap()` : preview sections

#### `src/lib/metrics.ts` ✅
- ✅ `calculateSttCost()` : calcul coût Deepgram (cents EUR)
- ✅ `calculateLlmCost()` : calcul coût Azure OpenAI (cents EUR)
- ✅ `calculateTotalCost()` : somme STT + LLM
- ✅ `formatCostAsEur()` : formatage €0.00
- ✅ `estimateTokenCount()` : estimation tokens (~4 chars/token DE)
- ✅ `estimateLlmCostFromText()` : estimation avant appel API
- ✅ `createUsageMetrics()` : object prêt pour insertion DB
- ✅ `checkCostThresholds()` : alertes si coûts élevés
- ✅ `aggregateMonthlyUsage()` : agrégation client-side

### 2.2 Server Actions ✅
Tous les fichiers créés dans `src/app/actions/` :

#### `src/app/actions/patients.ts` ✅
- ✅ `createPatient()` : création avec validation Zod + ownership
- ✅ `getPatients()` : liste filtrée par owner_id
- ✅ `getPatient()` : détail par ID avec vérification ownership
- ✅ `updatePatient()` : mise à jour avec validation
- ✅ `deletePatient()` : suppression (cascade visits/transcripts/notes)
- ✅ `searchPatients()` : recherche par prénom/nom (ilike)
- ✅ Revalidation automatique des paths après mutations
- ✅ Gestion erreurs complète avec messages français

#### `src/app/actions/visits.ts` ✅
- ✅ `createVisit()` : création avec vérification patient ownership
- ✅ `getVisitsByPatient()` : liste visites par patient
- ✅ `getVisit()` : détail avec transcript + note (jointure)
- ✅ `updateVisitStatus()` : mise à jour statut avec timestamps auto
- ✅ `deleteVisit()` : suppression (cascade)
- ✅ `getRecentVisits()` : dashboard récent avec join patients
- ✅ Gestion transitions statuts (draft → recording → processing → completed/failed)

#### `src/app/actions/soap.ts` ✅
- ✅ `generateSoapNote()` : génération SOAP avec Azure OpenAI
  - ✅ Retry logic (3 tentatives, backoff 1s/2s/3s)
  - ✅ Nettoyage transcript avant envoi
  - ✅ Validation longueur min 20 caractères
  - ✅ Idempotence via hash transcript
  - ✅ Versioning automatique
  - ✅ Enregistrement usage_metrics (tokens in/out)
  - ✅ Mise à jour statut visite (processing → completed/failed)
- ✅ `updateSoapNote()` : édition manuelle SOAP
- ✅ `markNoteAsFinal()` : finalisation note
- ✅ `regenerateSoapNote()` : nouvelle version (incrémente version)
- ✅ Helper interne : `saveTranscript()`
- ✅ Helper interne : `generateSoapWithRetry()` (retry recursif)

#### `src/app/actions/transcription.ts` ✅
- ✅ `getDeepgramConfig()` : configuration WebSocket sans exposer API key
- ✅ `getDeepgramTemporaryKey()` : clé temporaire (⚠️ insecure MVP only)
- ✅ `saveTranscriptFromStream()` : sauvegarde transcript post-WebSocket
  - ✅ Nettoyage transcript
  - ✅ Validation longueur
  - ✅ Enregistrement usage_metrics (STT duration)
  - ✅ Mise à jour statut visite → completed
- ✅ `updateRecordingStatus()` : mise à jour statut pendant enregistrement

### 2.3 API Routes ✅

#### `src/app/api/stt/stream/route.ts` ✅
- ✅ POST endpoint : configuration WebSocket Deepgram
- ✅ GET endpoint : informations endpoint
- ✅ Authentification Clerk
- ✅ ⚠️ Note : Next.js App Router ne supporte pas nativement WebSocket
- ✅ Configuration retournée pour connexion client-side directe
- ✅ Production warning : nécessite proxy serveur séparé

---

## ⏳ Phase 3 : UI Patients & Visites (EN ATTENTE)

### 3.1 Pages & Layouts
- ⏳ `src/app/dashboard/layout.tsx` : layout dashboard avec navigation
- ⏳ `src/app/dashboard/page.tsx` : liste patients + bouton "Nouveau"
- ⏳ `src/app/dashboard/patients/[id]/page.tsx` : détails patient + liste visites
- ⏳ `src/app/dashboard/patients/[id]/visits/[visitId]/page.tsx` : détail visite

### 3.2 Composants Patients
- ⏳ `src/components/patients/patient-list.tsx`
- ⏳ `src/components/patients/patient-form.tsx`
- ⏳ `src/components/patients/patient-card.tsx`

### 3.3 Composants Visites
- ⏳ `src/components/visits/visit-list.tsx`
- ⏳ `src/components/visits/visit-card.tsx`
- ⏳ `src/components/visits/new-visit-dialog.tsx`

---

## ⏳ Phase 4 : Transcription Live (EN ATTENTE)

### 4.1 Composant AudioRecorder (Client Component)
- ⏳ `src/components/transcription/audio-recorder.tsx`
  - Détection support `audio/webm;codecs=opus`
  - `MediaRecorder` → chunks 200ms
  - WebSocket connexion Deepgram
  - États : "Enregistrement", "Transcription", "Finalisé"
  - Retry (3x, backoff 1s/2s/3s)
  - Fallback "Saisie manuelle"

### 4.2 Composant TranscriptDisplay
- ⏳ `src/components/transcription/transcript-display.tsx`
  - Affichage partials live
  - Affichage transcript final
  - Indicateur confidence

### 4.3 Composant TextInput
- ⏳ `src/components/transcription/text-input.tsx`
  - Textarea limite 10k caractères
  - Compteur caractères
  - Autosave (debounce 2s)

---

## ⏳ Phase 5 : SOAP Note Editor (EN ATTENTE)

### 5.1 Composant SoapNoteEditor
- ⏳ `src/components/soap/soap-note-editor.tsx`
  - 4 sections éditables (S/O/A/P)
  - Autosave (debounce 3s)
  - Bouton "Regénérer"
  - Bouton "Copier" avec toast
  - Affichage métadonnées (model, version, timestamp)

### 5.2 États & Feedback
- ⏳ `src/components/soap/soap-generation-status.tsx`
  - États : "Génération", "Tentative 2/3", "Erreur", "Prêt"
  - Spinner + progression
  - Messages allemands

---

## ⏳ Phase 6 : Observabilité (EN ATTENTE)

### 6.1 Toasts & Notifications
- ⏳ Intégrer `sonner` (déjà installé)
- ⏳ Messages allemands

### 6.2 Métriques Coûts
- ⏳ Dashboard admin (post-MVP)

### 6.3 Sentry (optionnel)
- ⏳ Configuration avec filtre PII

---

## 📋 Prochaines Étapes

### Immédiat (avant de coder l'UI)
1. ✅ **Exécuter la migration Supabase**
   ```bash
   # Depuis le projet Supabase Dashboard ou CLI
   supabase migration up
   ```

2. ✅ **Configurer les variables d'environnement**
   ```bash
   cp .env.example .env.local
   # Remplir toutes les variables (Clerk, Supabase, Azure, Deepgram)
   ```

3. ✅ **Tester la connexion Supabase**
   - Vérifier que les tables sont créées
   - Tester insertion manuelle dans `profiles`

4. ✅ **Tester Azure OpenAI**
   - Vérifier que la région EU est correcte
   - Tester génération SOAP avec un transcript test

5. ✅ **Configurer Webhook Clerk → Supabase** (optionnel MVP)
   - Créer Edge Function `clerk-sync`
   - Configurer webhook dans Clerk Dashboard

### Phase 3 : UI Patients (estimé 4-6h)
- Créer le layout dashboard
- Implémenter la liste patients
- Implémenter le formulaire patient
- Implémenter la recherche patients

### Phase 4 : Transcription Live (estimé 6-8h)
- Implémenter AudioRecorder avec MediaRecorder API
- Gérer WebSocket Deepgram côté client
- Implémenter retry logic
- Implémenter fallback saisie manuelle

### Phase 5 : SOAP Editor (estimé 4-6h)
- Implémenter l'éditeur 4 sections
- Implémenter autosave
- Implémenter copie formatée
- Implémenter bouton regénérer

### Phase 6 : Polish (estimé 2-4h)
- Ajouter toasts (sonner)
- Améliorer messages d'erreur
- Ajouter loading states
- Tests manuels complets

---

## 🐛 Issues Connus & Limitations MVP

### WebSocket Implementation
- ⚠️ Next.js App Router ne supporte pas WebSocket natif
- 🔧 Solution MVP : connexion client-side directe à Deepgram
- 🔧 Production : déployer proxy WebSocket séparé (Socket.io, AWS Lambda WebSocket)

### Sécurité API Keys
- ⚠️ `getDeepgramTemporaryKey()` expose la clé API (MVP only!)
- 🔧 Production : utiliser Deepgram Temporary Keys API

### RLS Supabase
- ⚠️ RLS désactivé pour MVP
- 🔧 Sécurité via Server Actions + Clerk userId
- 🔧 Post-MVP : activer RLS + JWT claim propagation

### Tests
- ⚠️ Pas de tests unitaires/intégration pour MVP
- 🔧 Post-MVP : ajouter Jest/Vitest

---

## 📚 Documentation Technique

### Architecture
- **Database** : Supabase Postgres (EU region)
- **Auth** : Clerk (EU tenant, UI DE)
- **AI** : Azure OpenAI (EU region enforced)
- **STT** : Deepgram Nova-3 (streaming WebSocket)
- **Framework** : Next.js 15 App Router
- **Styling** : Tailwind CSS v4 + shadcn/ui

### Fichiers Clés
- `CLAUDE.md` : guide pour Claude Code
- `eva_note_mvp_prd_system_design_build_plan.md` : PRD complet
- `BUILD_PROGRESS.md` : ce fichier (état d'avancement)
- `.env.example` : template variables d'environnement

### Commandes Utiles
```bash
# Développement
npm run dev

# Build production
npm run build

# Linting
npm run lint

# Types check
npx tsc --noEmit
```

---

**Dernière mise à jour** : 2025-01-20 - Phases 1-2 complétées ✅
