# Security Improvement Roadmap

This document outlines recommended security enhancements for the CAT Bootcamp Feedback application, prioritized by impact and ease of implementation.

## Current Security Posture ✅

**What We Have:**
- ✅ JWT authentication with bcrypt password hashing
- ✅ Azure Key Vault for JWT secrets
- ✅ HTTPS enforcement across all environments
- ✅ Zero PII collection (GDPR/CCPA compliant)
- ✅ Parameterized SQL queries (SQL injection prevention)
- ✅ Managed identities for Azure resources
- ✅ Separate dev/prod environments with isolated secrets
- ✅ Input validation and sanitization
- ✅ CORS configuration
- ✅ All credentials rotated (Feb 2026)
- ✅ Credentials removed from documentation
- ✅ Demo credentials removed from UI
- ✅ Role-based access control (RBAC) with 6 granular roles
- ✅ Resource-level security (users only see their events/feedback)
- ✅ Comprehensive audit logging of all authenticated actions
- ✅ Per-email rate limiting on recovery endpoints
- ✅ Protected Global Admin account
- ✅ Database-backed user management (replacing env-var JSON)

## Recent Security Actions Completed (Feb 2026) 🎉

**Credential Rotation & Cleanup:**
- ✅ **Feb 7, 2026:** Deployment token rotated and GitHub secret updated
- ✅ **Feb 7, 2026:** SQL Server password rotated (stored in Function App settings)
- ✅ **Feb 7-8, 2026:** Admin passwords rotated with bcrypt (rounds=10)
- ✅ **Feb 7, 2026:** All credentials removed from repository documentation
- ✅ **Feb 7, 2026:** Secure credentials file created on desktop (not in repo)
- ✅ **Feb 8, 2026:** Demo credentials removed from admin login screen
- ✅ **Feb 8, 2026:** Deployed to both development and production environments

**Impact:** Eliminated credential exposure risk from documentation and UI

## Recommended Security Improvements

### Priority 1: Critical (Implement First)

#### 1. Rate Limiting ⭐ HIGH IMPACT -- ✅ IMPLEMENTED

**Current State:** Implemented (IP-based rate limiting on login + per-email rate limiting on recovery endpoints)
**Risk:** ~~Brute force attacks, API abuse, DDoS~~ Mitigated
**Effort:** ~~4-6 hours~~ Done

**Why This Matters:**
Without rate limiting, attackers can:
- Attempt unlimited password guesses on `/api/login`
- Spam feedback submissions
- Overwhelm the API with requests
- Increase infrastructure costs

**Implementation:** Add express-rate-limit middleware to Azure Functions

#### 2. Move SQL Credentials to Key Vault ⭐ HIGH IMPACT

**Current State:** ✅ Password rotated (Feb 2026), but still stored in Function App settings
**Risk:** Credential exposure (medium - rotated but not in Key Vault)
**Effort:** 1-2 hours

**Why This Matters:**
- Consistent with JWT secret management
- Centralized secret rotation
- Audit trail for database access
- Current best practice for Azure

**Next Steps:**
1. Create Key Vault secret for SQL password
2. Update Function App to read from Key Vault
3. Remove plain text password from Function App settings
4. Test database connectivity

#### 3. Content Security Policy (CSP) Headers ⭐ MEDIUM IMPACT

**Current State:** No CSP headers
**Risk:** XSS attacks, clickjacking
**Effort:** 2-3 hours

**Why This Matters:**
- Prevents malicious scripts from running
- Blocks clickjacking attempts
- Industry standard security header

---

### Priority 2: Important (Implement Next)

#### 4. Enhanced Audit Logging -- ✅ IMPLEMENTED

**Effort:** ~~6-8 hours~~ Done

**What is logged (AuditLog table in database):**
- All login attempts (success/failure)
- All CRUD operations (CREATE, UPDATE, DELETE)
- Role assignments/revocations (ASSIGN_ROLE, REMOVE_ROLE)
- Event access grants/revocations (GRANT_ACCESS, REVOKE_ACCESS)
- Password changes and resets
- Unauthorized access attempts
- Key Vault access patterns (via Azure Monitor)

**Set up alerts for:**
- 5+ failed logins in 5 minutes
- Unusual access patterns
- Key Vault access anomalies

#### 5. Comprehensive Input Validation

