# Feature Specification: Finance Hub - Hub Financier Self-Host

**Feature Branch**: `001-finance-hub`
**Created**: 2026-02-08
**Status**: Draft
**Input**: User description: "Hub Financier Self-Host NAS/Docker - Gestion comptabilite, documents, budgets, facturation, investissements, multi-utilisateurs, securite password-manager"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Gestion des transactions quotidiennes (Priority: P1)

En tant que particulier, je veux enregistrer et categoriser mes depenses et revenus quotidiens afin de suivre mon budget et avoir une visibilite claire sur mes finances.

**Why this priority**: C'est la fonctionnalite coeur du produit. Sans gestion des transactions, aucun autre module n'a de sens. C'est le fondement du MVP.

**Independent Test**: Un utilisateur peut creer un compte, ajouter des transactions manuellement, les categoriser et visualiser un resume mensuel.

**Acceptance Scenarios**:

1. **Given** un utilisateur connecte sur son workspace personnel, **When** il clique sur le bouton "+" et saisit une depense (montant, categorie, description), **Then** la transaction est enregistree et visible dans la liste des transactions.
2. **Given** un utilisateur avec des transactions existantes, **When** il consulte la vue mensuelle, **Then** il voit un resume par categorie avec totaux et graphiques.
3. **Given** un utilisateur qui saisit une transaction, **When** il joint un justificatif (photo/PDF), **Then** le document est rattache a la transaction.
4. **Given** un utilisateur avec un budget defini, **When** ses depenses depassent 80% du budget, **Then** il recoit une alerte visuelle.

---

### User Story 2 - Import de donnees bancaires (Priority: P1)

En tant qu'utilisateur, je veux importer mes releves bancaires au format CSV afin de retrouver automatiquement mes transactions sans saisie manuelle.

**Why this priority**: L'import CSV est essentiel pour l'adoption - personne ne veut ressaisir des mois de transactions. C'est un must-have MVP.

**Independent Test**: Un utilisateur peut importer un fichier CSV bancaire et retrouver ses transactions categorisees automatiquement.

**Acceptance Scenarios**:

1. **Given** un utilisateur avec un fichier CSV de sa banque, **When** il lance l'import et configure le mapping des colonnes, **Then** les transactions sont importees avec detection automatique du format.
2. **Given** un import avec des transactions potentiellement en double, **When** l'import est traite, **Then** le systeme detecte les doublons et propose de les ignorer.
3. **Given** un utilisateur avec des regles d'auto-categorisation definies, **When** les transactions sont importees, **Then** les regles sont appliquees automatiquement.

---

### User Story 3 - Gestion multi-utilisateurs et workspaces (Priority: P1)

En tant que famille ou colocation, nous voulons gerer un budget commun separe de nos finances personnelles, avec suivi de "qui doit quoi".

**Why this priority**: Le multi-tenant est fondamental pour l'architecture et doit etre present des le debut. C'est un differenciateur cle.

**Independent Test**: Plusieurs utilisateurs peuvent se connecter, chacun accede a son workspace personnel et a un workspace partage (famille/colocation).

**Acceptance Scenarios**:

1. **Given** un utilisateur inscrit, **When** il cree un nouveau workspace "Famille", **Then** il peut inviter d'autres membres avec des roles specifiques.
2. **Given** un workspace colocation avec 3 membres, **When** un membre ajoute une depense commune, **Then** la repartition est calculee automatiquement.
3. **Given** des depenses communes enregistrees, **When** un membre consulte le settlement, **Then** il voit clairement "qui doit quoi a qui".
4. **Given** un utilisateur membre de plusieurs workspaces, **When** il change de workspace, **Then** toutes les donnees sont filtrees et isolees.

---

### User Story 4 - Authentification securisee (Priority: P1)

En tant qu'utilisateur, je veux une authentification forte avec MFA obligatoire afin de proteger mes donnees financieres sensibles.

