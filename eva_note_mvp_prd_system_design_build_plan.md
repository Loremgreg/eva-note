# PT AI Notes MVP — PRD, System Design & Build Plan

*Last updated: 23 Sep 2025*

---


## 1) PRD — Product Requirements Document

### 1.1 Contexte & problème

Les kinésithérapeutes passent trop de temps à documenter les séances (notes SOAP) après les heures. La qualité et la constance de ces notes varient, et les relire/structurer est chronophage.

### 1.2 Objectif MVP

Créer une application web simple qui permet :

1. **Enregistrer la séance** (audio du navigateur, conversation en direct: Live transcription (streaming)) 
2. **Transcrire** l’audio (STT streaming temps réel via Deepgram WebSocket),
3. **Générer automatiquement une note SOAP** via un LLM **Azure OpenAI EU** (via SDK Azure ou Vercel AI SDK configuré Azure) à partir du transcript,
4. **Réviser / éditer / sauvegarder** la note et l’attacher au patient/à la visite.


### 1.3 Portée (MVP)

**Inclus**

- Authentification via **Clerk** (UI & sessions, tenant en **région EU**, UI par défaut en **allemand**).
- Gestion minimale des patients (CRUD basique : créer/lister/sélectionner, champs **prénom/nom uniquement**).
- Démarrer une **visite**, enregistrer l’audio du navigateur (**streaming temps réel**) **ou** saisir du texte manuellement.
- Transcription **streaming temps réel** via Deepgram WebSocket (**Nova-3 DE**) avec sous-titres live (partials) et transcript final.
- Génération **SOAP détaillée** (S/O/A/P) via **Azure OpenAI EU** (via SDK Azure ou Vercel AI SDK configuré Azure).
- Édition manuelle et **sauvegarde** de la note.
- Export **copier/coller formaté** (pas de PDF pour MVP).

**Hors scope (plus tard)**

- Intégrations EMR/ERP.
- HEP (home exercise program) auto.
- Génération plan traitement EBP 
- Mobile app native.
- Multilingue complet (FR/DE/EN).

### 1.4 Personae

- **PT Solo** : kiné indépendant qui veut gagner du temps sur la doc.
- **PT Multi-cabinet (v2)** : responsable d’un petit cabinet (2–5 PT), besoin de cohérence documentaire.

### 1.5 User stories principales (MVP)

1. **En tant que PT**, je peux me connecter avec Clerk pour accéder à mon espace sécurisé.\
   *AC:* redirection si non connecté ; profil visible ; logout dispo.
2. **En tant que PT**, je peux créer un **patient** (nom, prénom ).\
   *AC:* validations basiques, liste paginée.
3. **En tant que PT**, je peux démarrer une **visite** pour un patient, soit **dicter** (**streaming temps réel**), soit **écrire manuellement**.\
   *AC:* état clair (enregistrement streaming, en cours de transcription live, ou saisie manuelle).
4. **En tant que PT**, après transcription ou saisie, je peux **générer une note SOAP détaillée** automatique, la **relire**, **éditer**, **sauvegarder**.\
   *AC:* sections S/O/A/P pré‑remplies ; modifiables ; bouton « enregistrer » ; horodatage.
5. **En tant que PT**, je peux copier la note.\
   *AC:* texte formaté, encodage UTF‑8.

### 1.6 KPI / succès

- ⏱️ **Latence live** des sous-titres < 1 s ; génération SOAP < 10 s après arrêt.
- 📄 **Taux d’édition** (pour affiner le prompt & UX) : % de notes modifiées < 70% à terme.
- ✅ **Taux de complétion** (du flux "enregistrer/écrire → note sauvegardée") > 80%.

### 1.7 Contraintes & conformité

- **Langue par défaut** : allemand (DE). Multilingue possible en phase ultérieure.
- **Sécurité des données** : audio, transcript, note = **privés** (pas de public bucket).
- **Suppression audio** : suppression **immédiate** après transcription (aucune rétention).
- **GDPR** : prévoir consentement patient (textuel) pour enregistrement (v2: bannière/checkbox).
- **Réglementaire** : cibles initiales hors remboursement/assureur pour MVP ; contenu documentaire doit rester **revu par le PT**.
- **Coûts** : limiter appels LLM/STT (quota & alertes) ; choisir le **modèle IA le moins cher** utilisable.

### 1.8 Hypothèses & validations techniques

**Audio streaming (à vérifier avant développement) :**
- Format : `audio/webm;codecs=opus` (Chrome/Edge) ou `audio/ogg;codecs=opus` (Firefox).
- Deepgram WebSocket accepte le stream Opus natif sans réencodage serveur.
- Fallback : si `opus` non supporté → `audio/webm` (codec par défaut du navigateur).
- Navigateur cible MVP : Chrome, Edge ou Firefox Desktop (Safari non supporté au MVP).

