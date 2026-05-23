# Skills Reference

## Overview

The CAT Bootcamp Feedback platform includes a set of automation skills located in the [`/skills`](../skills/) directory. These are standalone tools that process feedback data and produce actionable outputs.

## Available Skills

### Feedback Report Generator

**Location:** `/skills/feedback-report/`

Generates a branded PDF report from feedback CSV exports. The report includes speaker and module rankings, content depth analysis, attendee comments, and data-driven recommendations.

**Quick Start:**

```bash
pip install fpdf2 Pillow
python skills/feedback-report/generate_report.py <path-to-csv> [output.pdf]
```

**Input:** CSV export from the feedback system (via Admin > Export)

**Output:** Multi-page branded PDF with:
- Executive summary with key metrics
- Speaker performance rankings and insights
- Module satisfaction rankings
- Selected attendee comments per module
- What went well / areas for improvement
- Actionable recommendations for future events

**Full documentation:** [`/skills/feedback-report/README.md`](../skills/feedback-report/README.md)

---

## Adding New Skills

See [`/skills/README.md`](../skills/README.md) for the standard structure and conventions when adding new skills to the platform.
