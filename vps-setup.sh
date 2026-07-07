#!/bin/bash
# Скрипт установки АРМ на VPS (Ubuntu/Debian)
# Запускать от root: bash vps-setup.sh

set -e

echo "=== Установка nginx ==="
apt-get update -qq
apt-get install -y nginx

echo "=== Создание папки для приложения ==="
mkdir -p /var/www/arm
chown -R www-data:www-data /var/www/arm

echo "=== Распаковка архива ==="
tar -xzf /root/arm-app.tar.gz -C /var/www/arm --strip-components=1
chown -R www-data:www-data /var/www/arm

echo "=== Настройка nginx ==="
cat > /etc/nginx/sites-available/arm << 'EOF'
server {
    listen 80;
    server_name 185.73.124.254;

    root /var/www/arm;
    index index.html;

    # Все маршруты → index.html (SPA)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Кэширование статики
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Сжатие
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;
}
EOF

ln -sf /etc/nginx/sites-available/arm /etc/nginx/sites-enabled/arm
rm -f /etc/nginx/sites-enabled/default

echo "=== Проверка конфига nginx ==="
nginx -t

echo "=== Перезапуск nginx ==="
systemctl restart nginx
systemctl enable nginx

echo ""
echo "✅ Готово! Приложение доступно по адресу: http://185.73.124.254"
