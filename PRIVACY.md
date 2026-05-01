# Privacy Policy & Data Collection

**CAT Bootcamp Feedback Application**
**Effective Date:** February 6, 2026
**Last Updated:** February 6, 2026

---

## Overview

The CAT Bootcamp Feedback Application is designed with privacy as a core principle. We collect **only anonymous feedback data** necessary to improve training quality. **No personally identifiable information (PII) is collected.**

---

## Data Collection Summary

### ✅ What We Collect

The feedback form collects the following **anonymous, non-identifying data**:

| Data Field | Type | Purpose | Required |
|------------|------|---------|----------|
| **Event Code** | Text | Links feedback to the training event | Yes |
| **Module ID** | Number | Identifies which module the feedback is for | Yes |
| **Speaker Knowledge Rating** | Number (1-5) | Evaluates instructor expertise | Yes |
| **Content Depth Assessment** | Selection | Gauges technical appropriateness | Yes |
| **Module Satisfaction Rating** | Number (1-5) | Measures overall satisfaction | Yes |
| **Additional Comments** | Text (max 1000 chars) | Captures qualitative feedback | No |
| **Submission Timestamp** | DateTime | Records when feedback was submitted | Auto |

### ❌ What We DO NOT Collect

We explicitly **DO NOT** collect any personally identifiable information:

- ❌ Names
- ❌ Email addresses
- ❌ Phone numbers
- ❌ IP addresses
- ❌ Device identifiers
- ❌ Browser fingerprints
- ❌ User agent strings
- ❌ Geographic location
- ❌ Session cookies (beyond session management)
- ❌ Any other identifying information

### Live counter — organizer view

The live counter screen (`count.html`) is an **organizer-facing display**. It shows aggregate feedback counts and a QR code that points submitters to the feedback form. The live counter:

- Does not collect any data about the organizer or any submitter
- Does not use cookies of any kind (zero `document.cookie` usage anywhere in the codebase)
- Stores user-display preferences (theme, sound on/off, refresh interval, celebration level) in browser `sessionStorage` only — these are erased when the browser session ends and never sent to a server
- Includes a module switcher that lets the organizer change which module is displayed without reloading the page; this affects display only and does not introduce any new data collection or persistence

---

## How Data is Used

### Primary Purpose
Feedback data is used **exclusively** to:

1. **Improve Training Quality** - Identify strengths and areas for improvement in module content and delivery
2. **Evaluate Speaker Performance** - Provide constructive feedback to instructors
3. **Optimize Content Depth** - Ensure technical level matches audience needs
4. **Aggregate Analytics** - Generate statistical insights on training effectiveness

### Data Access
- **Administrators** - Authorized training coordinators and administrators can view aggregated and individual feedback
- **Speakers** - May receive anonymized feedback summaries relevant to their sessions
- **Analysts** - Statistical reports may be generated for program evaluation

### Data Sharing
- Feedback data is **not sold** to third parties
- Feedback data is **not shared** outside the training organization
- Aggregate statistics (with no identifying information) may be included in reports

---

## Data Retention

| Data Type | Retention Period | Deletion Policy |
|-----------|------------------|-----------------|
| **Active Event Feedback** | Duration of training program + 2 years | Retained for program improvement |
| **Archived Feedback** | Up to 5 years | Retained for historical analysis |
| **Deleted Feedback** | Immediate | Permanently removed from database |

**User Rights:**
- Feedback is anonymous, so individual deletion requests cannot be processed
- Event organizers can delete all feedback associated with an event
- Bulk deletion capabilities are available to administrators

---

## Technical Security

### Data Protection Measures

1. **Encryption in Transit**
   - All data transmitted via HTTPS/TLS encryption
   - Secure connections between frontend and backend

2. **Encryption at Rest**
   - Azure SQL Database with encryption enabled
   - Secure storage of all feedback data

3. **Access Control**
   - Admin panel requires authentication
   - Role-based access control (RBAC)
   - Session management with expiration

4. **Database Security**
   - Parameterized queries (SQL injection prevention)
   - Azure SQL firewall rules
   - Regular automated backups

---

## Anonymous Feedback Guidelines

### For Feedback Providers

**Please DO:**
- ✅ Provide honest, constructive feedback
- ✅ Comment on content quality and delivery
- ✅ Suggest improvements

**Please DO NOT:**
- ❌ Include your name or contact information
- ❌ Include names of other attendees
- ❌ Include sensitive or confidential information
- ❌ Include any personally identifiable information

**Note:** While we do not collect PII, users are responsible for not voluntarily including personal information in free-text comment fields.

---

## Compliance

### Regulatory Alignment

This application is designed to comply with:

- **GDPR** (General Data Protection Regulation) - Anonymous data collection
- **CCPA** (California Consumer Privacy Act) - No personal information collected
- **FERPA** (if applicable to educational contexts) - No student records
- **Internal Privacy Policies** - Organization-specific requirements

### Data Classification

All collected feedback is classified as:
- **Public or Internal Use Only** - No confidential or sensitive data
- **Non-Personal Data** - Cannot be used to identify individuals
- **Aggregate Statistical Data** - When used in reports

---

## User Rights

Since all feedback is anonymous and non-identifying:

- **Right to Access** - Not applicable (no PII collected)
- **Right to Deletion** - Feedback is anonymous; individual requests cannot be fulfilled
- **Right to Correction** - Not applicable (no personal data)
- **Right to Portability** - Not applicable (no personal data)

**Event-Level Deletion:**
- Event organizers can delete all feedback for specific events
- Bulk deletion available through admin panel

---

## Changes to This Policy

We reserve the right to update this privacy policy. Changes will be:
- Documented with effective dates
- Communicated to users through the application
- Posted in the repository and documentation

**Version History:**
- **v1.0** (Feb 6, 2026) - Initial privacy policy, PII collection removed

---

## Microsoft Privacy Statement

This application is part of Microsoft's training programs. For Microsoft's general privacy practices, please see:

**[Microsoft Privacy Statement](https://privacy.microsoft.com/en-us/privacystatement)**

This CAT Bootcamp Feedback application follows privacy-first principles aligned with Microsoft's commitment to data protection and user privacy.

---

## Contact Information

For questions about this privacy policy or data practices:

- **Repository:** [github.com/microsoft/CATBootcampFeedback](https://github.com/microsoft/CATBootcampFeedback)
- **Issues:** Submit questions via GitHub Issues
- **Documentation:** See README.md for additional information
- **Microsoft Privacy:** [privacy.microsoft.com](https://privacy.microsoft.com/)

---

## Transparency Commitment

This application is **open source**. All code, including data collection mechanisms, is publicly available for review:

- **Frontend Code:** `feedback.html`, `feedback.js`
- **Backend Code:** `api/SubmitFeedback/` directory
- **Database Schema:** `DATABASE-REFERENCE.md`

You can verify our privacy claims by reviewing the source code.

---

## Summary

🔒 **Privacy First:** No PII collected
📊 **Anonymous Feedback:** All responses are non-identifying
🔐 **Secure Storage:** Encrypted data transmission and storage
📖 **Transparent:** Open source for verification
✅ **Compliant:** Aligned with GDPR, CCPA, and best practices

---

**For the full database schema and technical details, see:**
- `DATABASE-REFERENCE.md` - Complete database structure
- `README.md` - Application overview and features
- Source code repository - Full transparency

---

*This privacy policy is part of the CAT Bootcamp Feedback Application documentation.*