**Tests préliminaires obligatoires :**
- [ ] Créer un compte Deepgram et tester l'envoi d'un flux Opus via WebSocket.
- [ ] Confirmer qu'Azure OpenAI déploie `gpt-4o-mini` en région `germanywestcentral`.

**Notes techniques additionnelles :**
- Détection dynamique côté client : `MediaRecorder.isTypeSupported('audio/webm;codecs=opus')` sinon fallback `audio/ogg;codecs=opus`.
- Si aucun format supporté : afficher un message d’erreur clair → « Utilisez Chrome/Edge/Firefox desktop pour l’enregistrement live (MVP) ».
- Phase 1.5 possible : conversion serveur (re-encode PCM 16 kHz mono via FFmpeg) pour compatibilité Safari.

---

## 2) Architecture

### 2.1 Vue d’ensemble

- **Next.js 15 (App Router)** — UI, routes API, Server Actions.
- **Clerk (EU tenant, UI en DE)** — Auth (UI + session).
- **Supabase** — Postgres (région EU). **Pas de stockage audio** au MVP (stream only).
- **Deepgram STT** — **streaming temps réel** (WebSocket) en allemand **Nova-3 DE** (partials + transcript final).
- **Azure OpenAI EU** (via SDK Azure ou Vercel AI SDK configuré Azure) — génération note SOAP.

**Flux (Phase 1 — MVP)**

1. PT démarre **Visite** → choisit **Dicter** (streaming) ou **Écrire**.
2. Si audio : le client ouvre un **WebSocket** vers **/api/stt/stream** (proxy serveur) → le serveur relaye vers Deepgram WS.
3. **Transcription live** : l’UI affiche les **partials** en temps réel ; à l’arrêt, on reçoit un **transcript final**.
4. **Aucun stockage audio** : seul le **transcript** est enregistré en base (GDPR).
5. Serveur → **Azure OpenAI EU** pour générer la note SOAP.

### 2.2 Séquence détaillée (streaming WebSocket)

**Phase 1 : Connexion & streaming**
1. Client → ouvre WebSocket `/api/stt/stream` (auth Clerk via cookie/header).
2. Serveur → vérifie auth, ouvre connexion Deepgram WebSocket (`wss://api.deepgram.com/v1/listen?model=nova-3&language=de`).
3. Client → envoie des chunks audio (Opus) via WebSocket toutes les ~200 ms.
4. Deepgram → renvoie des événements `Results` (partials) en temps réel.
5. Serveur → relaye ces partials au client (affichage live des sous-titres).

**Phase 2 : Arrêt & finalisation**
6. Client → clique "Stop" → envoie message `{"type":"stop"}` au serveur.
7. Serveur → envoie `{"type":"CloseStream"}` à Deepgram (déclenche la finalisation du flux audio).
8. Deepgram → renvoie événement `SpeechFinal` (ou équivalent) avec le transcript complet.
8bis. Serveur → attend jusqu’à **3 s** la réception des événements finals. Si aucun final n’arrive, il utilise le dernier segment final connu (ou à défaut le dernier partial) et loggue un avertissement.
9. Serveur → enregistre `transcripts(visit_id, text, raw_json)` en base.
10. Serveur → ferme WebSocket avec code **4001 CLIENT_CLOSED**.
11. Client → affiche "Transcript enregistré" et passe à la génération SOAP.

**Gestion timeout (30 s sans audio)**
- Serveur → `setTimeout` qui envoie `CloseStream` à Deepgram après 30 s d’inactivité.
- Deepgram → renvoie `SpeechFinal` si possible.
- Serveur → enregistre et ferme avec code **4000 INACTIVITY_TIMEOUT**.

---

## 3) Résilience & Gestion d’erreurs (MVP)

### Problème identifié

- **Retry automatique** : réessayer 2–3 fois en cas d’échec (avec petit délai progressif entre les tentatives).
- **Plan B** : si après plusieurs tentatives cela échoue, proposer à l’utilisateur un mode **Saisie manuelle** (il écrit directement son texte).
- **Feedback clair** : afficher l’état (ex. « transcription en cours… tentative 2/3 », « échec → réessayer ou saisir manuellement »).
- **Aucune donnée audio persistée** : en cas d’échec, le flux est simplement interrompu (GDPR).


> **Approche MVP** : Retry simple côté client.  
> Le navigateur tente jusqu’à 3 fois de reconnecter le flux audio à Deepgram, avec un délai progressif.  
> Si toutes les tentatives échouent, on affiche un message clair et propose la saisie manuelle.  
> Aucun système de queue serveur (ex. BullMQ) n’est utilisé pour le MVP.

