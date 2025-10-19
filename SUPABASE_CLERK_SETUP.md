# Intégration Clerk + Supabase (EVA Note)

Ce guide résume la configuration nécessaire pour faire communiquer Clerk (authentification) et Supabase (données patients/visites/notes) dans le contexte EVA Note.

## Prérequis

- Projet Clerk configuré en région EU.
- Projet Supabase (région EU) avec Row Level Security activé.
- Next.js 15 avec `@clerk/nextjs` et `@supabase/supabase-js`.

## Étapes de configuration

### 1. Activer l’auth tierce côté Supabase
1. Supabase Dashboard → **Authentication > Integrations**.
2. Ajouter **Third-party auth** et choisir **Clerk**.
3. Copier les valeurs demandées (Project URL, JWT templates).

### 2. Configurer Clerk pour Supabase
1. Clerk Dashboard → **Connect > Supabase**.
2. Suivre l’assistant pour exposer l’ID utilisateur dans `auth.jwt() ->> 'sub'`.
3. Ajouter l’URL Supabase dans les allowlists Clerk si nécessaire.

### 3. Variables d’environnement

```
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

### 4. Clients Supabase

- **Côté serveur** : `createSupabaseServerClient()` (`src/lib/supabase.ts`) ajoute automatiquement le token Clerk dans les headers.
- **Côté client** : utiliser `supabase` exporté + `useAuth().getToken()` puis `.auth(token)` pour les opérations interactives.

### 5. Migrations à créer

Les tables de démonstration ont été supprimées. Créez des migrations adaptées au MVP :

- `patients` : `id`, `clerk_user_id`, `first_name`, `last_name`, timestamps.
- `visits` : lien patient, état (`draft`, `recording`, `transcribing`, `ready`...), timestamps.
- `visit_audio` : stockage metadata audio (clé storage privée, date purge).
- `transcripts` : texte + référence Deepgram + horodatage.
- `notes` : contenu SOAP (JSONB), `version`, `model`, `updated_by`.

Activer RLS sur chaque table et créer des policies du type :

```sql
create policy "Users manage their patients" on public.patients
  for all using (auth.jwt() ->> 'sub' = clerk_user_id)
  with check (auth.jwt() ->> 'sub' = clerk_user_id);
```

### 6. Tests rapides

1. Lancer l’app (`npm run dev`).
2. Se connecter via Clerk.
3. Depuis une action serveur, requêter Supabase (ex. `await supabase.from('patients').select('*')`).
4. Vérifier dans les logs Supabase que le JWT contient bien l’ID Clerk et que les policies passent.

## Tips & bonnes pratiques

- Utiliser le **Service Role Key** uniquement côté serveur (API routes / server actions) pour tâches d’arrière-plan (purge audio, recalculs).
- En dev, penser à révoquer les tokens Clerk lorsqu’on change de projet Supabase.
- Journaliser `auth.userId` côté serveur pour déboguer les policies.
- Documenter chaque migration dans le PRD pour garder le modèle en phase avec la roadmap.
