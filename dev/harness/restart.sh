#!/bin/sh
# (Re)start the mock-Shopify server in the background on port 4177.
cd "$(dirname "$0")"
[ -f server.pid ] && kill "$(cat server.pid)" 2>/dev/null
sleep 0.5
PORT=4177 nohup node server.js > server.log 2>&1 &
echo $! > server.pid
sleep 1.5
cat server.log
