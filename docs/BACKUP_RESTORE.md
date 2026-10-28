# Project Hub - Backup and Disaster Recovery Guide

This guide describes disaster recovery, database dump/restore commands, and maintenance workflows tailored for free-tier deployments.

---

## 1. Database Backup (pg_dump)

To create an encrypted and compressed backup of the Supabase PostgreSQL database:

```bash
# Set your connection details
export DB_HOST="db.<your-project-ref>.supabase.co"
export DB_PORT="5432"
export DB_USER="postgres"
export DB_NAME="postgres"

# Dump public schema data and structure
pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME \
  --schema=public \
  --format=custom \
  --file="project_hub_backup_$(date +%Y%m%d_%H%M%S).dump"
```

---

## 2. Database Restore (pg_restore)

To restore a backup into a fresh Supabase database instance:

```bash
pg_restore -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME \
  --clean \
  --if-exists \
  --no-owner \
  "project_hub_backup_<timestamp>.dump"
```

---

## 3. Automated Weekly Backup (GitHub Actions)

A GitHub Actions workflow can be configured to run every Sunday at 02:00 UTC:

```yaml
name: Weekly Database Backup
on:
  schedule:
    - cron: '0 2 * * 0'
  workflow_dispatch:

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: Install PostgreSQL Tools
        run: sudo apt-get install -y postgresql-client

      - name: Run pg_dump
        env:
          PGPASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
        run: |
          pg_dump -h db.${{ secrets.SUPABASE_PROJECT_REF }}.supabase.co \
            -U postgres -d postgres -F c -b -v \
            --file=backup.dump

      - name: Upload Backup Artifact
        uses: actions/upload-artifact@v4
        with:
          name: database-backup
          path: backup.dump
          retention-days: 30
```

---

## 4. Free-Tier Maintenance & Discipline

1. **Supabase Inactivity Pausing**:
   Free-tier Supabase projects are paused after 7 days of inactivity. The scheduled GitHub Actions weekly backup serves as a keep-alive ping to ensure the database remains warm and operational.
2. **Realtime Replication Discipline**:
   Replication is enabled only for active tables (`messages`, `message_reactions`, `notifications`, `tasks`). Transient presence updates are not replicated globally.
3. **Storage Quota Enforcement**:
   File uploads are restricted to an allowlist with strict size limits (50 MB video, 20 MB audio, 15 MB docs, 5 MB images).
