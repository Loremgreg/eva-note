"use client";

import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { FileText, Mic, Users } from "lucide-react";

const dashboardSections = [
  {
    title: "Patients",
    description:
      "Gestion des fiches patients (prénom, nom) et accès rapide aux visites actives.",
    icon: Users,
    status: "À implémenter",
  },
  {
    title: "Transcription live",
    description:
      "Streaming Deepgram (Nova-3 DE), suppression audio immédiate après traitement.",
    icon: Mic,
    status: "Conception en cours",
  },
  {
    title: "Note SOAP",
    description:
      "Génération Azure OpenAI (gpt-4o-mini), validation JSON stricte et édition manuelle.",
    icon: FileText,
    status: "Design du flux",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-muted/40 pb-16">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <span className="text-lg font-semibold">E</span>
            </div>
            <div>
              <p className="text-lg font-semibold leading-tight">EVA Note</p>
              <p className="text-sm text-muted-foreground">
                Documentation kiné en temps réel (MVP)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <SignedOut>
              <SignInButton>
                <Button size="sm">Se connecter</Button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>
        </div>
      </header>

      <main className="mx-auto mt-12 grid max-w-6xl gap-10 px-4">
        <section className="grid gap-6">
          <h1 className="text-3xl font-bold">Tableau de bord produit</h1>
          <p className="max-w-2xl text-muted-foreground">
            Cette page remplace le contenu CodeGuide et servira de base aux
            écrans patients, visites et note SOAP. Les cartes ci-dessous
            récapitulent les blocs essentiels du MVP à construire.
          </p>
        </section>

        <SignedIn>
          <section className="grid gap-6">
            <h2 className="text-xl font-semibold">Chantiers MVP</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {dashboardSections.map(({ title, description, icon: Icon, status }) => (
                <Card key={title}>
                  <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <CardTitle>{title}</CardTitle>
                    </div>
                    <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                      {status}
                    </span>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{description}</CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        </SignedIn>

        <SignedOut>
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>Connexion requise</CardTitle>
              <CardDescription>
                Authentifiez-vous avec Clerk pour accéder au tableau de bord EVA
                Note et préparer les flux patients / visites.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SignInButton>
                <Button>Ouvrir Clerk</Button>
              </SignInButton>
            </CardContent>
          </Card>
        </SignedOut>
      </main>
    </div>
  );
}
