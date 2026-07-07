# Database Backups

A GitHub Action (`.github/workflows/db-backup.yml`) dumps the Supabase
PostgreSQL database every day at 3:00 AM Eastern, encrypts it with AES-256,
and stores it as a workflow artifact for **90 days**.

## Where to find backups

GitHub repo → **Actions** tab → **Database Backup** workflow → pick a run →
download the `db-backup-YYYY-MM-DD` artifact.

## Run a backup manually

Actions tab → Database Backup → **Run workflow**.

## Required repository secrets

Settings → Secrets and variables → Actions:

| Secret | Value |
|---|---|
| `SUPABASE_DB_URL` | The **direct** (port 5432) connection string — same as `DIRECT_URL` in `.env` |
| `BACKUP_PASSPHRASE` | The encryption passphrase (stored in the company password manager) |

## Restore procedure

1. Download and unzip the artifact → you get `joyful-crm-YYYY-MM-DD.dump.gpg`
2. Decrypt (will prompt for the passphrase):

   ```sh
   gpg --decrypt --output joyful-crm.dump joyful-crm-YYYY-MM-DD.dump.gpg
   ```

3. Restore into the target database (this OVERWRITES existing objects):

   ```sh
   pg_restore --clean --if-exists --no-owner --no-privileges \
     --dbname "$DIRECT_URL" joyful-crm.dump
   ```

   To restore a single table instead of everything:

   ```sh
   pg_restore --clean --if-exists --no-owner --no-privileges \
     --table clients --dbname "$DIRECT_URL" joyful-crm.dump
   ```

Requires `postgresql-client` 17+ (`pg_restore --version`).

## Notes

- The dump is schema + data, custom format (`-Fc`), ~a few MB compressed.
- If the passphrase is lost, existing backups are unrecoverable — keep it in
  the password manager, not just in GitHub secrets.
- Artifacts expire after 90 days; for long-term archives download a monthly
  copy somewhere safe (Google Drive, etc.).
