<!--
  ============================================================================
  SYNC IMPACT REPORT
  ============================================================================
  Version change: N/A (initial) → 1.0.0

  Modified principles: N/A (initial creation)

  Added sections:
    - Core Principles (10 principles covering vision through deployment)
    - Security Requirements (detailed E2EE, auth, encryption standards)
    - Multi-Tenant & Workspaces (isolation, RBAC, workspace types)
    - UX & Accessibility Standards (mobile-first, PWA, WCAG 2.1 AA)
    - Development Workflow (testing, CI, supply chain)
    - Governance (amendment process, compliance, versioning)

  Removed sections: N/A (initial creation)

  Templates requiring updates:
    - .specify/templates/plan-template.md: ✅ Compatible (Constitution Check section exists)
    - .specify/templates/spec-template.md: ✅ Compatible (requirements structure aligns)
    - .specify/templates/tasks-template.md: ✅ Compatible (phase structure supports security tasks)

  Follow-up TODOs: None
  ============================================================================
-->

# HubCompta Constitution

## Core Principles

### I. Produit Hub Central

HubCompta est un hub de comptabilité et patrimoine self-host (NAS/Docker) qui centralise :

- **Finances quotidiennes** : transactions, budgets, rapprochements bancaires
- **Documents** : capture, stockage, rattachement aux transactions
- **Mode Pro léger** : facturation simple, suivi clients pour TPE/PME
- **Suivi investissements** : tracking uniquement (jamais d'exécution d'ordres)

**Garde-fous NON-NÉGOCIABLES** :

- L'application NE DOIT PAS devenir un ERP complet (pas de stock/HR/production)
- L'application NE DOIT PAS devenir un broker (aucun achat/vente depuis l'app)
- L'application DOIT fonctionner 100% self-host sans dépendance cloud obligatoire

### II. Conception Modulaire

Chaque module DOIT pouvoir être activé/désactivé sans casser le reste :

| Module | Description | Dépendances |
|--------|-------------|-------------|
| Core Finance | Transactions, comptes, budgets | Aucune |
| Documents | Capture, stockage, OCR | Core Finance (rattachement) |
| Pro | Facturation, clients, TVA | Core Finance |
| Invest | Portefeuilles, valorisation | Core Finance, Market Data |
| Workspaces | Multi-tenant, RBAC | Core Finance |
| Market Data | Cours, taux FX | Aucune |
| Reporting | Rapports, exports | Dépend des modules activés |

**Règle** : Aucune fonctionnalité d'un module désactivé ne DOIT impacter le fonctionnement des modules actifs.

### III. Simplicité en Priorité

