# Deploy VPS

Substitua `fila.seudominio.com.br` pelo dominio completo que aponta para a VPS.

```bash
ssh root@187.77.50.115

apt update
apt install -y git nginx

# Node 20 LTS, se ainda nao tiver Node instalado
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# PM2, se ainda nao estiver instalado
npm install -g pm2

mkdir -p /var/www
cd /var/www
git clone https://github.com/leo9694/REPOSITORIO.git fila-conferencia
cd fila-conferencia

npm ci --omit=dev
cp .env.example .env
nano .env

pm2 start server.js --name fila-conferencia --env production
pm2 save
pm2 startup
```

Configure o Nginx:

```bash
cat >/etc/nginx/sites-available/fila-conferencia <<'EOF'
server {
    listen 80;
    server_name fila.seudominio.com.br;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

ln -s /etc/nginx/sites-available/fila-conferencia /etc/nginx/sites-enabled/fila-conferencia
nginx -t
systemctl reload nginx
```

HTTPS com Certbot:

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d fila.seudominio.com.br
```

Atualizar depois:

```bash
cd /var/www/fila-conferencia
git pull
npm ci --omit=dev
pm2 restart fila-conferencia
```