```ts
// MVP : retry simple côté client (pas de queue serveur)
// Tentatives de reconnexion automatiques à Deepgram (3x max), avec backoff progressif.
// Fallback : saisie manuelle si tout échoue.

async function transcribeWithRetry(audioStream: MediaStream, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Tentative de connexion WebSocket à Deepgram
      return await connectDeepgramWS(audioStream);
    } catch (error) {
      console.warn(`Transcription tentative ${attempt} échouée`, error);

      if (attempt === maxRetries) {
        // Fallback : saisie manuelle
        showToast('Transcription échouée → Saisie manuelle ?');
        return null;
      }

      // Backoff progressif avant nouvel essai (1s, 2s, 3s…)
      await sleep(1000 * attempt);
    }
  }
}

// Helper sleep
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### Politique Streaming WebSocket (MVP)

> **Timeout**: si aucun audio reçu pendant 30s, le serveur ferme la connexion WebSocket.
> **Un seul reconnect**: le client peut tenter une reconnexion automatique une seule fois si la connexion est perdue.
> **Feedback UI**: l’utilisateur est notifié si la connexion WebSocket est perdue ou si un timeout survient.

```ts
// Exemple (client) : reconnexion unique
let hasReconnected = false;
ws.onclose = () => {
  if (!hasReconnected) {
    hasReconnected = true;
    reconnectWebSocket();
  }
};
// Serveur : timeout si pas de données
setTimeout(() => {
  if (!audioReceivedRecently) ws.close();
}, 30000);
```


### Gestion WebSocket (heartbeat / timeout / reconnexion)

```ts
// Heartbeat + timeout
const WS_TIMEOUT_MS = 30000; // 30s sans audio → fermeture
const HEARTBEAT_INTERVAL_MS = 10000; // ping/10s

// Reconnexion automatique (1 seule fois)
if (ws.readyState === WebSocket.CLOSED && !hasReconnected) {
  hasReconnected = true;
  reconnectWebSocket();
}
```

#### Codes de fermeture & comportement (serveur)
- **4000 INACTIVITY_TIMEOUT** : aucun audio reçu pendant `WS_TIMEOUT_MS` → fermeture côté serveur. Tenter d’envoyer le **final transcript** si disponible avant `close`.
- **4001 CLIENT_CLOSED** : l’utilisateur clique **Stop** → envoyer le **final transcript**, fermer proprement.
- **4002 PROXY_ERROR** : erreur réseau/proxy lors du relay WS → fermeture et log technique (sans PII).
- **Remarque** : toujours terminer la session en essayant d’émettre les dernières hypothèses **finales** de Deepgram si disponibles.

-#### Feedback UI (toasts & états)
- Toasts : « Verbindung verloren » / « Wiederverbinden… » / « Timeout (30s ohne Audio) » / « Stream beendet » / « Finales Transkript gespeichert » / « Fehler → Manuelle Eingabe ? »
- Pendant la fermeture : **désactiver** le bouton *Stop* et afficher un spinner « Beenden… » jusqu’à `onclose`.
- En cas d’échec de reconnexion (après 1 tentative) : proposer le **fallback Saisie manuelle**.


### Gestion des transcripts vides ou trop courts

**Critères de validation :**
- Si `transcript.text.length < 20` caractères → afficher un toast « Transcript trop court » (DE: *Zu kurz*).
- Proposer deux actions : **Réessayer** OU **Saisie manuelle**.
- **Ne pas** enregistrer dans `transcripts` si vide/insuffisant.
- **Ne pas** appeler Azure OpenAI tant qu’aucun transcript **valide** n’est disponible.

**Code exemple (validation serveur) :**
```ts
// À placer juste avant l’insertion DB et l’appel LLM
if (!transcript || transcript.trim().length < 20) {
  return {
    error: 'TRANSCRIPT_TOO_SHORT',
    message: 'Zu kurz – bitte erneut aufnehmen ou manuell eingeben.'
  }
}
```

-### Bénéfices
- L’utilisateur n’est jamais bloqué : il a toujours une solution (réessayer ou saisir à la main).
- L’expérience est claire : il comprend ce qui se passe et peut agir.
- Pas besoin d’infrastructure complexe (pas de queue Redis/BullMQ) pour le MVP, mais la logique est prête à évoluer si la charge augmente.


---
-## 4) Sécurité & GDPR (MVP)

- **Hébergement EU** obligatoire : Supabase (EU), Clerk (EU), stockage et traitement en région européenne.
- **LLM en région EU** : utiliser Azure OpenAI (déploiement Europe) ou équivalent (ex. AWS Bedrock avec Claude, Vertex AI EU) afin de garantir qu’aucune donnée patient ne quitte l’UE.
- **Aucun fichier audio stocké au MVP (streaming)** ; seul le transcript est conservé.
- **Buckets privés** : tous les transcripts et notes sont stockés en privé, jamais en public.
- **Consentement patient** : prévoir une étape d’information et consentement avant l’enregistrement (phase suivante : bannière ou checkbox).
- **Logs** : ne jamais logguer le contenu patient (seulement les IDs, erreurs techniques anonymisées).

### Sécurité additionnelle (MVP)

**CORS (WebSocket & API) :**
- Origines autorisées : `https://<ton-domaine>.vercel.app` (production) + `http://localhost:3000` (dev).
- Rejeter toutes les autres origines.