**Effort:** 8-10 hours

Use a validation library like Joi to:
- Enforce strict input formats
- Prevent injection attacks
- Validate all API inputs
- Provide clear error messages

#### 6. IP Allowlisting for Admin Endpoints

**Effort:** 2-3 hours

**Benefits:**
- Restrict admin access to known IPs
- Additional defense layer
- Easy to implement with middleware

---

### Priority 3: Advanced Features

#### 7. JWT Refresh Tokens

**Effort:** 16-20 hours

**Current:** Single 8-hour JWT token
**Proposed:** Short-lived access token (15 min) + refresh token (7 days)

**Benefits:**
- Reduced exposure window
- Token revocation capability
- Better security/UX balance

#### 8. Multi-Factor Authentication (MFA)

**Effort:** 24-32 hours (TOTP) or 40-60 hours (Azure AD)

**Options:**
- **TOTP** (Google Authenticator, etc.) - Easier to implement
- **Azure AD B2C** - More comprehensive, managed service

**Benefits:**
- Significantly reduces account takeover risk
- Industry standard for admin access
- Compliance requirement for many organizations

#### 9. Role-Based Access Control (RBAC) -- ✅ IMPLEMENTED

**Effort:** ~~20-30 hours~~ Done

**Implemented Roles:**
- **GlobalAdmin** - Full access to everything
- **UserAdmin** - Manage users and role assignments
- **ModuleManager** - Create, edit, delete modules
- **EventCreator** - Create events, manage event-modules
- **FeedbackManager** - View and delete feedback for granted events
- **FeedbackViewer** - Read-only reporting for granted events

**Benefits (realized):**
- Principle of least privilege via 6 granular roles
- Resource-level security via UserEventAccess table
- Comprehensive audit trail via AuditLog table
- Database-backed user management (replaces env-var JSON)

---

### Priority 4: Infrastructure & Automation

#### 10. Azure Front Door + WAF

**Effort:** 16-24 hours
**Cost:** $35-100/month

**What You Get:**
- Web Application Firewall (OWASP Top 10 protection)
- Bot mitigation
- Enhanced DDoS protection
- Global load balancing
- Performance improvements

#### 11. Automated Dependency Scanning

**Effort:** 4-6 hours
**Cost:** Free (GitHub Actions + npm audit)

**Add to CI/CD:**
- npm audit on every PR
- Weekly Snyk scans
- Automatic security alerts
- Block merges with high-severity vulns

#### 12. Automated Secret Rotation

**Effort:** 12-16 hours

Automate monthly rotation of:
- JWT secrets
- SQL passwords
- Any API keys

---

## Implementation Priority Matrix

| Feature | Impact | Effort | Time | Priority |
|---------|--------|--------|------|----------|
| ~~Rate Limiting~~ | ~~High~~ | ~~Medium~~ | ~~4-6h~~ | ✅ Done |
| SQL to Key Vault | High | Low | 1-2h | 🔴 P1 |
| CSP Headers | Medium | Low | 2-3h | 🔴 P1 |
| ~~Enhanced Logging~~ | ~~Medium~~ | ~~Medium~~ | ~~6-8h~~ | ✅ Done |
| Input Validation | Medium | Medium | 8-10h | 🟡 P2 |
| IP Allowlisting | Low | Low | 2-3h | 🟡 P2 |
| Refresh Tokens | Medium | High | 16-20h | 🟢 P3 |
| MFA | High | High | 24-32h | 🟢 P3 |
| ~~RBAC~~ | ~~Medium~~ | ~~High~~ | ~~20-30h~~ | ✅ Done |
| WAF | High | High | 16-24h | 🔵 P4 |
| Dep Scanning | Medium | Low | 4-6h | 🔵 P4 |
| Secret Rotation | Low | High | 12-16h | 🔵 P4 |

## Recommended Implementation Plan

### Phase 1: Quick Wins (Week 1-2) - 9-13 hours
1. ⏳ **Move SQL credentials to Key Vault (1-2h)** - Password rotated, needs Key Vault migration
2. ❌ Add CSP headers (2-3h)
3. ✅ ~~Implement rate limiting~~ -- Done (IP-based + per-email)
4. ❌ Add dependency scanning (4-6h)

**Status:** Rate limiting implemented (March 2026), remaining items in progress
**Total Investment:** ~10-13 hours
**Security Improvement:** ~40%

