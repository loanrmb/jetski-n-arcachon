# PRD.md — Jetski Arcachon CRM

## Vision

Système de gestion centralisé pour la location de jet ski sur le Bassin d'Arcachon.
Le CRM gère l'intégralité du cycle de vie d'une réservation (en ligne + physique + téléphone),
synchronise les disponibilités en temps réel avec le site public, et fournit des tableaux de bord
analytiques pour piloter l'activité saison.

---

## Stack technique

| Couche | Technologie |
|---|---|
| Frontend + API | Next.js 14 (App Router, TypeScript) |
| Base de données | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Emails | Resend (notifications client + équipe) |
| Hébergement | Vercel (déploiement auto via GitHub) |
| Versioning | GitHub |

---

## Contexte métier

- **Activité** : Location de jet ski, saison mai–septembre, 7h–20h
- **Localisation** : Jetée Thiers, Port d'Arcachon, 33120
- **Flotte** :
  - Sea-Doo GTI SE 130 — 110 €/h (Débutant)
  - Sea-Doo GTX 230 — 125 €/h (Intermédiaire)
  - Sea-Doo RXT-X 300 — 140 €/h (Expert)
- **Créneaux horaires** : 09h00 · 11h00 · 14h00 · 16h00
- **Durées** : 1h / 2h / Demi-journée (4h)
- **Caution** : 2 000 € (suivi informatif uniquement, pas de paiement en ligne)
- **Carburant** : en sus (suivi note uniquement)

---

## Utilisateurs du CRM

| Rôle | Accès |
|---|---|
| **Staff** (directeur + employés) | Accès complet à toutes les fonctionnalités |
| **Admin** (dev) | Accès complet + configuration système |

Authentification par email/mot de passe via Supabase Auth.
Pas de séparation de droits entre directeur et employé pour cette version.

---

## Modules

### 1. Dashboard principal

Vue d'ensemble de la journée en cours :

- Nombre de réservations du jour (par statut)
- Jet skis disponibles / occupés en ce moment
- Prochain créneau libre par modèle
- Alertes : réservations "En attente" non traitées depuis +2h
- Accès rapide : bouton "Nouvelle réservation manuelle"

---

### 2. Calendrier des réservations (vue principale)

Style **Google Agenda** — vue centrale du CRM.

**Vues disponibles :**
- Jour
- Semaine
- Mois

**Affichage :**
- Une couleur par jet ski (GTI = bleu / GTX = vert / RXT-X = rouge)
- Chaque créneau affiche : nom client, modèle, durée, statut
- Clic sur un créneau → fiche réservation complète

**Interactions :**
- Glisser-déposer pour déplacer une réservation (si le créneau cible est libre)
- Clic sur créneau vide → formulaire "Nouvelle réservation manuelle"
- Blocage de créneaux (entretien, météo, indisponibilité)

---

### 3. Réservations

#### Statuts et flux

```
En attente → Confirmée → En cours → Terminée
                  ↓
               Annulée
                  ↓
               No-show
```