**Why this priority**: La securite est non-negociable pour une application financiere. L'authentification doit etre solide des le jour 1.

**Independent Test**: Un utilisateur peut s'inscrire, configurer MFA (TOTP), se connecter avec verification en deux etapes.

**Acceptance Scenarios**:

1. **Given** un nouvel utilisateur, **When** il complete l'inscription, **Then** il DOIT configurer au moins une methode MFA (TOTP ou Passkey).
2. **Given** un utilisateur inactif depuis 10 minutes, **When** il revient sur l'application, **Then** l'interface est verrouillee et demande une re-authentification.
3. **Given** un utilisateur connecte, **When** il veut acceder a une fonction sensible (export, parametres securite), **Then** une re-authentification step-up est demandee.
4. **Given** un utilisateur avec plusieurs appareils, **When** il consulte la gestion des sessions, **Then** il voit tous ses appareils et peut revoquer une session.

---

### User Story 5 - Gestion des documents et justificatifs (Priority: P2)

En tant qu'utilisateur, je veux capturer et organiser mes documents financiers (factures, contrats, recus) afin de les retrouver facilement et les rattacher a mes transactions.

**Why this priority**: Essentiel pour la completude du hub financier mais peut fonctionner en mode simple sans le coffre E2EE initialement.

**Independent Test**: Un utilisateur peut uploader un document, le retrouver dans l'inbox, le rattacher a une transaction.

**Acceptance Scenarios**:

1. **Given** un utilisateur sur mobile, **When** il prend une photo d'un recu, **Then** le document arrive dans son inbox documents.
2. **Given** un document dans l'inbox, **When** l'utilisateur le rattache a une transaction, **Then** le lien est etabli et le document est archive.
3. **Given** un utilisateur qui recherche un document, **When** il utilise la recherche par date/categorie/mot-cle, **Then** les resultats correspondants s'affichent.
4. **Given** un upload de document deja existant, **When** le systeme detecte un doublon, **Then** l'utilisateur est averti et peut choisir de l'ignorer.

---

### User Story 6 - Budgets et suivi des depenses (Priority: P2)

En tant qu'utilisateur, je veux definir des budgets par categorie et suivre ma progression afin de maitriser mes depenses.

**Why this priority**: Fonctionnalite cle pour la valeur utilisateur mais depend des transactions (US1) pour fonctionner.

**Independent Test**: Un utilisateur peut creer un budget mensuel par categorie et voir sa progression en temps reel.

**Acceptance Scenarios**:

1. **Given** un utilisateur connecte, **When** il cree un budget pour la categorie "Alimentation" avec un montant mensuel, **Then** le budget est actif et le suivi demarre.
2. **Given** un budget actif avec 75% consomme, **When** l'utilisateur consulte le dashboard, **Then** il voit clairement l'etat avec une jauge visuelle.
3. **Given** un budget depasse, **When** l'utilisateur ajoute une nouvelle depense dans cette categorie, **Then** l'alerte de depassement est visible.
4. **Given** un mois termine, **When** l'utilisateur consulte l'historique, **Then** il voit le bilan des budgets vs realise.

---

### User Story 7 - Mode Pro - Facturation basique (Priority: P3)

En tant qu'auto-entrepreneur, je veux creer des devis et factures simples afin de gerer mon activite professionnelle.

**Why this priority**: Fonctionnalite V1 - etend le produit aux professionnels mais n'est pas requise pour le MVP particuliers.

**Independent Test**: Un utilisateur pro peut creer un client, emettre un devis, le convertir en facture.

**Acceptance Scenarios**:

1. **Given** un utilisateur en mode pro, **When** il cree un nouveau client avec ses coordonnees, **Then** le client est enregistre dans son carnet d'adresses.
2. **Given** un client existant, **When** l'utilisateur cree un devis avec lignes de prestations, **Then** le devis est genere avec calculs automatiques (HT, TVA, TTC).
3. **Given** un devis accepte, **When** l'utilisateur le convertit en facture, **Then** la facture est creee avec numero sequentiel.
4. **Given** une facture emise, **When** le client paie, **Then** l'utilisateur peut marquer la facture comme payee et la transaction correspondante est creee.

