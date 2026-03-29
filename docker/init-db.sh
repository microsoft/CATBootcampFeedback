#!/bin/bash
##
## Initialize the database: create schema, run migrations, seed test data.
## Runs as a one-shot container after SQL Server is healthy.
##

set -e

SQLCMD="/opt/mssql-tools/bin/sqlcmd"
SERVER="$DB_HOST"
PASSWORD="$SA_PASSWORD"

echo "=== Waiting for SQL Server to be ready ==="
for i in $(seq 1 30); do
    $SQLCMD -S "$SERVER" -U sa -P "$PASSWORD" -Q "SELECT 1" -b > /dev/null 2>&1 && break
    echo "  Attempt $i/30 — waiting..."
    sleep 2
done

echo ""
echo "=== Creating database ==="
$SQLCMD -S "$SERVER" -U sa -P "$PASSWORD" -Q "
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'CATBootcampFeedback')
BEGIN
    CREATE DATABASE CATBootcampFeedback;
    PRINT 'Database created';
END
ELSE
    PRINT 'Database already exists';
" -b

echo ""
echo "=== Running schema migration (001) ==="
$SQLCMD -S "$SERVER" -U sa -P "$PASSWORD" -d CATBootcampFeedback -i /scripts/001-schema.sql -b

echo ""
echo "=== Running user management migration (002) ==="
$SQLCMD -S "$SERVER" -U sa -P "$PASSWORD" -d CATBootcampFeedback -i /scripts/002-user-management.sql -b

echo ""
echo "=== Seeding test admin user (003) ==="
$SQLCMD -S "$SERVER" -U sa -P "$PASSWORD" -d CATBootcampFeedback -i /scripts/003-seed-test-admin.sql -b

echo ""
echo "============================================"
echo "  Database initialization complete!"
echo "  Database: CATBootcampFeedback"
echo "  Admin user: admin / Admin123!"
echo "============================================"
