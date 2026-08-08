#!/bin/sh
set -e
echo "Preparing database..."
node src/bootstrap-db.js
echo "Starting API..."
exec node src/index.js
