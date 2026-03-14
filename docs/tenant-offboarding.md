# Tenant Off-Boarding Procedure

## Overview
When a beta tester finishes their trial or requests data deletion, follow this HIPAA-compliant process.

## Prerequisites
- Node.js installed on your machine
- `.env` with `MONGO_URI` configured
- Admin/Platform Owner authorization

## Steps

### 1. Notify the Company
Send formal notice at least **7 days** before data deletion:
- What data will be deleted
- Deadline for any data export requests
- Contact for questions

### 2. Export Data (If Requested)
```bash
# Export company-specific data
mongodump --uri "$MONGO_URI" --query '{"companyId":"c5"}' --out ./export-c5
```

### 3. List Companies (Verify Target)
```bash
node scripts/wipe-tenant.js --list
```

### 4. Execute Wipe
```bash
# By company ID
node scripts/wipe-tenant.js --company-id c5 --confirm

# By account number
node scripts/wipe-tenant.js --account TME-C-0005 --confirm
```

### 5. What Gets Deleted
| Collection | Filter |
|------------|--------|
| Users | All with matching companyId (except PLATFORM_OWNER) |
| Work Orders | All with matching companyId |
| Assets | All with matching companyId |
| Inventory | All with matching companyId |
| Purchase Orders | All with matching companyId |
| Sensor Readings | All with matching companyId |
| Notifications | All with matching companyId |
| Clients | All with matching companyId |
| Company | The company document itself |

### 6. What's Preserved
- **PLATFORM_OWNER account** — never deleted
- **HIPAA audit entry** — a `TENANT_WIPED` log is created BEFORE deletion

### 7. Post-Wipe Verification
```bash
# Verify no data remains
node scripts/wipe-tenant.js --list
```

### 8. Document the Off-Boarding
Record in your internal log:
- Date of wipe
- Reason (trial ended, customer request, etc.)
- Who authorized it
- Confirmation that HIPAA audit entry exists