### Phase 2: Enhanced Protection (Week 3-4) - 16-21 hours
5. ✅ Enhanced audit logging (6-8h)
6. ✅ Input validation improvements (8-10h)
7. ✅ IP allowlisting for admin (2-3h)

**Total Investment:** ~16-21 hours
**Cumulative Improvement:** ~65%

### Phase 3: Advanced Auth (Month 2) - 40-52 hours
8. ✅ Implement MFA (24-32h)
9. ✅ Add refresh token mechanism (16-20h)

**Total Investment:** ~40-52 hours
**Cumulative Improvement:** ~85%

### Phase 4: Infrastructure (Month 3) - 48-70 hours
10. ✅ Implement RBAC (20-30h)
11. ✅ Automated secret rotation (12-16h)
12. ✅ Azure Front Door + WAF (16-24h)

**Total Investment:** ~48-70 hours
**Cumulative Improvement:** ~95%

## Cost Analysis

### One-Time Development
- **Phase 1-3:** ~66-86 hours
- **Phase 4:** ~48-70 hours
- **Total:** ~114-156 hours over 3-4 months

### Ongoing Operational Costs
- **Azure Front Door + WAF:** $35-100/month (optional)
- **Security scanning tools:** $0-50/month
- **Maintenance:** ~4-8 hours/month

### ROI Considerations
**Cost of a security breach:**
- Incident response: $10,000-50,000+
- Reputation damage: Priceless
- Regulatory fines: Varies by compliance
- Downtime costs: $5,000-100,000+

**Investment:** ~$15,000-25,000 in development + $420-1800/year operational
**Protection:** Potentially millions in avoided costs

## Top 3 Priority Items (Updated Feb 2026)

Based on recent credential rotation work, here are the next critical steps:

### 1. ~~Rate Limiting~~ ✅ DONE
**Status:** Implemented -- IP-based rate limiting on login and per-email rate limiting on recovery endpoints

### 2. 🔐 Complete SQL Credentials Migration to Key Vault (1-2 hours)
**Why:** Finish the credential security work already started
**Impact:** Moves last hardcoded credential to secure vault
**Cost:** Free
**Status:** ⏳ Password rotated, needs Key Vault migration
**Progress:** 50% complete

### 3. 🛡️ Content Security Policy Headers (2-3 hours)
**Why:** Industry-standard XSS protection
**Impact:** Prevents entire class of attacks
**Cost:** Free
**Status:** ❌ Not implemented

**Total Time:** 7-11 hours
**Total Cost:** $0
**Security Improvement:** ~40%
**Current Progress:** ~10% (credential rotation completed)

## Questions to Consider

1. **Budget:** How much can we invest in security improvements?
2. **Timeline:** Do we need quick wins or comprehensive overhaul?
3. **Compliance:** Are there regulatory requirements (SOC 2, ISO 27001)?
4. **Risk Tolerance:** What's the acceptable risk level?
5. **Team Size:** How many developers can work on this?

## Next Steps

Would you like me to:
1. **Implement Phase 1** (7-11 hours, high impact, free)
2. **Create detailed implementation plan** for any specific feature
3. **Set up monitoring and alerting** for current security events
4. **Perform security audit** of current codebase
5. **Something else?**

---

## Summary of Progress

### ✅ Completed (Feb 2026)
- Deployment token rotation
- SQL Server password rotation
- Admin password rotation with bcrypt
- Credential removal from all documentation
- Demo credential removal from UI
- Secure desktop credentials file setup
- Deployed to dev and production

### 🚧 In Progress
- SQL credentials migration to Key Vault (50% - rotated, not in vault)

### 📋 Next Up (Priority Order)
1. ~~Rate limiting implementation~~ ✅ Done
2. Complete SQL Key Vault migration (1-2h)
3. Content Security Policy headers (2-3h)
4. ~~Enhanced audit logging~~ ✅ Done (AuditLog table)
5. Input validation improvements (8-10h)

**Estimated Time to Phase 1 Completion:** 7-11 hours remaining

---

**Last Updated:** March 28, 2026
**Next Review:** June 28, 2026
**Status:** Rate limiting, RBAC, audit logging, and database-backed user management implemented. CSP headers and SQL Key Vault migration remain.