**Rate limiting (MVP simple) :**
- Max **3 visites/heure** par utilisateur (côté serveur via Clerk `userId`).
- Max **3 connexions WebSocket simultanées** par utilisateur.
- Si dépassé → **HTTP 429** avec message « Zu viele Anfragen – bitte warten ».

**Validation payload :**
- Taille max **chunk audio** : **1 MB/chunk** (rejeter si plus grand).
- Durée max visite : **15 min (900 s)** → fermeture automatique après.
- Longueur max **saisie manuelle** : **10 000 caractères**.

**Code exemple (middleware Next.js) :**
```ts
// middleware.ts
import { ratelimit } from '@/lib/ratelimit' // ex: upstash/redis
import { auth } from '@clerk/nextjs'
import { NextRequest, NextResponse } from 'next/server'

export async function middleware(req: NextRequest) {
  const { userId } = auth()
  if (!userId) return NextResponse.redirect(new URL('/sign-in', req.url))
  
  const { success } = await ratelimit.limit(userId)
  if (!success) return new Response('Too Many Requests', { status: 429 })
  
  return NextResponse.next()
}
```

### Azure OpenAI EU — Intégration & Garde-fous (MVP)
- **Endpoint unique (EU)** : `AZURE_OPENAI_ENDPOINT` pointe vers la ressource Azure en Europe ; `AZURE_OPENAI_REGION` ∈ {westeurope, northeurope, francecentral, germanywestcentral, swedencentral, norwayeast, switzerlandnorth, polandcentral}. L’application **refuse de démarrer** si la région n’est pas UE.
- **Pas de fallback** : **un seul module serveur** centralise tous les appels LLM ; interdiction d’utiliser l’API OpenAI standard ailleurs.
- **Serveur uniquement** : appels LLM exclusivement via **routes API/Server Actions** ; **jamais** depuis le navigateur ; clés **non exposées** au client.
- **Déploiement explicite** : usage du **nom de déploiement Azure** (ex. `gpt-4o-mini-eu`) et `response_format: json_object` ; **validation JSON** côté serveur (Zod).
- **Logs minimaux** : journaliser seulement des métadonnées techniques (durée, modèle, statut) — **jamais** de contenu patient.
- **Vérifs CI** : contrôle automatique qu’aucun `import 'openai'` n’est utilisé hors du module dédié.

### Variables d'environnement — Azure OpenAI EU (MVP)
```env
AZURE_OPENAI_ENDPOINT=https://<resource-name>.openai.azure.com
AZURE_OPENAI_API_KEY=***
AZURE_OPENAI_REGION=germanywestcentral   # ex: westeurope | francecentral | northeurope | switzerlandnorth ...
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini-eu   # nom du déploiement Azure, pas le nom générique du modèle
AZURE_OPENAI_API_VERSION=2024-02-01
LLM_MAX_OUTPUT_TOKENS=1024
```
> Remarque : ces variables sont **serveur uniquement** (jamais côté client). Le code **échoue au démarrage** si `AZURE_OPENAI_REGION` n’est pas une région UE autorisée.

### Bénéfices
- Réduit le risque légal lié au GDPR.
- Augmente la confiance utilisateur (kinés + patients).
- Prépare le terrain pour une certification future (CE médical, etc.).
- Garantit que le traitement IA (LLM) reste conforme RGPD dès le MVP clinique.

---

## 5) Modèle de données (Supabase)

### 5.1 Vue d’ensemble (simple)
Objectif : garantir des liens clairs **PT → Patients → Visits → Transcripts → Notes**, la propriété des données par le kiné, et la compatibilité avec **Clerk** (pas Supabase Auth).

### 5.2 Schéma lisible (tables & champs)
- **profiles** — profil du kiné (liaison avec Clerk)
  - `id` (UUID, PK)
  - `clerk_user_id` (TEXT, unique) — l’ID utilisateur venant de Clerk
  - `email` (TEXT), `full_name` (TEXT)
  - `created_at` (TIMESTAMPTZ)

- **patients** — patients du kiné
  - `id` (UUID, PK)
  - `owner_id` (UUID → profiles.id)
  - `first_name` (TEXT), `last_name` (TEXT)
  - `created_at`, `updated_at`

- **visits** — visites par patient
  - `id` (UUID, PK)
  - `patient_id` (UUID → patients.id)
  - `provider_id` (UUID → profiles.id)
  - `status` (TEXT : `draft|recording|processing|completed|failed`)
  - `language_pref` (TEXT : `de|fr|auto`, défaut `de`)
  - `started_at`, `ended_at`, `created_at`, `updated_at`

- **transcripts** — texte issu de Deepgram
  - `id` (UUID, PK)
  - `visit_id` (UUID → visits.id)
  - `text` (TEXT), `raw_json` (JSONB)
  - `language` (TEXT), `confidence` (NUMERIC)
  - `created_at`
  - Pas de versioning au MVP : une seule note active par visite, autosave + champ `is_final`.