---

### User Story 8 - Suivi des investissements (Priority: P3)

En tant qu'investisseur particulier, je veux tracker mon portefeuille (actions, ETF, crypto) afin de suivre la performance globale de mon patrimoine.

**Why this priority**: Fonctionnalite V2 - differenciateur mais complexe (market data). Ne bloque pas le MVP.

**Independent Test**: Un utilisateur peut ajouter une position (achat d'actions), voir la valorisation actuelle et la performance.

**Acceptance Scenarios**:

1. **Given** un utilisateur avec le module Invest active, **When** il ajoute une transaction d'achat (actif, quantite, prix), **Then** la position est enregistree dans son portefeuille.
2. **Given** un portefeuille avec des positions, **When** les cours sont mis a jour, **Then** la valorisation totale et les plus/moins-values sont recalculees.
3. **Given** un utilisateur avec plusieurs comptes (PEA, CTO, Crypto), **When** il consulte le dashboard, **Then** il voit l'allocation globale par type d'actif.
4. **Given** un utilisateur qui souhaite analyser, **When** il consulte une position, **Then** il voit l'historique des transactions, PRU, et performance.

---

### User Story 9 - Reporting et exports (Priority: P3)

En tant qu'utilisateur, je veux generer des rapports et exporter mes donnees afin d'avoir une vue synthetique et d'utiliser mes donnees ailleurs si besoin.

**Why this priority**: Important pour la valeur long terme mais les vues basiques (US1, US6) suffisent pour le MVP.

**Independent Test**: Un utilisateur peut generer un rapport mensuel PDF et exporter ses transactions en CSV.

**Acceptance Scenarios**:

1. **Given** un utilisateur avec des donnees sur plusieurs mois, **When** il genere un rapport mensuel, **Then** le PDF inclut resume, graphiques, et details.
2. **Given** un utilisateur, **When** il demande un export CSV, **Then** il obtient un fichier avec toutes les transactions filtrees.
3. **Given** un utilisateur en mode pro, **When** il genere un export comptable, **Then** le format est compatible avec les logiciels comptables standards.

---

### Edge Cases

- **Perte de connectivite pendant l'import CSV**: L'import doit etre atomique - soit tout est importe, soit rien. Reprise possible.
- **Conflit de modification en multi-utilisateur**: Gestion optimiste avec notification de conflit.
- **Session expiree pendant une saisie**: Les donnees en cours de saisie doivent etre preservees localement.
- **Fichier CSV malformed**: Message d'erreur clair avec indication de la ligne problematique.
- **Workspace supprime avec donnees**: Confirmation forte + periode de grace pour restauration.
- **Quota market data atteint**: Degradation gracieuse - affichage des derniers cours connus avec indication de l'age des donnees.
- **Mot de passe maitre oublie (coffre E2EE)**: Impossible de recuperer les donnees - avertissement clair a la creation.

## Requirements *(mandatory)*

### Functional Requirements

#### Core Finance

- **FR-001**: Le systeme DOIT permettre de creer des comptes financiers (bancaire, especes, epargne).
- **FR-002**: Le systeme DOIT permettre d'enregistrer des transactions (depenses, revenus, virements).
- **FR-003**: Le systeme DOIT supporter la categorisation des transactions (categories pre-definies + personnalisees).
- **FR-004**: Le systeme DOIT permettre de taguer les transactions avec des etiquettes libres.
- **FR-005**: Le systeme DOIT supporter les transactions recurrentes (automatisation).
- **FR-006**: Le systeme DOIT permettre de definir des regles d'auto-categorisation basees sur patterns.
- **FR-007**: Le systeme DOIT supporter les devises multiples avec taux de change historiques.

#### Import

- **FR-010**: Le systeme DOIT importer des fichiers CSV avec detection automatique du format (separateur, encodage).
- **FR-011**: Le systeme DOIT permettre le mapping manuel des colonnes CSV vers les champs transactions.
- **FR-012**: Le systeme DOIT detecter les doublons lors de l'import (hash sur date+montant+description).
- **FR-013**: Le systeme DEVRAIT supporter les formats OFX/QIF (V1+).

#### Budgets

- **FR-020**: Le systeme DOIT permettre de creer des budgets par categorie et par periode (mensuel/annuel).
- **FR-021**: Le systeme DOIT calculer en temps reel le pourcentage de consommation des budgets.
- **FR-022**: Le systeme DOIT alerter visuellement lorsqu'un seuil de budget est atteint (80%, 100%).

#### Documents

- **FR-030**: Le systeme DOIT permettre l'upload de documents (photos, PDF) jusqu'a 20 Mo par fichier.
- **FR-031**: Le systeme DOIT maintenir une inbox de documents non traites.
- **FR-032**: Le systeme DOIT permettre de rattacher un document a une ou plusieurs transactions.
- **FR-033**: Le systeme DOIT detecter les documents en doublon (hash de contenu).
- **FR-034**: Le systeme DEVRAIT permettre le stockage en coffre E2EE pour documents sensibles (V2).

#### Multi-tenant / Workspaces

- **FR-040**: Le systeme DOIT supporter plusieurs utilisateurs sur une meme instance.
- **FR-041**: Le systeme DOIT isoler les donnees par workspace - aucune fuite inter-workspace.
- **FR-042**: Un utilisateur DOIT pouvoir appartenir a plusieurs workspaces simultanement.
- **FR-043**: Le systeme DOIT supporter 4 types de workspaces: Personal, Family, Flatshare, Company.
- **FR-044**: Le systeme DOIT implementer RBAC avec roles: Owner, Admin, Accountant, Member, Read-Only.
- **FR-045**: Pour les workspaces Flatshare, le systeme DOIT calculer les settlements (qui doit quoi).

#### Securite

- **FR-050**: Le systeme DOIT exiger MFA pour tous les utilisateurs (TOTP minimum).
- **FR-051**: Le systeme DOIT supporter les Passkeys/WebAuthn comme methode d'authentification.
- **FR-052**: Le systeme DOIT verrouiller automatiquement apres inactivite (configurable, defaut 10 min).
- **FR-053**: Le systeme DOIT exiger une re-authentification pour les actions sensibles.
- **FR-054**: Le systeme DOIT journaliser toutes les actions sensibles (audit log).
- **FR-055**: Le systeme DOIT permettre la gestion des appareils connectes avec revocation.

#### Mode Pro (V1+)

- **FR-060**: Le systeme DOIT permettre de gerer un carnet clients/fournisseurs.
- **FR-061**: Le systeme DOIT permettre de creer des devis avec lignes de detail.
- **FR-062**: Le systeme DOIT permettre de creer des factures avec numerotation sequentielle.
- **FR-063**: Le systeme DOIT calculer automatiquement TVA selon taux configures.
- **FR-064**: Le systeme DOIT permettre de convertir un devis accepte en facture.

#### Investissements (V2+)

- **FR-070**: Le systeme DOIT permettre de tracker des positions (achat/vente/dividende).
- **FR-071**: Le systeme DOIT calculer le PRU (Prix de Revient Unitaire) des positions.
- **FR-072**: Le systeme DOIT recuperer les cours via providers market data.
- **FR-073**: Le systeme DOIT afficher la valorisation en temps reel et les plus/moins-values.
- **FR-074**: Le systeme DOIT supporter actions, ETF, crypto, et matieres premieres.
- **FR-075**: Le systeme NE DOIT PAS permettre l'execution d'ordres (tracking uniquement).

#### Reporting

- **FR-080**: Le systeme DOIT fournir des vues synthetiques: Jour, Mois, Annee.
- **FR-081**: Le systeme DOIT calculer le Net Worth (patrimoine net).
- **FR-082**: Le systeme DOIT generer des rapports PDF exportables.
- **FR-083**: Le systeme DOIT permettre l'export des donnees en CSV.

### Key Entities

- **User**: Identite authentifiee, peut appartenir a plusieurs workspaces via Membership.
- **Workspace**: Conteneur isole de donnees (Personal, Family, Flatshare, Company). Toutes les entites metier sont scopees par workspace.
- **Membership**: Relation User-Workspace avec Role associe.
- **Role**: Ensemble de permissions (Owner, Admin, Accountant, Member, Read-Only).
- **Permission**: Droit d'acces granulaire par domaine (transactions, documents, exports, etc.).
- **Account**: Compte financier (bancaire, especes, epargne, investissement).
- **Transaction**: Mouvement financier avec montant, date, categorie, tags, justificatifs.
- **Category**: Classification hierarchique des transactions (pre-definies + personnalisees).
- **Budget**: Enveloppe budgetaire par categorie et periode.
- **Document**: Fichier (image, PDF) avec metadata, rattachable aux transactions.
- **Rule**: Regle d'automatisation (categorisation, recurrence).
- **Client/Fournisseur** (Pro): Contact commercial avec coordonnees et historique.
- **Devis/Facture** (Pro): Document commercial avec lignes de detail.
- **Position** (Invest): Holding d'un actif avec quantite et PRU.
- **Asset** (Invest): Instrument financier (action, ETF, crypto) avec symbole et provider.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Les utilisateurs peuvent completer l'onboarding (compte + workspace + premier import) en moins de 10 minutes.
- **SC-002**: Le taux de reussite des imports CSV depasse 95% sans intervention manuelle.
- **SC-003**: L'ajout d'une transaction manuelle se complete en moins de 5 secondes.
- **SC-004**: La restauration complete d'une sauvegarde s'effectue en moins de 10 minutes pour 100 000 transactions.
- **SC-005**: Le systeme supporte 10 utilisateurs simultanes sur un NAS grand public sans degradation perceptible.
- **SC-006**: L'interface repond en moins de 200ms pour les interactions courantes (navigation, liste, ajout).
- **SC-007**: 90% des utilisateurs reussissent a configurer MFA sans assistance.
- **SC-008**: Le settlement colocation calcule correctement les dettes pour 100% des scenarios standard.
- **SC-009**: Aucune donnee d'un workspace ne peut etre accedee depuis un autre workspace (verification par audit).
- **SC-010**: Les cours boursiers/crypto sont mis a jour au minimum toutes les heures en respectant les quotas providers.

## Assumptions

- Les utilisateurs ont un NAS ou serveur Docker accessible en reseau local (et potentiellement via reverse proxy externe).
- Les fichiers CSV bancaires suivent des formats standards (separateur virgule/point-virgule, encodage UTF-8 ou ISO-8859-1).
- Les utilisateurs acceptent de configurer MFA - pas d'option "sans MFA".
- Le stockage local est suffisant pour les documents (estimation: 1-5 Go par utilisateur/an).
- Les providers market data gratuits (avec quotas) sont acceptables pour le tracking (pas de trading temps reel).
- L'application fonctionne en mode self-host uniquement, sans version SaaS.

## Out of Scope

- Execution d'ordres boursiers ou crypto (broker functionality)
- Connecteurs bancaires automatiques (open banking) - prevu V3
- OCR automatique des documents - prevu V3
- Application mobile native (iOS/Android) - PWA uniquement
- Mode hors ligne complet (synchronisation locale avancee)
- ERP complet (gestion de stock, RH, production)
- Multi-instance / federation entre instances
