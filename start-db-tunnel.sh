#!/bin/bash
# SSH-туннель к серверной БД EMV для локальной разработки.
# Запуск: ./start-db-tunnel.sh
# После запуска локальный порт 15432 проброшен на серверный PostgreSQL (5432).
# В .env должен быть DATABASE_URL="postgresql://emv:TOQrXgiDJ3DGEeCEtsc7wieI7b427ff6@127.0.0.1:15432/emv?schema=public"

ssh -i ~/.ssh/emv_deploy -L 15432:127.0.0.1:5432 root@89.108.88.12 -N -o ServerAliveInterval=30 -o ServerAliveCountMax=3