- **notes** — note SOAP
  - `id` (UUID, PK)
  - `visit_id` (UUID → visits.id)
  - `soap` (JSONB : {subjective, objective, assessment, plan})
  - `model` (TEXT) — ex. `openai:gpt-4o-mini`
  - `version` (INT, défaut 1), `is_final` (BOOL, défaut false)
  - `created_at`

### 5.3 SQL (MVP)
> À exécuter dans Supabase (projet en **région EU**). Utilise `gen_random_uuid()` (extension `pgcrypto`).
```sql
create extension if not exists pgcrypto;

-- 1) PROFILS (liaison Clerk)
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text unique not null,
  email text,
  full_name text,
  created_at timestamptz default now()
);

-- 2) PATIENTS
create table if not exists patients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_patients_owner on patients(owner_id);

-- 3) VISITS
create table if not exists visits (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  provider_id uuid not null references profiles(id) on delete cascade,
  status text not null check (status in ('draft','recording','processing','completed','failed')) default 'draft',
  language_pref text not null check (language_pref in ('de','fr','auto')) default 'de',
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_visits_patient on visits(patient_id);
create index if not exists idx_visits_provider on visits(provider_id);

-- 4) TRANSCRIPTS
create table if not exists transcripts (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  text text,
  raw_json jsonb,
  language text,
  confidence numeric,
  created_at timestamptz default now()
);
create index if not exists idx_transcripts_visit on transcripts(visit_id);

-- 5) NOTES (SOAP)
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  soap jsonb not null,
  model text,
  version int default 1,
  is_final boolean default false,
  created_at timestamptz default now()
);
create index if not exists idx_notes_visit on notes(visit_id);

-- 6) Triggers updated_at
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end; $$ language plpgsql;

drop trigger if exists set_patients_updated_at on patients;
create trigger set_patients_updated_at before update on patients
for each row execute procedure set_updated_at();

drop trigger if exists set_visits_updated_at on visits;
create trigger set_visits_updated_at before update on visits
for each row execute procedure set_updated_at();

-- 6) USAGE METRICS (coûts par visite)
create table if not exists usage_metrics (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  -- STT
  stt_seconds integer not null default 0,
  stt_cost_cents integer not null default 0,
  -- LLM
  llm_tokens_in integer not null default 0,
  llm_tokens_out integer not null default 0,
  llm_cost_cents integer not null default 0,
  -- Total (généré = stt + llm)
  total_cost_cents integer generated always as
    (coalesce(stt_cost_cents,0) + coalesce(llm_cost_cents,0)) stored,
  -- Traces utiles
  stt_model text,          -- ex: deepgram:nova-3
  llm_model text,          -- ex: azure:gpt-4o-mini-eu
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_usage_metrics_visit on usage_metrics(visit_id);
create index if not exists idx_usage_metrics_created on usage_metrics(created_at);

-- Vue mensuelle simple (montants en EUR)
create or replace view monthly_usage as
select
  date_trunc('month', created_at) as month,
  count(distinct visit_id) as visits,
  sum(stt_seconds) as total_stt_seconds,
  sum(total_cost_cents)/100.0 as total_cost_eur
from usage_metrics
group by 1;

-- Trigger updated_at pour usage_metrics (réutilise set_updated_at)
drop trigger if exists trg_usage_metrics_updated_at on usage_metrics;
create trigger trg_usage_metrics_updated_at
before update on usage_metrics
for each row execute procedure set_updated_at();
```

### 5.4 RLS (Phase 1.5 — après liaison Clerk↔Supabase JWT)
> Pour le MVP, on peut sécuriser **côté serveur** (service role) et **activer RLS après**. Voici un exemple **indicatif** si vous propagez l’ID Clerk dans le JWT (`sub`).
```sql
-- Activer RLS
alter table patients enable row level security;
alter table visits enable row level security;
alter table transcripts enable row level security;
alter table notes enable row level security;

-- Helper: récupérer le sub du JWT (Clerk user id)
-- select current_setting('request.jwt.claims', true)::jsonb->>'sub';

-- Policy: un utilisateur ne voit que ses patients
create policy pt_own_patients on patients
for select using (
  exists (
    select 1 from profiles p
    where p.id = patients.owner_id
      and p.clerk_user_id = (current_setting('request.jwt.claims', true)::jsonb->>'sub')
  )
);

-- Même logique pour visits
create policy pt_own_visits on visits
for select using (
  exists (
    select 1 from patients pa join profiles pr on pr.id = pa.owner_id
    where pa.id = visits.patient_id
      and pr.clerk_user_id = (current_setting('request.jwt.claims', true)::jsonb->>'sub')
  )
);

-- Idem pour transcripts, notes (via la jointure sur visits → patients → profiles)
```

**⚠️ Important** : Ces policies supposent que votre API transmet un JWT contenant `sub = clerk_user_id`. Tant que ce n’est pas en place, **gardez RLS désactivé** et appliquez des **vérifications d’ownership côté serveur** (via Clerk `userId`).