| Statut | Déclencheur |
|---|---|
| **En attente** | Demande reçue depuis le site (automatique) |
| **Confirmée** | Validation manuelle par le staff dans le CRM |
| **En cours** | Passage manuel au départ du client (ou automatique à l'heure du créneau) |
| **Terminée** | Passage manuel au retour du client |
| **Annulée** | Action staff ou client |
| **No-show** | Client ne s'est pas présenté |

#### Fiche réservation

Champs :
- Nom / Prénom client
- Téléphone
- Email
- Modèle de jet ski
- Date + créneau horaire
- Durée (1h / 2h / 4h)
- Nombre de personnes (max 3)
- Permis côtier : Oui / Non / Non vérifié
- Message client (optionnel)
- Note interne staff (non visible client)
- Statut
- Source : `En ligne` | `Téléphone` | `Sur place`
- Caution encaissée : Oui / Non
- Carburant (litres consommés, note libre)
- Historique des modifications (qui a fait quoi, quand)

#### Réservations manuelles

Formulaire rapide accessible depuis le calendrier ou le dashboard.
Même champs que ci-dessus, source = `Téléphone` ou `Sur place`.

---

### 4. Gestion de la flotte

Par modèle de jet ski :

- Nom, photo, caractéristiques (puissance, vitesse, capacité)
- Tarifs par durée (modifiables)
- Statut général : `Actif` | `En maintenance` | `Hors service`
- Historique des maintenances
- Blocage de créneaux spécifiques (météo, entretien ponctuel)

---

### 5. Disponibilités

- Vue calendrier des disponibilités par modèle
- Blocage manuel d'une plage (date + créneau ou journée entière)
- **Synchronisation automatique avec le site public** via API Supabase :
  - Quand une réservation est confirmée → le créneau disparaît du site
  - Quand une réservation est annulée → le créneau redevient disponible
  - Les blocages manuels sont aussi reflétés sur le site

---

### 6. Notifications email (Resend)

#### Côté client

| Événement | Email envoyé |
|---|---|
| Demande reçue | "Nous avons bien reçu votre demande, confirmation sous 2h" |
| Réservation confirmée | "Votre réservation est confirmée — détails + adresse + ce qu'il faut apporter" |
| Rappel J-1 | "Votre sortie est demain à [heure]" |
| Annulation | "Votre réservation a été annulée" |

#### Côté staff

| Événement | Notification |
|---|---|
| Nouvelle demande en ligne | Email + badge dans le CRM |
| Réservation annulée par client | Email |

---

### 7. Analytics & Statistiques

**Sélecteur de période** : date de début / date de fin (ou presets : aujourd'hui, semaine, mois, saison).

Métriques disponibles :

- **CA total** sur la période (calcul automatique tarif × durée)
- **Nombre de réservations** par statut
- **Taux d'occupation** par modèle (% des créneaux utilisés)
- **Répartition des sources** (en ligne / téléphone / sur place)
- **Durée moyenne** des locations
- **Pic d'activité** par jour de la semaine / heure
- **Taux d'annulation** et **taux de no-show**
- **Modèle le plus loué**

Affichage : graphiques (barres, courbes, camembert) + tableau exportable CSV.

---

### 8. Clients (base simplifiée)

- Fiche client créée automatiquement à chaque nouvelle réservation
- Historique des réservations du client
- Dédoublonnage par email
- Recherche client (nom, email, téléphone)
- Note libre sur le profil

---

## Connexion site public ↔ CRM

Le site public `jetski-arcachon.vercel.app` et le CRM partagent la **même base Supabase**.

```
Site public                    CRM
    |                           |
    |── lit les dispos ────────>|  table: availabilities
    |── écrit les demandes ────>|  table: reservations (statut: "En attente")
    |                           |
    |<── sync auto (Realtime) ──|  Supabase Realtime
```

- Le site lit la table `availabilities` pour afficher les créneaux libres
- Les demandes du site créent une ligne dans `reservations` avec statut `En attente`
- Le CRM écoute en temps réel (Supabase Realtime) et affiche une alerte immédiate
- Toute action dans le CRM (confirmation, annulation, blocage) met à jour la table partagée
- Le site se met à jour automatiquement (pas de rechargement manuel nécessaire)

---

## Design & UX

- Interface en **français**
- Responsive : utilisable sur mobile (terrain) et desktop (bureau)
- Palette inspirée du site public (marine, blanc, accents orange)
- Composants : shadcn/ui + Tailwind CSS
- Calendrier : FullCalendar.io (React)
- Graphiques : Recharts

---

## Ce qui est hors scope (v1)

- Paiement en ligne (Stripe) → v2
- Application mobile native → v2
- Portail client (espace de connexion client) → v2
- Multi-site / multi-activité → v2
- Intégration comptable → v2

---

## Structure des fichiers du projet

```
jetski-crm/
├── CLAUDE.md                  # Instructions persistantes pour Claude Code
├── PRD.md                     # Ce fichier
├── app/
│   ├── (auth)/                # Login
│   ├── (crm)/
│   │   ├── dashboard/
│   │   ├── calendar/
│   │   ├── reservations/
│   │   ├── fleet/
│   │   ├── availability/
│   │   ├── clients/
│   │   └── analytics/
│   └── api/
│       ├── reservations/
│       ├── availability/
│       └── notifications/
├── components/
├── lib/
│   ├── supabase.ts
│   └── resend.ts
└── supabase/
    └── migrations/            # Schéma SQL versionné
```

---

## Schéma de base de données (grandes lignes)

```sql
-- Modèles de jet ski
jet_skis (id, name, model, power_hp, max_speed_kmh, capacity, price_1h, price_2h, price_4h, status, image_url)

-- Disponibilités (source de vérité partagée avec le site)
availabilities (id, jet_ski_id, date, slot_time, is_blocked, blocked_reason)

-- Réservations
reservations (id, jet_ski_id, client_id, date, slot_time, duration_hours, status, source, nb_persons, license_verified, internal_note, fuel_note, caution_collected, created_at, updated_at)

-- Clients
clients (id, first_name, last_name, email, phone, internal_note, created_at)

-- Historique des modifications
reservation_logs (id, reservation_id, changed_by, old_status, new_status, note, created_at)
```

---

## Prompt de démarrage Claude Code

```
Read PRD.md carefully. Build the Jetski Arcachon CRM step by step.

Start with:
1. Supabase schema (all migrations in /supabase/migrations/)
2. Authentication (Supabase Auth, single role)
3. Calendar view with FullCalendar showing reservations by jet ski
4. Reservation CRUD (create, read, update status, delete)
5. Auto-sync with the public site via shared Supabase tables

Stack: Next.js 14 App Router, TypeScript, Supabase, shadcn/ui, Tailwind, FullCalendar, Recharts, Resend.
Language: French UI.
Always check PRD.md before implementing a new feature.
```
