# Skills

This directory contains automation skills that extend the CAT Bootcamp feedback platform with reusable tools and report generators.

## Available Skills

| Skill | Description | Docs |
|-------|-------------|------|
| [feedback-report](./feedback-report/) | Generates branded PDF reports from training feedback CSV exports | [README](./feedback-report/README.md) |

## Structure

```
skills/
├── README.md                    # This file (skill index)
├── feedback-report/             # PDF report generator
│   ├── README.md
│   ├── generate_report.py
│   └── assets/
│       └── cat-logo.png
└── <future-skill>/              # Additional skills follow the same pattern
    ├── README.md
    ├── <main_script>
    └── assets/
```

## Adding a New Skill

1. Create a new directory under `skills/` with a descriptive kebab-case name
2. Include a `README.md` with usage instructions, input/output format, and dependencies
3. Place any assets (logos, templates) in an `assets/` subdirectory
4. Update this index table with the new skill entry
5. If the skill integrates with an AI assistant, document the expected workflow in the skill's README

## Shared Assets

The `feedback-report/assets/` directory contains the CAT Bootcamp Series logo used across branded outputs. Other skills that need the same branding should reference it from there rather than duplicating.

## Dependencies

Each skill documents its own dependencies in its README. Common requirements:

- Python 3.10+
- See individual skill READMEs for package requirements