### 5.5 Index & perfs
- Index sur **toutes les FK** (`owner_id`, `patient_id`, `provider_id`, `visit_id`).
- `created_at`/`updated_at` : utilisables pour l’ordre d’affichage et la purge.

### 5.6 Check-list « À créer dans Supabase »
- [ ] Créer le **projet Supabase** en **région EU**.
- [ ] Exécuter le **SQL** de la section 5.3.
- [ ] (Optionnel P1.5) Activer **RLS** + Policies quand le **JWT Clerk** (claim `sub`) est en place.
- [ ] Ajouter des **vérifications d’ownership** dans **toutes les routes API** (Clerk `userId` ↔ `profiles.clerk_user_id`).


### 5.7 Synchronisation Clerk ↔ Supabase (MVP)
- **Alternative plus simple (recommandée)** : **Webhook Clerk → Supabase Edge Function** pour la **sync automatique** des utilisateurs vers la table `profiles`.
- **Événements** : `user.created`, `user.updated`, `user.deleted`.
- **Action** : **UPSERT** `profiles (clerk_user_id, email, full_name)` ; sur `user.deleted` → **soft delete** via `profiles.deleted_at` (si présent).
- **Sécurité** : vérification **Svix** de la signature webhook ; utiliser la **Service Role Key** dans l’Edge Function (jamais dans le middleware/client).
- **Bénéfices** : idempotent, pas de latence à chaque requête, surface d’attaque réduite.
- **Option fallback** : à défaut, *lazy create* lors de la **première action serveur authentifiée** (UPSERT si absent).

---

### URL & Configuration
- **Function name** : `clerk-sync`  
- **URL à configurer dans Clerk → Webhooks** :  
  `https://<PROJECT>.supabase.co/functions/v1/clerk-sync`
- **Événements à écouter** : `user.created`, `user.updated`, `user.deleted`

### Secrets requis (Supabase)
- `CLERK_WEBHOOK_SECRET` — clé de signature générée par Clerk.  
- `SUPABASE_SERVICE_ROLE_KEY` — clé Service Role (jamais côté client).  
- `SUPABASE_URL` — déjà configurée dans le projet Supabase.

### Exemple d’Edge Function
```ts
// supabase/functions/clerk-sync/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { Webhook } from 'https://esm.sh/svix@1.4.9'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

serve(async (req) => {
  const payload = await req.text()
  const headers = Object.fromEntries(req.headers)
  
  // Vérification Svix
  const wh = new Webhook(Deno.env.get('CLERK_WEBHOOK_SECRET')!)
  const evt = wh.verify(payload, headers)
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  
  if (evt.type === 'user.created' || evt.type === 'user.updated') {
    await supabase.from('profiles').upsert({
      clerk_user_id: evt.data.id,
      email: evt.data.email_addresses[0]?.email_address,
      full_name: `${evt.data.first_name} ${evt.data.last_name}`.trim()
    }, { onConflict: 'clerk_user_id' })
  }

  if (evt.type === 'user.deleted') {
    await supabase.from('profiles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('clerk_user_id', evt.data.id)
  }
  
  return new Response('ok', { status: 200 })
})
```

### Fallback “lazy create” (dans les routes serveur)
```ts
// Exemple à inclure dans les routes API protégées
const clerkUserId = auth().userId
const profile = await db.select('profiles').eq('clerk_user_id', clerkUserId).single()

if (!profile) {
  await db.from('profiles').upsert({
    clerk_user_id: clerkUserId,
    email: user.primaryEmailAddress?.emailAddress ?? null,
    full_name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()
  }, { onConflict: 'clerk_user_id' })
}
```

> ✅ Cette implémentation assure la synchronisation fiable entre Clerk et Supabase (création, mise à jour, suppression d’utilisateurs) avec vérification Svix, idempotence, et fallback automatique si le webhook échoue.


# 

---

## 6) Stratégie coûts & routing IA (MVP)


### 6.1 Décision MVP : un seul modèle STT & un seul modèle LLM

- **STT** : utiliser **un seul modèle** Deepgram `nova-3` pour **toutes** les dictées (DE par défaut).
- **LLM** : utiliser **un seul modèle** OpenAI via Azure, avec le déploiement `gpt-4o-mini-eu`, pour **toutes** les générations SOAP **détaillées**.


### 6.2 Principes de base (MVP)
- **Modèle unique** : `nova-3` (STT) et `gpt-4o-mini-eu` (LLM) pour toutes les visites.
- **Limiter le contexte** : ne pas envoyer plus de texte que nécessaire (transcript nettoyé).
- **Idempotence** : si le transcript n'a pas changé, ne pas regénérer la SOAP (hash de contenu).
- **Hard caps** : plafond tokens (1024) pour éviter les dérapages.

