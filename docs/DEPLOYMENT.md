# Guide de deploiement

Guide complet pour deployer HubCompta en production.

---

## Table des matieres

- [Prerequis](#prerequis)
- [Deploiement Docker](#deploiement-docker)
- [Configuration](#configuration)
- [Base de donnees](#base-de-donnees)
- [SSL/TLS](#ssltls)
- [Monitoring avec Sentry](#monitoring-avec-sentry)
- [Sauvegardes](#sauvegardes)
- [Mise a jour](#mise-a-jour)
- [Depannage](#depannage)

---

## Prerequis

### Materiel

| Ressource | Minimum | Recommande |
|-----------|---------|------------|
| CPU | 2 coeurs | 4 coeurs |
| RAM | 2 Go | 4 Go |
| Stockage | 10 Go | 50 Go+ |

### Logiciels

- Docker 24.0+
- Docker Compose 2.20+
- Nom de domaine avec acces DNS

### Plateformes testees

- Ubuntu 22.04 LTS / Debian 12
- Synology DSM 7.x
- QNAP QTS 5.x
- Raspberry Pi 4 (ARM64)

---

## Deploiement Docker

### 1. Cloner le repository

```bash
git clone https://github.com/Louisdelez/HubCompta.git
cd HubCompta/docker
```

### 2. Configurer l'environnement

```bash
# Copier le template
cp .env.example .env

# Generer des secrets securises
JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
JWT_REFRESH_SECRET=$(openssl rand -base64 64 | tr -d '\n')
DB_PASSWORD=$(openssl rand -base64 32 | tr -d '\n')
REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d '\n')
MINIO_SECRET_KEY=$(openssl rand -base64 32 | tr -d '\n')

# Editer la configuration
nano .env
```

### 3. Configurer le DNS

Pointez votre domaine vers le serveur :

```
hubcompta.example.com  ->  IP_DU_SERVEUR
```

### 4. Lancer les services

```bash
# Construire et demarrer
docker compose -f docker-compose.prod.yml up -d --build

# Verifier l'etat
docker compose -f docker-compose.prod.yml ps

# Voir les logs
docker compose -f docker-compose.prod.yml logs -f
```

### 5. Initialiser la base de donnees

```bash
# Executer les migrations
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy

# (Optionnel) Charger les donnees initiales
docker compose -f docker-compose.prod.yml exec backend npx prisma db seed
```

### 6. Verifier l'installation

```bash
curl https://votre-domaine.com/health
# Reponse attendue : {"status":"ok","version":"1.0.0",...}
```

---

## Configuration

### Variables requises

| Variable | Description | Exemple |
|----------|-------------|---------|
| `DOMAIN` | Votre domaine | `hubcompta.example.com` |
| `DB_PASSWORD` | Mot de passe PostgreSQL | *(genere)* |
| `REDIS_PASSWORD` | Mot de passe Redis | *(genere)* |
| `JWT_SECRET` | Secret JWT (64+ chars) | *(genere)* |
| `JWT_REFRESH_SECRET` | Secret refresh token | *(genere)* |
| `MINIO_SECRET_KEY` | Secret stockage objets | *(genere)* |
| `ACME_EMAIL` | Email pour Let's Encrypt | `admin@example.com` |

### Variables optionnelles

| Variable | Defaut | Description |
|----------|--------|-------------|
| `TZ` | `Europe/Paris` | Fuseau horaire |
| `DB_USER` | `hubcompta` | Utilisateur PostgreSQL |
| `DB_NAME` | `hubcompta` | Nom de la base |
| `BACKUP_RETENTION_DAYS` | `7` | Jours de retention des sauvegardes |

### Exemple complet de fichier .env

```env
# Domaine
DOMAIN=hubcompta.example.com
APP_NAME=HubCompta

# Base de donnees
DB_USER=hubcompta
DB_PASSWORD=votre_mot_de_passe_securise
DB_NAME=hubcompta

# Redis
REDIS_PASSWORD=votre_mot_de_passe_redis

# JWT (generer avec: openssl rand -base64 64)
JWT_SECRET=votre_secret_jwt_64_caracteres_minimum
JWT_REFRESH_SECRET=votre_secret_refresh_64_caracteres

# Stockage objets
MINIO_ACCESS_KEY=hubcompta
MINIO_SECRET_KEY=votre_mot_de_passe_minio
S3_BUCKET=hubcompta

# SSL
ACME_EMAIL=admin@example.com

# Fuseau horaire
TZ=Europe/Paris

# Sauvegardes
BACKUP_RETENTION_DAYS=30

# Monitoring (optionnel)
SENTRY_DSN=https://xxx@sentry.io/xxx
```

---

## Base de donnees

### Migrations

Les migrations sont gerees par Prisma.

```bash
# Appliquer les migrations en production
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy

# Voir l'etat des migrations
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate status
```

### Acces direct

```bash
# Se connecter a PostgreSQL
docker compose -f docker-compose.prod.yml exec postgres psql -U hubcompta -d hubcompta

# Executer une requete
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U hubcompta -d hubcompta -c "SELECT count(*) FROM users;"
```

### Sauvegarde manuelle de la base

```bash
# Exporter la base
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U hubcompta hubcompta | gzip > backup_$(date +%Y%m%d).sql.gz
```

---

## SSL/TLS

### Certificats automatiques (Let's Encrypt)

Les certificats SSL sont geres automatiquement par Traefik.

**Prerequis :**
1. Le domaine doit pointer vers le serveur
2. Les ports 80 et 443 doivent etre ouverts
3. `ACME_EMAIL` doit etre configure

Les certificats sont renouveles automatiquement avant expiration.

### Certificats personnalises

Pour utiliser vos propres certificats :

1. Placez les certificats dans `docker/config/traefik/certs/` :
   ```
   certs/
   ├── cert.pem
   └── key.pem
   ```

2. Modifiez `docker/config/traefik/traefik.yml` :
   ```yaml
   tls:
     certificates:
       - certFile: /etc/traefik/certs/cert.pem
         keyFile: /etc/traefik/certs/key.pem
   ```

3. Redemarrez Traefik :
   ```bash
   docker compose -f docker-compose.prod.yml restart traefik
   ```

---

## Monitoring avec Sentry

### Configuration de Sentry

HubCompta supporte Sentry pour le monitoring des erreurs en production.

1. Creez un compte sur [sentry.io](https://sentry.io) ou installez Sentry self-hosted
2. Creez un projet pour Node.js (backend) et React (frontend)
3. Ajoutez les variables d'environnement :

```env
# Backend
SENTRY_DSN=https://xxx@sentry.io/xxx
SENTRY_ENVIRONMENT=production

# Frontend (dans le build)
VITE_SENTRY_DSN=https://yyy@sentry.io/yyy
```

### Fonctionnalites

- Capture automatique des erreurs
- Traces de performance
- Alertes par email/Slack
- Breadcrumbs pour le debugging

### Endpoints de sante

| Endpoint | Description |
|----------|-------------|
| `/health` | Sante globale |
| `/health/live` | Liveness probe (Kubernetes) |
| `/health/ready` | Readiness probe (Kubernetes) |
| `/health/db` | Sante PostgreSQL |
| `/health/redis` | Sante Redis |
| `/health/storage` | Sante MinIO |
| `/health/metrics` | Metriques processus |

### Script de verification automatisee

```bash
#!/bin/bash
HEALTH=$(curl -s https://votre-domaine.com/health)
STATUS=$(echo $HEALTH | jq -r '.status')

if [ "$STATUS" != "ok" ]; then
  echo "ALERTE: HubCompta est $STATUS"
  # Envoyer une notification
fi
```

### Logs Docker

```bash
# Tous les services
docker compose -f docker-compose.prod.yml logs -f

# Service specifique
docker compose -f docker-compose.prod.yml logs -f backend

# 100 dernieres lignes
docker compose -f docker-compose.prod.yml logs --tail=100 backend
```

---

## Sauvegardes

### Sauvegardes automatiques

Les sauvegardes sont executees automatiquement toutes les 24h.
Les fichiers sont stockes dans `docker/backups/`.

### Sauvegarde manuelle

```bash
docker compose -f docker-compose.prod.yml exec backup /backup.sh
```

### Restauration

```bash
# Arreter l'application
docker compose -f docker-compose.prod.yml stop backend worker

# Restaurer la base
gunzip -c backups/hubcompta_2024-01-15.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U hubcompta -d hubcompta

# Redemarrer
docker compose -f docker-compose.prod.yml start backend worker
```

### Stockage externe des sauvegardes

Pour sauvegarder vers S3/MinIO externe, configurez :

```env
BACKUP_S3_ENDPOINT=s3.amazonaws.com
BACKUP_S3_BUCKET=mes-sauvegardes
BACKUP_S3_ACCESS_KEY=xxx
BACKUP_S3_SECRET_KEY=xxx
```

---

## Mise a jour

### Mise a jour standard

```bash
cd HubCompta

# Recuperer les changements
git pull origin main

# Reconstruire et redemarrer
cd docker
docker compose -f docker-compose.prod.yml up -d --build

# Executer les migrations
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

### Mise a jour sans interruption

```bash
# Construire les nouvelles images
docker compose -f docker-compose.prod.yml build

# Mettre a jour service par service
docker compose -f docker-compose.prod.yml up -d --no-deps backend
docker compose -f docker-compose.prod.yml up -d --no-deps worker
docker compose -f docker-compose.prod.yml up -d --no-deps frontend
```

---

## Depannage

### Le conteneur ne demarre pas

```bash
# Verifier les logs
docker compose -f docker-compose.prod.yml logs backend

# Problemes courants :
# - Base de donnees pas prete : attendre le healthcheck postgres
# - Variables manquantes : verifier .env
# - Conflit de ports : verifier si 80/443 sont utilises
```

### Connexion a la base echouee

```bash
# Verifier que postgres tourne
docker compose -f docker-compose.prod.yml ps postgres

# Tester la connexion
docker compose -f docker-compose.prod.yml exec postgres pg_isready

# Verifier les logs
docker compose -f docker-compose.prod.yml logs postgres
```

### Problemes de certificat SSL

```bash
# Verifier les logs Traefik
docker compose -f docker-compose.prod.yml logs traefik

# Problemes courants :
# - DNS non propage : attendre ou verifier le DNS
# - Rate limit : utiliser d'abord le serveur staging
# - Port 80 bloque : requis pour le challenge HTTP
```

### Reinitialisation complete

```bash
# Arreter tous les services
docker compose -f docker-compose.prod.yml down

# Supprimer les volumes (ATTENTION: supprime toutes les donnees!)
docker compose -f docker-compose.prod.yml down -v

# Reconstruire de zero
docker compose -f docker-compose.prod.yml up -d --build
```

---

## Securite

### Recommandations

1. **Firewall** : N'exposez que les ports 80 et 443
2. **Mises a jour** : Gardez Docker et l'OS a jour
3. **Secrets** : Utilisez des mots de passe forts et uniques
4. **Sauvegardes** : Stockez les sauvegardes hors site
5. **Monitoring** : Configurez des alertes de sante
6. **Fail2ban** : Ajoutez une protection brute-force

### Configuration UFW (exemple)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## Architecture de production

```
                    +-------------------+
                    |     Internet      |
                    +---------+---------+
                              |
                    +---------v---------+
                    |     Traefik       | :80, :443
                    |  (Reverse Proxy)  |
                    +----+--------+-----+
                         |        |
         +---------------+        +---------------+
         |                                        |
+--------v--------+                    +----------v--------+
|    Frontend     |                    |      Backend      |
|    (Nginx)      |                    |    (Fastify)      |
+-----------------+                    +----------+--------+
                                                  |
         +----------------+----------------+------+------+
         |                |                |             |
+--------v-----+  +-------v------+  +------v-----+  +----v----+
|    Worker    |  |  PostgreSQL  |  |   Redis    |  |  MinIO  |
|   (BullMQ)   |  |              |  |            |  |         |
+--------------+  +--------------+  +------------+  +---------+
```

---

## Support

- **Issues** : [GitHub Issues](https://github.com/Louisdelez/HubCompta/issues)
- **Discussions** : [GitHub Discussions](https://github.com/Louisdelez/HubCompta/discussions)
