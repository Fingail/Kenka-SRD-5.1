#!/bin/sh
set -eu
printf '%s' "$MONGO_REPLICA_KEY" > /tmp/dicecloud-mongo-key
chmod 400 /tmp/dicecloud-mongo-key
chown mongodb:mongodb /tmp/dicecloud-mongo-key
exec /usr/local/bin/docker-entrypoint.sh mongod --bind_ip_all --replSet dicecloud --keyFile /tmp/dicecloud-mongo-key
