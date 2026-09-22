TYPE THE CONTABO PASSWORD IN THIS TERMINAL, THEN PRESS ENTER
root@217.216.109.68's password:# Contabo Backend Deployment

This deployment replaces the Render web service. The Vercel frontend keeps using its same-origin `/api` proxy, which now targets `filscore-ai.quantech.international`.

## Prerequisites

- Point the domain's DNS `A` record to the Contabo server.
- Install Docker Engine, Docker Compose, Nginx, and Certbot on the server.
- Allow inbound TCP ports `22`, `80`, and `443`. Do not expose port `5000` or Redis.
- Keep the existing PostgreSQL database during the application cutover. Migrate the database separately after the Contabo API is healthy.

## Configure

From the repository root on Contabo:

```bash
cp backend/.env.contabo.example backend/.env.contabo
chmod 600 backend/.env.contabo
```

Replace every placeholder in `backend/.env.contabo`. Use the current production `DATABASE_URL` and authentication/provider secrets.

Install the Nginx configuration and obtain a certificate:

```bash
sudo cp ops/nginx/filscore-api.conf /etc/nginx/sites-available/filscore-api.conf
sudo ln -s /etc/nginx/sites-available/filscore-api.conf /etc/nginx/sites-enabled/filscore-api.conf
sudo certbot certonly --webroot -w /var/www/certbot -d filscore-ai.quantech.international
sudo nginx -t
sudo systemctl reload nginx
```

The certificate must exist before enabling the HTTPS server block. For a first certificate, temporarily enable only the port 80 block, run Certbot, then enable the full file.

## Start And Verify

```bash
docker compose -f docker-compose.contabo.yml up -d --build
docker compose -f docker-compose.contabo.yml ps
curl --fail http://127.0.0.1:5000/health
curl --fail https://filscore-ai.quantech.international/api/health
```

The API container runs the established schema migration sequence once before Gunicorn starts and is reachable only through Nginx. Redis data persists in a Docker volume.

After both health checks pass, deploy the updated Vercel configuration. Keep Render available until login, profile retrieval, FILSCORE computation, Apple login, and a database write all pass against Contabo; then delete the Render service.

## Operations

```bash
docker compose -f docker-compose.contabo.yml logs --tail=200 api
docker compose -f docker-compose.contabo.yml restart api
docker compose -f docker-compose.contabo.yml pull
docker compose -f docker-compose.contabo.yml up -d --build
```

Use the existing scripts in `ops/backup` to schedule and verify PostgreSQL backups before any database migration.root@217.216.109.68's password: