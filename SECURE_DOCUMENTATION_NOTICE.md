# 🔒 Secure Documentation Notice

## Important Security Information

Some documentation files containing sensitive information (passwords, connection strings, resource identifiers) have been moved to a secure location **outside of this repository**.

### 📍 Location of Secure Files

**Desktop Location:** `Desktop/Secure_CAT_Files/`

This folder contains the complete, unredacted versions of documentation with actual credentials and sensitive infrastructure details.

---

## 🗂️ Secure Files Available

### Critical Credentials
- **CREDENTIALS_MASTER.md** - Master file with all credentials in one place
  - Database passwords (dev & prod)
  - Admin panel credentials
  - Azure resource details
  - Connection strings
  - Quick access commands

### Complete Documentation (Unredacted)
- **QUICK_START_GUIDE_SECURE.md** - Full setup guide with actual passwords
- **SPECIFICATION_SECURE.md** - Complete specification with credentials
- **README_SECURE.md** - Full README with actual values
- **ADMIN_SETUP_GUIDE_COMPLETE.md** - Complete admin setup
- **DATABASE-REFERENCE_SECURE.md** - Connection strings and credentials
- **DEPLOYMENT-RUNBOOK_SECURE.md** - Operational procedures with resource names
- **PRODUCTION-SETUP-SUMMARY_SECURE.md** - Complete production details

### Infrastructure Documentation
- **infrastructure/production-architecture_SECURE.md** - Complete architecture with resource names
- **infrastructure/environment-variables_SECURE.md** - All environment configurations

---

## 🔐 Security Policy

### DO NOT:
- ❌ Commit files with actual passwords to Git
- ❌ Share credentials via email, Slack, or other unsecured channels
- ❌ Store sensitive files in cloud storage without encryption
- ❌ Include actual resource names in public documentation

### DO:
- ✅ Keep secure files on local Desktop only
- ✅ Use `[REDACTED]` placeholders in repository documentation
- ✅ Reference secure documentation location when needed
- ✅ Back up secure files to encrypted storage
- ✅ Rotate credentials regularly

---

## 📋 Repository Documentation Status

The following files in this repository have been **sanitized** and contain placeholders instead of actual credentials:

- ✅ `README.md` - Credentials redacted
- ✅ `QUICK_START_GUIDE.md` - Passwords removed
- ✅ `SPECIFICATION.md` - Demo credentials redacted
- ✅ `ADMIN_SETUP_GUIDE.md` - Already sanitized
- ✅ `DATABASE-REFERENCE.md` - Connection strings use placeholders

**Safe to commit:** These files no longer contain sensitive information.

---

## 🆘 Need Access to Secure Documentation?

If you need access to the complete documentation with actual credentials:

1. **Check your Desktop:** Look for `Desktop/Secure_CAT_Files/`
2. **Start with CREDENTIALS_MASTER.md:** This file contains all credentials
3. **Refer to specific secure files:** For detailed setup instructions

**For new team members:**
- Secure documentation should be shared via secure channel (encrypted USB, Azure Key Vault, password-protected archive)
- Never share via email or public cloud storage

---

## 🔄 Keeping Documentation in Sync

When updating documentation:

1. **Update the repository version** with placeholders/redacted values
2. **Update the secure version** on Desktop with actual values
3. **Keep both versions aligned** in terms of structure and content

Example:
```markdown
# Repository Version (Public)
Database: [DATABASE_NAME]
Password: [REDACTED - See secure documentation]

# Desktop Version (Private)
Database: CATBootcampFeedback-Prod
Password: [REDACTED - stored in Azure Key Vault; rotate the legacy value]
```

---

## 📞 Questions?

- **Missing secure files?** Check Desktop/Secure_CAT_Files/
- **Need credentials?** See CREDENTIALS_MASTER.md on Desktop
- **Setting up new environment?** Use secure documentation versions

**Remember:** Security through obscurity is not sufficient, but limiting exposure of sensitive information is an important layer of defense.

---

**Last Updated:** February 6, 2026
**Secure Documentation Version:** 1.0
