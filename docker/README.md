# Deploiement Production - Finance Hub

Guide de deploiement self-hosted pour Finance Hub.

## Prerequis

- Docker 24+ et Docker Compose 2.20+
- Domaine avec acces DNS (pour HTTPS automatique)
- Ports 80 et 443 ouverts
- Minimum 2 Go RAM, 10 Go disque

## Deploiement rapide

### 1. Cloner le repository

```bash
git clone https://github.com/your-org/hubcompta.git
cd hubcompta/docker
```

### 2. Configurer l'environnement

```bash
# Copier le template
cp .env.example .env

# Editer les variables (OBLIGATOIRE)
nano .env
```

Variables a configurer:

| Variable | Description |
|----------|-------------|
| `DOMAIN` | Votre domaine (ex: `hubcompta.example.com`) |
| `DB_PASSWORD` | Mot de passe PostgreSQL |
| `REDIS_PASSWORD` | Mot de passe Redis |
| `JWT_SECRET` | Secret pour les tokens (min 32 caracteres) |
| `JWT_REFRESH_SECRET` | Secret pour les refresh tokens |
| `MINIO_SECRET_KEY` | Mot de passe MinIO |
| `ACME_EMAIL` | Email pour Let's Encrypt |

Generer des secrets securises:

```bash
# Generer un secret aleatoire
openssl rand -base64 64
```

### 3. Configurer le DNS

Ajoutez un enregistrement A ou CNAME pointant vers votre serveur:

```
hubcompta.example.com -> IP_DE_VOTRE_SERVEUR
```

### 4. Lancer le deploiement

```bash
# Construire et lancer
docker compose -f docker-compose.prod.yml up -d --build

# Verifier les logs
docker compose -f docker-compose.prod.yml logs -f

# Verifier la sante
curl https://votre-domaine.com/health
```

### 5. Initialiser la base de donnees

```bash
# Executer les migrations Prisma
docker compose -f docker-compose.prod.yml exec backend \
  npx prisma migrate deploy

# (Optionnel) Seed des donnees initiales
docker compose -f docker-compose.prod.yml exec backend \
  npx prisma db seed
```

## Architecture

```
                    ┌─────────────────┐
                    │    Internet     │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │    Traefik      │ :80, :443
                    │  (Reverse Proxy)│
                    └───┬─────────┬───┘
                        │         │
         ┌──────────────┴┐       ┌┴──────────────┐
         │   Frontend    │       │   Backend     │
         │   (Nginx)     │       │   (Fastify)   │
         └───────────────┘       └───────┬───────┘
                                         │
         ┌───────────────┬───────────────┼───────────────┐
         │               │               │               │
    ┌────▼────┐    ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼─────┐
    │ Worker  │    │ PostgreSQL│   │   Redis   │   │   MinIO   │
    │(BullMQ) │    │           │   │           │   │           │
    └─────────┘    └───────────┘   └───────────┘   └───────────┘
```

## Commandes utiles

### Logs

```bash
# Tous les services
docker compose -f docker-compose.prod.yml logs -f

# Un service specifique
docker compose -f docker-compose.prod.yml logs -f backend
```

### Redemarrage

```bash
# Redemarrer un service
docker compose -f docker-compose.prod.yml restart backend

# Redemarrer tout
docker compose -f docker-compose.prod.yml restart
```

### Mise a jour

```bash
# Arreter les services
docker compose -f docker-compose.prod.yml down

# Mettre a jour le code
git pull

# Reconstruire et relancer
docker compose -f docker-compose.prod.yml up -d --build

# Appliquer les migrations
docker compose -f docker-compose.prod.yml exec backend \
  npx prisma migrate deploy
```

### Sauvegardes

Les sauvegardes sont automatiques (quotidiennes). Pour une sauvegarde manuelle:

```bash
# Sauvegarde manuelle
docker compose -f docker-compose.prod.yml exec backup /backup.sh

# Lister les sauvegardes
ls -la backups/
```

### Restauration

```bash
# Arreter le backend
docker compose -f docker-compose.prod.yml stop backend worker

# Restaurer la base
gunzip -c backups/hubcompta_YYYY-MM-DD.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U hubcompta -d hubcompta

# Redemarrer
docker compose -f docker-compose.prod.yml start backend worker
```

## Monitoring

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

### Exemple de verification

```bash
# Sante complete
curl -s https://votre-domaine.com/health/full | jq

# Metriques
curl -s https://votre-domaine.com/health/metrics | jq
```

## Securite

### Bonnes pratiques

- Utilisez des mots de passe forts (min 32 caracteres)
- Activez le firewall (ufw, iptables)
- Mettez a jour regulierement
- Surveillez les logs d'acces

### Firewall (exemple UFW)

```bash
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP (redirection HTTPS)
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

### Fail2ban (optionnel)

Protection contre les attaques brute-force sur l'API.

## Troubleshooting

### Le site ne charge pas

1. Verifiez le DNS: `dig votre-domaine.com`
2. Verifiez les conteneurs: `docker ps`
3. Verifiez les logs Traefik: `docker logs hubcompta-traefik`

### Erreur de certificat SSL

1. Verifiez l'email ACME dans `.env`
2. Attendez quelques minutes (propagation)
3. Verifiez les logs: `docker logs hubcompta-traefik`

### Base de donnees inaccessible

```bash
# Verifier l'etat
docker compose -f docker-compose.prod.yml exec postgres pg_isready

# Redemarrer PostgreSQL
docker compose -f docker-compose.prod.yml restart postgres
```

### Espace disque plein

```bash
# Nettoyer les images Docker non utilisees
docker system prune -a

# Nettoyer les vieilles sauvegardes
find backups/ -name "*.sql.gz" -mtime +30 -delete
```

## Support

- Documentation: https://docs.hubcompta.example.com
- Issues: https://github.com/your-org/hubcompta/issues
