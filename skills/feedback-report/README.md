# Feedback Report Generator

A branded PDF report generator for CAT Bootcamp Series training event feedback data. Produces a professional, themed report with speaker and module analysis, insights, and actionable recommendations.

## Features

- **Branded output** — Uses CAT Bootcamp Series logo, color scheme, and formatting
- **Automated analysis** — Calculates averages, rankings, and distributions from raw feedback data
- **Speaker insights** — Per-speaker strengths and improvement areas derived from scores and comments
- **Module rankings** — Ranked table of all modules by satisfaction score with selected attendee comments
- **Content depth assessment** — Breakdown of "Just Right" vs "Too Technical" vs "Too Low Level"
- **Actionable recommendations** — Data-driven suggestions for future events

## Requirements

- Python 3.10+
- `fpdf2` — PDF generation
- `Pillow` — Image handling

```bash
pip install fpdf2 Pillow
```

## Usage

### Command Line

```bash
python skills/feedback-report/generate_report.py <input_csv> [output_pdf]
```

**Examples:**

```bash
# Output PDF named automatically in the same folder as the CSV
python skills/feedback-report/generate_report.py ./exports/feedback-2026-05-23.csv

# Specify output path
python skills/feedback-report/generate_report.py ./exports/feedback.csv ./reports/May2026_Report.pdf
```

### Input Format

The script expects a CSV export from the CAT feedback system with these columns:

| Column | Description |
|--------|-------------|
| `Module Name` | Name of the training module |
| `Event Code` | Event identifier |
| `Speaker Name` | Presenter name |
| `Date` | Session date (optional) |
| `Speaker Knowledge` | Rating 1-5 (5 = best) |
| `Content Depth` | "Just Right", "Too Technical", or "Too Low Level" |
| `Module Satisfaction` | Rating 1-5 (5 = best) |
| `Additional Comments` | Free-text attendee feedback |
| `Submitted At` | ISO timestamp of submission |

### Output

A multi-page PDF report containing:

1. **Title Page** — Branded cover with event details and response counts
2. **Executive Summary** — Overall scores, depth assessment, and key highlights
3. **Speaker Performance** — Ranked table with per-speaker insights and recommendations
4. **Module Performance** — Ranked table of all modules
5. **Module Details** — Per-module breakdown with selected attendee comments
6. **What Went Well** — Data-driven positive findings
7. **Areas for Improvement** — Identified improvement opportunities
8. **Recommendations** — Actionable suggestions for future events

## Report Branding

The report uses the official CAT Bootcamp Series color scheme:

| Element | Color | Hex |
|---------|-------|-----|
| Headers & Tables | Dark Navy | `#091F2C` |
| Accents & Highlights | Pink | `#D043A0` |
| Stat Boxes & Alt Rows | Light Blue | `#D1EAF7` |
| Background | White | `#FFFFFF` |

The CAT logo is stored in `assets/cat-logo.png` and appears on the title page and in page headers.

## File Structure

```
skills/feedback-report/
├── README.md              # This file
├── generate_report.py     # Main report generator
└── assets/
    └── cat-logo.png       # CAT Bootcamp Series logo
```

## Customization

To adjust branding colors, edit the constants at the top of `generate_report.py`:

```python
DARK_NAVY = (9, 31, 44)
ACCENT_PINK = (208, 67, 160)
LIGHT_BLUE = (209, 234, 247)
```

## Integration with Copilot CLI / Claude Code

This skill is designed to be invoked by AI assistants. The expected workflow:

1. Assistant asks the user for the feedback CSV file path
2. Assistant runs the generator script
3. Assistant summarizes the key findings to the user

See the root `copilot-instructions.md` for integration details.
