# Podere al Sole - Migrazione Render -> VPS (frontend statico + backend Docker)

## 1) Struttura server consigliata

```text
/srv/projects
├── bot
└── podere-al-sole
    ├── backend
    │   ├── src/
    │   ├── public/admin/
    │   ├── Dockerfile
    │   ├── docker-compose.yml
    │   ├── .env
    │   └── data/
    └── frontend (repo/static hosting separato)
```

## 2) Prerequisiti VPS

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl gnupg lsb-release nginx ufw git

# Docker Engine + Compose plugin
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
```

## 3) Cartelle e clone backend

```bash
sudo mkdir -p /srv/projects/podere-al-sole
sudo chown -R $USER:$USER /srv/projects/podere-al-sole
cd /srv/projects/podere-al-sole

# backend repo
# (usa il tuo repo reale backend)
git clone <REPO_BACKEND_URL> backend
cd backend
```

## 4) Config backend

```bash
cp .env.example .env
nano .env
```

Valori minimi consigliati in `.env`:
- `SERVE_CLIENT=false`
- `BACKEND_HOST_PORT=3380` (non confligge col bot)
- `DB_PATH=/data/agriturismo.sqlite`
- `CORS_ALLOWED_ORIGINS=https://poderealsole.com,https://www.poderealsole.com,https://<utente>.github.io`
- credenziali admin forti e `PASSWORD_SALT` robusto

## 5) Avvio backend Docker

```bash
cd /srv/projects/podere-al-sole/backend
docker compose up -d --build
docker compose ps
docker logs poderealsole_backend --tail=100
curl -sS http://127.0.0.1:3380/healthz
```

## 6) Verifica conflitti con bot esistente

```bash
# processi in ascolto
sudo ss -tulpen | grep -E '(:80|:443|:3380|:3300)'

# container attivi
docker ps --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}'
```

## 7) Nginx reverse proxy

```bash
sudo cp deploy/nginx/poderealsole-api.conf /etc/nginx/sites-available/poderealsole-api.conf
sudo ln -s /etc/nginx/sites-available/poderealsole-api.conf /etc/nginx/sites-enabled/poderealsole-api.conf
sudo nginx -t
sudo systemctl reload nginx
```

## 8) HTTPS (Certbot)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.poderealsole.com
```

## 9) Firewall base

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

## 10) Frontend statico (GitHub)

- Pubblica la cartella `frontend/` su repo dedicato (es. `podere-al-sole-frontend`)
- In `frontend/config.js` imposta:

```js
window.__APP_CONFIG__ = {
  API_BASE_URL: 'https://api.poderealsole.com'
};
```

## 11) Aggiornamento futuro backend

```bash
cd /srv/projects/podere-al-sole/backend
git pull
docker compose up -d --build
docker compose ps
docker logs poderealsole_backend --tail=100
```

## 12) Aggiornamento futuro frontend

- Commit/push su repo frontend
- GitHub Pages aggiorna automaticamente
- Se usi altro static hosting: trigger deploy dal provider