### 6.3 Garde‑fous coûts
- **Max tokens** : plafonner les tokens de sortie (ex. 700–900 mots) et imposer la **sortie JSON stricte** pour éviter le bavardage.
- **Nettoyage** : retirer les hésitations, doublons, métadonnées du transcript avant d’appeler le LLM.
- **Pas de régénération inutile** : regénérer **uniquement** si le transcript/texte **a changé** (hash du contenu en base).
- **Aperçu de coût** (facultatif) : afficher “coût estimé” avant génération.


### 6.4 Paramètres (ENV) proposés
> Configuration unifiée de l’environnement (Azure OpenAI EU + Deepgram Streaming), avec valeurs indicatives de tarifs 2025.
```env
# Azure OpenAI (EU uniquement)
AZURE_OPENAI_ENDPOINT=https://<resource>.openai.azure.com
AZURE_OPENAI_API_KEY=***
AZURE_OPENAI_REGION=germanywestcentral   # ex: westeurope | francecentral | northeurope | switzerlandnorth ...
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini-eu  # nom de déploiement Azure (pas le nom générique)
AZURE_OPENAI_API_VERSION=2024-02-01
LLM_MAX_OUTPUT_TOKENS=1024

# Deepgram STT (Streaming)
DEEPGRAM_API_KEY=***
DEEPGRAM_MODEL=nova-3
DEEPGRAM_LANGUAGE=de
STT_MAX_DURATION_SEC=900

# WebSocket (Streaming)
WS_TIMEOUT_MS=30000
WS_HEARTBEAT_INTERVAL_MS=10000

# Coûts (centimes EUR, valeurs indicatives 2025)
# Deepgram Nova-3 (pay-as-you-go, centimes EUR/seconde)
STT_RATE_CENTS_PER_SEC=0.16   # ~$0.0043/sec × 1.1 (taux EUR/USD) × 100 = 0.47 centimes

# Azure OpenAI gpt-4o-mini (centimes EUR/1K tokens)
LLM_IN_CENTS_PER_1K=0.013     # ~$0.00015/1K × 1.1 × 100 = 0.0165 centimes
LLM_OUT_CENTS_PER_1K=0.052    # ~$0.00060/1K × 1.1 × 100 = 0.066 centimes

# Tarifs à vérifier sur :
# - Deepgram : https://deepgram.com/pricing
# - Azure OpenAI : https://azure.microsoft.com/pricing/details/cognitive-services/openai-service/
```
> Les montants sont renseignés dans l’environnement (pas dans le code). Le total est calculé côté base (`total_cost_cents`).

### 6.5 Table métriques (optionnelle)
Pour suivre tes coûts à posteriori (estimation), ajouter une petite table :
```
usage_metrics( id, visit_id, stt_seconds, llm_chars_in, llm_model, est_cost_usd, created_at )
```
- Alimentée après chaque visite (approximation), elle t’aide à ajuster les seuils.


### 6.6 Check‑list “à faire”
- [ ] Implémenter la **détection de durée** (STT) et la **détection de complexité** (LLM) basées sur la longueur/structure.
- [ ] Ajouter un **plafond de tokens** et la **sortie JSON stricte** côté LLM.
- [ ] Éviter la régénération si **hash d’entrée inchangé**.
- [ ] (Optionnel) Enregistrer une **métrique d’usage** par visite.

---

## 7) Prompt Engineering (MVP)

### 7.1 Objectif
Assurer des notes SOAP **structurées, détaillées et fiables** en **allemand**, minimiser les hallucinations, et garder des sorties **JSON strictes** faciles à enregistrer et à copier.

### 7.2 Principes
- **Règles explicites** : langue DE, pas d’invention → utiliser **"N/A"** si information absente.
- **Structure imposée** : JSON strict `{subjective, objective, assessment, plan}`.
- **Unité & métriques** : ROM en **degrés** (°), force **0–5**, échelles (NRS/VAS 0–10), fréquence/volume du plan.
- **Style** : ton clinique, phrases courtes, **Stichpunkte** quand pertinent.
- **Longueur** : garder la sortie ≤ ~900 mots (plafond tokens en ENV).

### 7.3 Prompts — DE — système & utilisateur

```ts
export const SOAP_SYSTEM_DE = `
Du bist ein klinischer Assistent für Physiotherapie auf Deutsch.
Erzeuge eine **detaillierte SOAP-Notiz** aus Transkript oder Freitext.

REGELN:
- **Sprache**: Deutsch.
- **Nichts erfinden**: Fehlende Information = "N/A".
- **Struktur & Format**: Ausgabe ausschließlich als JSON {subjective, objective, assessment, plan}.
- **Stil**: klinisch, präzise, kurze Sätze, Stichpunkte erlaubt.
- **Ziele**: nach Möglichkeit SMART (konkret, messbar, terminierbar).

ANFORDERUNGEN:
- SUBJEKTIV: Hauptbeschwerden, Schmerzskala (NRS/VAS 0–10), Verlauf, Red Flags (falls erwähnt).
- OBJEKTIV: Messwerte (ROM in Grad °), Kraftgrade (0–5), relevante Tests (z. B. Lasègue, Hawkins-Kennedy), Beobachtungen.
- ASSESSMENT: Klinische Einschätzung, Hypothesen, Irritabilität (niedrig/mittel/hoch), Fortschritt seit letzter Sitzung (falls vorhanden).
- PLAN: Interventionen (mit Dosierung/Frequenz), HEP, Ziele nach SMART, nächste Schritte/Termine.
`;
```

```ts
// Le template utilisateur s’insère dynamiquement avec le transcript ou le texte saisi.
export const SOAP_USER_TEMPLATE_DE = ({
  rawText,
  detail = 'detailed',
  bodyRegion
}: { rawText: string; detail?: 'concise'|'detailed'; bodyRegion?: string }) => `
KONTEXT:
- Detailtiefe: ${detail === 'detailed' ? 'hoch (bitte Messwerte/Tests/Scores aufnehmen)' : 'mittel (nur Kernaussagen)'}
${bodyRegion ? `- Fokusregion: ${bodyRegion}` : ''}

TRANSKRIPTION/NOTIZEN:
"""
${rawText}
"""

HINWEIS:
- System-Regeln gelten (Deutsch, nichts erfinden → "N/A", Ausgabe nur JSON).
`;
```

> Variante FR (future i18n) : cloner ces deux prompts en version française et basculer via `language_pref`.

### 7.4 Schéma de sortie (validation)
Utiliser un schéma pour forcer le JSON (ex. Zod) et rejeter toute sortie invalide.

```ts
import { z } from 'zod';
export const SoapSchema = z.object({
  subjective: z.string(),
  objective: z.string(),
  assessment: z.string(),
  plan: z.string(),
});
```

### 7.5 Bonnes pratiques (résumé)
- **Toujours** rappeler: "rien inventer → N/A".
- **Nettoyer** le transcript en amont (enlever hésitations, métadonnées, doublons).
- **Limiter** la longueur d’entrée (découper/ou résumer si besoin) et **plafonner** la sortie (ENV tokens).
- **Post‑validation**: si un champ est vide ou invalide, regénérer uniquement ce champ (ou demander saisie manuelle).
- **Traçabilité**: stocker `model` et `version` dans `notes`.


### 7.6 Check‑list d’intégration
- [ ] Mettre `SOAP_SYSTEM_DE` côté serveur et utiliser `SOAP_USER_TEMPLATE_DE` avec `rawText` (transcript ou saisie).
- [ ] Passer `language_pref` de la visite (par défaut `de`).
- [ ] Valider la réponse avec `SoapSchema` et bloquer toute sortie non‑JSON.
- [ ] Ajouter un **bouton Regénérer** (si nécessaire) et **Saisie manuelle** en fallback.
- [ ] Enregistrer dans `notes(model, version)` le modèle utilisé et incrémenter `version` à chaque regénération.

---

## 8) UX Flow (MVP)

### 8.1 User Flow principal (Mermaid)
```mermaid
graph TD
    A[Login (Clerk, DE)] --> B{Patient existant ?}
    B -->|Non| C[Créer Patient (Nom/Prénom)]
    B -->|Oui| D[Sélectionner Patient] 
    C --> D
    D --> E[Nouvelle Visite]
    E --> F{Mode de saisie?}
    F -->|Audio| G[Enregistrer (streaming temps réel)]
    F -->|Texte| H[Saisir manuellement]
    G --> I[Transcription live (WS Deepgram, retry 3x)]
    H --> J[Générer SOAP (Azure OpenAI EU, retry 3x)]
    I --> J
    J --> K[Réviser/Éditer (autosave, version)]
    K --> L[Sauvegarder (is_final ?)]
    L --> M[Copier (formaté, toast)]
    I -->|échec répété| H
    J -->|échec répété| H
```


### 8.2 Détails UX clés
- **Pas de choix de langue** : tout est en allemand par défaut (multilingue viendra plus tard).
- **Pas de consentement UI** : le consentement patient est oral (MVP clinique réel).
- **Mode de saisie** : le kiné choisit soit l’audio, soit le texte manuel.
- **Fallback** : en cas d’échec répété de la transcription ou de la génération SOAP, on propose la saisie manuelle.
- **Toasts** (notifications légères, temporaires) :
  - « Transkription läuft… Versuch 2/3 »
  - « Audio gelöscht (GDPR ok) »
  - « SOAP generiert »
  - « Fehler → Manuelle Eingabe ? »

---

## 9) Monitoring & Analytics (MVP)

### 9.1 Analytics (Posthog/Mixpanel)
```ts
const analytics = {
  trackVisitFlow: (step: string, metadata: any) => {
    posthog.capture('visit_flow', {
      step,
      duration: metadata.duration,
      method: metadata.method,
      success: metadata.success
    })
  },
  
  trackPerformance: () => {
    // Temps de transcription
    // Temps de génération SOAP
    // Taux d'édition
    // Erreurs par étape
  }
}
```

### 9.2 Monitoring (Sentry)
```ts
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  profilesSampleRate: 0.1
})
```