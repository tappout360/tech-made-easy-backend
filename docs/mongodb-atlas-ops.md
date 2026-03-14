# MongoDB Atlas Operations Guide

## 1. Automated Backups (Daily Snapshots)

### M10+ Dedicated Clusters
Atlas automatically takes daily snapshots + continuous backups:
- **Dashboard**: Atlas → Cluster → Backup → Snapshots
- **Retention**: 2 daily, 2 weekly, 2 monthly (default)
- **Point-in-Time**: Restore to any second in the last 7 days

### M0/M2/M5 (Free/Shared Tier)
No automated backups. Use manual `mongodump`:

```bash
# Install MongoDB Database Tools first
# https://www.mongodb.com/try/download/database-tools

# Full dump (run from any machine with access)
mongodump --uri "mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/<db>" --out ./backup-$(date +%Y%m%d)

# Restore from dump
mongorestore --uri "mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/<db>" ./backup-20260313/
```

**Cron job (Linux/Mac)** — daily at 2 AM:
```bash
0 2 * * * mongodump --uri "$MONGO_URI" --out /backups/tme-$(date +\%Y\%m\%d) 2>&1 | tee /var/log/tme-backup.log
```

## 2. Point-in-Time Restore Test

To verify restore works (M10+ only):
1. Atlas → Cluster → Backup → Restoreable Range
2. Pick a timestamp from 1 hour ago
3. Click "Restore" → "Restore to New Cluster"
4. Name it `tme-restore-test`
5. Wait for provisioning (~5 min)
6. Connect to the test cluster and verify data:
   ```bash
   mongosh "mongodb+srv://<user>:<pass>@tme-restore-test.mongodb.net/tme" --eval "db.users.countDocuments()"
   ```
7. After verification, **delete the test cluster** to avoid charges

## 3. MongoDB Atlas BAA (HIPAA)

> **IMPORTANT**: A Business Associate Agreement (BAA) is REQUIRED for HIPAA compliance when storing PHI in MongoDB Atlas.

### Requirements
- **M10+ dedicated cluster** (BAA not available on M0/M2/M5)
- **Atlas HIPAA-eligible configuration** enabled
- Organization must be on a paid plan

### Steps to Sign BAA
1. Log in to [cloud.mongodb.com](https://cloud.mongodb.com)
2. Go to **Organization** (top-left) → **Settings**
3. Scroll to **"HIPAA Configuration"**
4. Click **"Enable HIPAA"**
5. Review and accept the BAA terms
6. MongoDB will generate a signed BAA document for your records
7. **Download and save the BAA** — you'll need this for audits

### If HIPAA Option Not Visible
- Ensure your organization is on a **paid plan** (M10+)
- Contact MongoDB Atlas Support: support@mongodb.com
- Request: "We need to sign a BAA for HIPAA compliance for organization [your org name]"

### After BAA is Signed
- Enable **Encryption at Rest** (Atlas → Security → Encryption at Rest)
- Enable **Audit Logging** (Atlas → Security → Database Auditing)
- Enable **Network Peering** or **PrivateLink** for production (no public internet)
- Review: [MongoDB Atlas HIPAA Best Practices](https://www.mongodb.com/docs/atlas/reference/atlas-hipaa/)

## 4. Current Tier Check

To check your current tier:
1. Atlas → Clusters → Your Cluster
2. Look at the **Cluster Tier** label (M0, M2, M5, M10, M20, etc.)
3. If M0: Consider upgrading to M10 ($57/mo) for BAA + automated backups
