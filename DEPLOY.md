# Deploy VPS

O dominio de producao e `fila.nortesulsementes.com`.
O app abaixo usa a porta interna `3005` para evitar conflito com outros apps.

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
git clone https://github.com/leo9694/fila-conferencia.git fila-conferencia
cd fila-conferencia

npm ci --omit=dev
cp .env.example .env
nano .env

PORT=3005 pm2 start server.js --name fila-conferencia --env production
pm2 save
pm2 startup
```

Configure o Nginx:

```bash
cat >/etc/nginx/sites-available/fila-conferencia <<'EOF'
server {
    listen 80;
    server_name fila.nortesulsementes.com;

    location / {
        proxy_pass http://127.0.0.1:3005;
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
certbot --nginx -d fila.nortesulsementes.com
```

## Ambientes

Localmente, mantenha o arquivo `.env` com as credenciais de treinamento.
Na VPS, mantenha sempre o arquivo `.env` com as credenciais de producao.
Use `SANKHYA_ACCESS_USER` e `SANKHYA_ACCESS_PASSWORD` para um usuario tecnico com acesso as consultas/validacoes da API.
O usuario logado no app continua sendo usado como conferente nas conferencias.

Os arquivos `.env`, `.env.treinamento` e `.env.producao` nao sao enviados para o Git.

Atualizar depois:

```bash
cd /var/www/fila-conferencia
git pull
npm ci --omit=dev
pm2 restart fila-conferencia
```
