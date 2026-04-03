# Utility Scripts

This directory contains utility scripts for the CAT Bootcamp Feedback application.

## User Migration Script

After running the database migrations, migrate existing users from the ADMIN_USERS_JSON environment variable to the database:

```bash
node scripts/migrate-users-from-env.js [--global-admin=username]
```

Options:
- `--global-admin=username`: Which user gets the protected GlobalAdmin role (defaults to first user)

The script:
1. Reads ADMIN_USERS_JSON from the environment
2. Inserts users into the Users table (preserving bcrypt hashes)
3. Assigns GlobalAdmin to the designated user with IsProtected=1
4. Assigns EventCreator to all other users
5. Grants all users access to all existing events
6. Safe to re-run (skips existing usernames)