- Toute feature qui augmente la complexité sans gain net pour particulier/PME DOIT rester derrière un "mode avancé"
- Par défaut, l'interface DOIT être simple ; les options pro/expertes sont masquées
- YAGNI (You Aren't Gonna Need It) : ne pas implémenter de fonctionnalités hypothétiques

### IV. Sécurité Best-Possible (inspirée Password Managers)

#### 4.1 Principes Fondamentaux

- **Privacy by design** : aucune télémétrie invasive par défaut, aucune revente/partage de données, aucun tracking tiers
- **Zero-trust sur le Coffre** : les données ultra sensibles DOIVENT pouvoir être stockées en E2EE côté client (serveur incapable de déchiffrer)
- **Defense in depth** : TLS + auth forte + isolation multi-tenant + durcissement Docker/OS + sauvegardes chiffrées + audit

#### 4.2 Authentification & Sessions

| Exigence | Spécification |
|----------|---------------|
| MFA | OBLIGATOIRE (TOTP minimum) ; Passkeys/WebAuthn supportées en priorité |
| Lock (inactivité) | Configurable (défaut 10 min, options 5/15/30) |
| Logout automatique | Configurable (défaut 24h) + sur événements sensibles |
| Re-auth step-up | OBLIGATOIRE pour : exports complets, accès coffre E2EE, changement sécurité, gestion clés, gestion membres/workspaces |
| Gestion appareils | Liste des devices, révocation instantanée, sessions rotatives |

#### 4.3 Chiffrement & Clés

- **Transit** : TLS partout (reverse proxy) + HSTS + cookies Secure/HttpOnly/SameSite
- **Repos (recommandé)** : chiffrement disque (LUKS/équivalent) pour host/NAS
- **Repos (obligatoire)** : chiffrement applicatif pour secrets (tokens, clés, credentials)
- **KDF** : Argon2id avec paramètres explicites + évolutifs pour mot de passe maître
- **Envelope encryption** : DEK par workspace (et/ou par coffre), KEK séparée ; rotation possible
- **Zéro secret en clair** : aucune clé longue durée en DB ; secrets via Docker secrets / fichiers root-only / TPM/HSM (option)

#### 4.4 Sécurité Applicative

- **OWASP ASVS L2** comme baseline (L3 pour coffre/identités si possible)
- **Protection IDOR** : toute ressource est scoped par `workspace_id` + vérification autorisations
- **Principe du moindre privilège** : RBAC + permissions par domaine
- **Audit log** : actions sensibles journalisées (qui, quoi, quand, où, device)

### V. Multi-Utilisateurs & Workspaces

- Instance unique (NAS) DOIT supporter N utilisateurs
- Workspaces OBLIGATOIRES : un user peut appartenir à plusieurs workspaces

| Type Workspace | Description | Particularités |
|----------------|-------------|----------------|
| Personal | Finances personnelles | Isolation totale |
| Family | Budget familial | Dépenses communes, budgets partagés |
| Flatshare | Colocation | Settlement "qui doit quoi" |
| Company | Entreprise | Workflow validation comptable |

**Isolation stricte** : toutes les données sont scellées par `workspace_id` (multi-tenant) ; aucune fuite inter-workspace tolérée.

**RBAC standard** : Owner / Admin / Accountant / Member / Read-only, plus permissions fines par domaine (transactions, docs, rapports, exports, paramètres).

### VI. Exactitude Comptable & Confiance

- **Ledger-first** : le noyau transactionnel est la source de vérité ; analytics/graphes ne modifient JAMAIS l'historique
- **Traçabilité** : historique des modifications, états (pointé/rapproché), versionnement des imports
- **Multi-devises** : conversions cohérentes avec historique FX ; affichage clair des dates/taux utilisés
- **Investissements = tracking uniquement** : jamais d'exécution d'ordres ; uniquement enregistrement/import + valorisation via market data

### VII. UX Moderne, Mobile-First, NAS-Ready

- **PWA mobile-first** : utilisable parfaitement sur téléphone/tablette
- **Bouton "+" central** : transaction / reçu / facture / dépense coloc
- **Onboarding 5 minutes** : création compte → workspace → import de base → budgets → coffre
- **Vues rythmées** : Jour (inbox) / Mois (bilan) / Année (rapport)
- **Accessibilité** : WCAG 2.1 AA visée (contraste, navigation clavier, labels)

### VIII. Import, Documents, Automatisation

| Fonctionnalité | Priorité | Spécification |
|----------------|----------|---------------|
| Import CSV | Must-have | Détection séparateur, mapping, doublons |
| Import OFX/QIF | Should-have | Format bancaire standard |
| Règles & récurrences | Must-have | Explicables et réversibles |
| Capture documents | Must-have | Photo/PDF mobile + inbox + rattachement |
| OCR | Nice-to-have | Optionnel, local-first si possible |

**Règle** : Toute automatisation DOIT être explicable et réversible.

### IX. Performance & Fiabilité (cible NAS)

#### Performance

| Métrique | Cible |
|----------|-------|
| Réactivité UI | < 200ms perçues sur interactions courantes |
| API p95 | < 300ms (hors imports/OCR) |
| Jobs async | Imports, OCR, fetch market data, rapprochement en workers |
| Cache market data | Respect quotas providers ; rafraîchissement planifié + backoff |

#### Fiabilité

- **Backups chiffrés** : DB + fichiers (documents) + config
- **Restore testé** : procédure documentée + "backup/restore wizard" dans l'UI
- **Migrations versionnées** : aucune release sans migration safe + rollback plan
- **Crash-safe** : aucune corruption silencieuse ; transactions DB atomiques

### X. Déploiement Docker "1-Commande"

**docker-compose officiel** incluant :

- PostgreSQL (base de données)
- Redis (cache, sessions, jobs)
- API (backend)
- Worker (jobs async)
- Front (PWA)
- Storage (MinIO optionnel)
- Reverse proxy (Traefik/Caddy)

**Règles** :

- Secrets JAMAIS dans Git ; via Docker secrets / fichiers dédiés
- Volumes clairs, chemins configurables
- Permissions documentées pour NAS (Synology, QNAP, etc.)

## Security Requirements

*Cette section détaille les exigences de sécurité applicables à toute implémentation.*

### Authentification

1. MFA DOIT être activée pour tous les utilisateurs (TOTP minimum)
2. Passkeys/WebAuthn DOIVENT être supportées comme méthode prioritaire
3. Sessions DOIVENT avoir une durée maximale configurable (défaut 24h)
4. Lock automatique DOIT être configurable (défaut 10 min)

### Chiffrement

1. Toutes les communications DOIVENT utiliser TLS 1.2+
2. Les secrets applicatifs NE DOIVENT JAMAIS être stockés en clair
3. Argon2id DOIT être utilisé pour la dérivation des mots de passe maître
4. Le coffre E2EE DOIT être implémenté avec chiffrement côté client

### Contrôle d'Accès

1. Toute ressource DOIT être scoped par `workspace_id`
2. Chaque requête API DOIT vérifier les permissions de l'utilisateur
3. Les actions sensibles DOIVENT déclencher une re-authentification
4. Toutes les actions sensibles DOIVENT être journalisées

## Development Workflow

### Qualité du Code

- **Type-safety** : types stricts (TypeScript strict) + validation runtime (schémas Zod/Yup)
- **Linting** : ESLint + Prettier (front), Ruff/Black (Python si backend Python)

### Tests

| Type | Périmètre | Couverture cible |
|------|-----------|------------------|
| Unitaires | Règles, crypto utils, parsing import | > 80% |
| Intégration | Auth, RBAC, workspaces | > 80% |
| E2E | Parcours clés (login → workspace → import → budget → doc) | Parcours critiques |

### CI Obligatoire

Chaque PR DOIT passer :

1. Lint (ESLint, Prettier)
2. Tests unitaires et intégration
3. Build production
4. Scan dépendances (vulnérabilités)

### Supply Chain

- Dépendances minimales, versions pinnées
- SBOM généré automatiquement
- Images Docker reproductibles
- Scan vulnérabilités automatique

## Governance

### Amendement de la Constitution

1. Toute modification de la Constitution DOIT être documentée
2. Les changements majeurs (suppression/redéfinition de principes) DOIVENT être approuvés explicitement
3. Un plan de migration DOIT accompagner tout changement breaking

### Versionnement

La Constitution suit le Semantic Versioning :

- **MAJOR** : Changements incompatibles (suppression/redéfinition de principes)
- **MINOR** : Ajout de principes ou expansion significative
- **PATCH** : Clarifications, corrections de typos, raffinements

### Compliance

- Toutes les PRs DOIVENT vérifier la conformité avec cette Constitution
- Le "Constitution Check" dans plan-template.md DOIT être validé avant implémentation
- Toute complexité ajoutée DOIT être justifiée explicitement

### Review Périodique

La Constitution DEVRAIT être revue :

- À chaque release majeure
- Annuellement au minimum
- Suite à tout incident de sécurité

**Version**: 1.0.0 | **Ratified**: 2026-02-08 | **Last Amended**: 2026-02-08
