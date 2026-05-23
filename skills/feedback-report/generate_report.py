"""
CAT Bootcamp Series - Training Feedback Report Generator
=========================================================
Generates a branded PDF report from training event feedback CSV exports.

Usage:
    python generate_report.py <input_csv> [output_pdf]

If output_pdf is not specified, saves to the same directory as the input CSV.
"""

import csv
import sys
import os
import statistics
from datetime import datetime
from fpdf import FPDF
from collections import defaultdict

# ============================================================
# BRAND CONFIGURATION
# ============================================================
DARK_NAVY = (9, 31, 44)
ACCENT_PINK = (208, 67, 160)
LIGHT_BLUE = (209, 234, 247)
LAVENDER = (211, 211, 241)
LIGHT_PINK = (245, 215, 234)
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
LOGO_PATH = os.path.join(SCRIPT_DIR, 'assets', 'cat-logo.png')


# ============================================================
# PDF CLASS WITH BRANDING
# ============================================================
class ThemedPDF(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_fill_color(*DARK_NAVY)
            self.rect(0, 0, 210, 12, 'F')
            self.set_fill_color(*ACCENT_PINK)
            self.rect(0, 12, 210, 1.5, 'F')
            if os.path.exists(LOGO_PATH):
                self.image(LOGO_PATH, 170, 1.5, 12)
            self.ln(18)

    def footer(self):
        self.set_y(-15)
        self.set_font('Helvetica', 'I', 8)
        self.set_text_color(100, 100, 100)
        self.cell(0, 10, f'CAT Bootcamp Series - Training Feedback Report | Page {self.page_no()}', align='C')

    def section_title(self, title):
        self.set_font('Helvetica', 'B', 16)
        self.set_text_color(*DARK_NAVY)
        self.cell(0, 10, title, new_x='LMARGIN', new_y='NEXT')
        self.set_fill_color(*ACCENT_PINK)
        self.rect(10, self.get_y(), 60, 0.8, 'F')
        self.ln(5)

    def sub_title(self, title):
        self.set_font('Helvetica', 'B', 12)
        self.set_text_color(*DARK_NAVY)
        self.cell(0, 8, title, new_x='LMARGIN', new_y='NEXT')
        self.ln(1)

    def body_text(self, text):
        self.set_font('Helvetica', '', 10)
        self.set_text_color(40, 40, 40)
        self.multi_cell(0, 5.5, text)

    def bullet(self, text):
        self.set_font('Helvetica', '', 10)
        self.set_text_color(40, 40, 40)
        self.cell(5)
        x = self.get_x()
        y = self.get_y()
        self.set_fill_color(*ACCENT_PINK)
        self.ellipse(x, y + 1.5, 2, 2, 'F')
        self.cell(5)
        self.multi_cell(0, 5.5, text)
        self.ln(1)

    def stat_box(self, label, value, x, y, w=55, h=22):
        self.set_fill_color(*LIGHT_BLUE)
        self.rect(x, y, w, h, 'F')
        self.set_xy(x, y + 2)
        self.set_font('Helvetica', 'B', 16)
        self.set_text_color(*DARK_NAVY)
        self.cell(w, 10, value, align='C')
        self.set_xy(x, y + 12)
        self.set_font('Helvetica', '', 8)
        self.set_text_color(80, 80, 80)
        self.cell(w, 6, label, align='C')


# ============================================================
# DATA ANALYSIS
# ============================================================
def analyze_data(csv_path):
    """Read and analyze feedback CSV data."""
    rows = []
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)

    if not rows:
        print("ERROR: No data found in CSV file.")
        sys.exit(1)

    # By module
    modules = defaultdict(lambda: {
        'speaker_scores': [], 'module_scores': [], 'depth': [], 'comments': [], 'speaker': ''
    })
    for row in rows:
        mod = row['Module Name']
        modules[mod]['speaker'] = row['Speaker Name']
        try:
            modules[mod]['speaker_scores'].append(int(row['Speaker Knowledge']))
        except (ValueError, KeyError):
            pass
        try:
            modules[mod]['module_scores'].append(int(row['Module Satisfaction']))
        except (ValueError, KeyError):
            pass
        modules[mod]['depth'].append(row.get('Content Depth', ''))
        comment = row.get('Additional Comments', '').strip()
        if comment and comment.lower() != 'na':
            modules[mod]['comments'].append(comment)

    # Overall stats
    all_speaker = [int(r['Speaker Knowledge']) for r in rows if r.get('Speaker Knowledge', '').isdigit()]
    all_module = [int(r['Module Satisfaction']) for r in rows if r.get('Module Satisfaction', '').isdigit()]
    all_depth = [r.get('Content Depth', '') for r in rows]

    depth_counts = defaultdict(int)
    for d in all_depth:
        if d:
            depth_counts[d] += 1

    # By speaker
    speakers = defaultdict(lambda: {'speaker_scores': [], 'module_scores': [], 'modules': set()})
    for row in rows:
        sp = row['Speaker Name']
        speakers[sp]['modules'].add(row['Module Name'])
        try:
            speakers[sp]['speaker_scores'].append(int(row['Speaker Knowledge']))
        except (ValueError, KeyError):
            pass
        try:
            speakers[sp]['module_scores'].append(int(row['Module Satisfaction']))
        except (ValueError, KeyError):
            pass

    return {
        'rows': rows,
        'modules': modules,
        'speakers': speakers,
        'all_speaker': all_speaker,
        'all_module': all_module,
        'depth_counts': depth_counts,
    }


def get_event_name(rows):
    """Try to infer event name from event codes."""
    codes = set(r.get('Event Code', '') for r in rows)
    codes.discard('')
    if codes:
        return list(codes)[0]
    return 'Training Event'


def get_date_range(rows):
    """Get the date range of the feedback submissions."""
    dates = []
    for r in rows:
        ts = r.get('Submitted At', '')
        if ts:
            try:
                dt = datetime.fromisoformat(ts.replace('Z', '+00:00'))
                dates.append(dt)
            except:
                pass
    if dates:
        min_d = min(dates)
        max_d = max(dates)
        return f'{min_d.strftime("%B %d")}-{max_d.strftime("%d, %Y")}'
    return datetime.now().strftime('%B %Y')


# ============================================================
# INSIGHT GENERATION
# ============================================================
def generate_speaker_insights(speakers, modules):
    """Generate insights for each speaker based on data and comments."""
    insights = {}
    for sp, data in speakers.items():
        avg_sk = statistics.mean(data['speaker_scores']) if data['speaker_scores'] else 0
        avg_ms = statistics.mean(data['module_scores']) if data['module_scores'] else 0

        # Gather all comments for this speaker's modules
        all_comments = []
        for mod_name in data['modules']:
            all_comments.extend(modules[mod_name]['comments'])

        # Analyze depth feedback for this speaker
        depth_issues = defaultdict(int)
        for mod_name in data['modules']:
            for d in modules[mod_name]['depth']:
                if d and d != 'Just Right':
                    depth_issues[d] += 1

        strengths = []
        improvements = []

        if avg_sk >= 4.7:
            strengths.append('Exceptionally high knowledge ratings.')
        elif avg_sk >= 4.5:
            strengths.append('Strong knowledge ratings from attendees.')
        elif avg_sk >= 4.0:
            strengths.append('Solid knowledge ratings.')

        if avg_ms >= 4.7:
            strengths.append('Outstanding module satisfaction scores.')
        elif avg_ms >= 4.5:
            strengths.append('High module satisfaction.')

        # Check for positive comment themes
        positive_keywords = ['excellent', 'great', 'amazing', 'love', 'best', 'fantastic', 'superb', 'informative', 'helpful', 'clear']
        positive_count = sum(1 for c in all_comments if any(k in c.lower() for k in positive_keywords))
        if positive_count > 5:
            strengths.append(f'Received {positive_count} explicitly positive comments from attendees.')

        # Check for improvement themes
        if depth_issues.get('Too Technical', 0) > 3:
            improvements.append('Some content rated as too technical. Consider adjusting depth for mixed audiences.')
        if depth_issues.get('Too Low Level', 0) > 3:
            improvements.append('Some content rated as too low level. Consider adding more advanced material.')

        # Check for demo/time requests
        demo_requests = sum(1 for c in all_comments if 'demo' in c.lower() or 'live' in c.lower())
        if demo_requests > 2:
            improvements.append('Multiple requests for more live demos and demonstrations.')

        time_requests = sum(1 for c in all_comments if 'time' in c.lower() or 'rush' in c.lower())
        if time_requests > 2:
            improvements.append('Feedback suggests more time may be needed for covered content.')

        if not strengths:
            strengths.append('Competent delivery across assigned modules.')
        if not improvements:
            improvements.append('No major improvement areas identified from feedback data.')

        insights[sp] = {
            'strengths': ' '.join(strengths),
            'improve': ' '.join(improvements),
        }

    return insights


def generate_overall_insights(data):
    """Generate what went well and areas for improvement."""
    modules = data['modules']
    all_comments = []
    for mod_data in modules.values():
        all_comments.extend(mod_data['comments'])

    went_well = []
    to_improve = []

    overall_speaker_avg = statistics.mean(data['all_speaker']) if data['all_speaker'] else 0
    overall_module_avg = statistics.mean(data['all_module']) if data['all_module'] else 0

    # Overall satisfaction
    if overall_speaker_avg >= 4.5:
        went_well.append(f'Speaker knowledge rated very high (overall {overall_speaker_avg:.2f}/5), showing presenters were credible subject matter experts.')
    if overall_module_avg >= 4.5:
        went_well.append(f'Module satisfaction was excellent (overall {overall_module_avg:.2f}/5) across all sessions.')

    # Depth calibration
    total_depth = sum(data['depth_counts'].values())
    if total_depth > 0:
        jr_pct = (data['depth_counts'].get('Just Right', 0) / total_depth) * 100
        if jr_pct >= 70:
            went_well.append(f'Content depth well-calibrated with {jr_pct:.0f}% of responses marking it "Just Right".')

    # Lab feedback
    lab_positive = sum(1 for c in all_comments if 'lab' in c.lower() and any(k in c.lower() for k in ['great', 'excellent', 'good', 'helpful', 'love', 'best']))
    if lab_positive > 3:
        went_well.append('Hands-on labs consistently praised as practical, well-written, and applicable to real-world scenarios.')

    # Find top module
    module_rankings = []
    for mod, mod_data in modules.items():
        if mod_data['module_scores']:
            avg = statistics.mean(mod_data['module_scores'])
            module_rankings.append((mod, avg, mod_data['speaker']))
    module_rankings.sort(key=lambda x: x[1], reverse=True)

    if module_rankings:
        top = module_rankings[0]
        went_well.append(f'Top-rated module: "{top[0]}" by {top[2]} with {top[1]:.2f}/5 satisfaction.')

    # Improvement areas from comments
    ui_issues = sum(1 for c in all_comments if 'ui' in c.lower() or 'outdated' in c.lower() or 'instruction' in c.lower())
    if ui_issues > 2:
        to_improve.append('Lab instructions need UI updates: Multiple attendees noted instructions did not match the current interface.')

    time_issues = sum(1 for c in all_comments if 'time' in c.lower() or 'rush' in c.lower() or 'longer' in c.lower())
    if time_issues > 2:
        to_improve.append('More time needed: Several modules reported as rushed. Consider extending lab time or reducing scope.')

    demo_issues = sum(1 for c in all_comments if 'demo' in c.lower() and ('more' in c.lower() or 'live' in c.lower()))
    if demo_issues > 2:
        to_improve.append('Add more live demos: Attendees consistently requested more live demonstrations and walkthroughs.')

    depth_too_tech = data['depth_counts'].get('Too Technical', 0)
    depth_too_low = data['depth_counts'].get('Too Low Level', 0)
    if depth_too_tech > 10:
        to_improve.append(f'{depth_too_tech} responses rated content as "Too Technical". Consider audience leveling for mixed groups.')
    if depth_too_low > 10:
        to_improve.append(f'{depth_too_low} responses rated content as "Too Low Level". Consider adding deeper technical tracks.')

    # Generic fallbacks
    if not went_well:
        went_well.append('Training event delivered successfully with positive overall reception.')
    if not to_improve:
        to_improve.append('Consider collecting more detailed qualitative feedback for actionable improvement areas.')

    return went_well, to_improve


# ============================================================
# PDF GENERATION
# ============================================================
def generate_pdf(data, output_path):
    """Generate the branded PDF report."""
    rows = data['rows']
    modules = data['modules']
    speakers = data['speakers']
    depth_counts = data['depth_counts']

    overall_speaker_avg = statistics.mean(data['all_speaker']) if data['all_speaker'] else 0
    overall_module_avg = statistics.mean(data['all_module']) if data['all_module'] else 0

    event_name = get_event_name(rows)
    date_range = get_date_range(rows)

    pdf = ThemedPDF()
    pdf.set_auto_page_break(auto=True, margin=20)

    # ===== TITLE PAGE =====
    pdf.add_page()
    pdf.set_fill_color(*DARK_NAVY)
    pdf.rect(0, 0, 210, 297, 'F')

    if os.path.exists(LOGO_PATH):
        pdf.image(LOGO_PATH, 75, 30, 60)

    pdf.set_y(105)
    pdf.set_font('Helvetica', 'B', 26)
    pdf.set_text_color(*WHITE)
    pdf.cell(0, 14, 'Training Event', align='C', new_x='LMARGIN', new_y='NEXT')
    pdf.cell(0, 14, 'Feedback Report', align='C', new_x='LMARGIN', new_y='NEXT')

    pdf.ln(8)
    pdf.set_font('Helvetica', '', 14)
    pdf.set_text_color(*LIGHT_BLUE)
    pdf.cell(0, 8, 'Copilot Studio Architecture Bootcamp', align='C', new_x='LMARGIN', new_y='NEXT')
    pdf.cell(0, 8, date_range, align='C', new_x='LMARGIN', new_y='NEXT')

    pdf.ln(10)
    pdf.set_fill_color(*ACCENT_PINK)
    pdf.rect(60, pdf.get_y(), 90, 1, 'F')

    pdf.ln(15)
    pdf.set_font('Helvetica', '', 11)
    pdf.set_text_color(180, 200, 220)
    pdf.cell(0, 7, f'{len(rows)} Responses  |  {len(modules)} Modules  |  {len(speakers)} Speakers', align='C', new_x='LMARGIN', new_y='NEXT')

    pdf.ln(30)
    pdf.set_font('Helvetica', 'I', 9)
    pdf.set_text_color(120, 140, 160)
    pdf.cell(0, 7, f'Report Generated: {datetime.now().strftime("%B %d, %Y")}', align='C', new_x='LMARGIN', new_y='NEXT')

    # ===== EXECUTIVE SUMMARY =====
    pdf.add_page()
    pdf.section_title('Executive Summary')
    pdf.body_text(
        f'This report summarizes {len(rows)} feedback responses collected across '
        f'{len(modules)} training modules delivered by {len(speakers)} speakers. '
        f'Ratings use a 1-5 scale with 5 being the best.'
    )
    pdf.ln(8)

    # Stat boxes
    y = pdf.get_y()
    pdf.stat_box('Speaker Knowledge (Avg)', f'{overall_speaker_avg:.2f} / 5', 15, y)
    pdf.stat_box('Module Satisfaction (Avg)', f'{overall_module_avg:.2f} / 5', 77, y)
    total_depth = sum(depth_counts.values())
    if total_depth > 0:
        jr_pct = (depth_counts.get('Just Right', 0) / total_depth) * 100
    else:
        jr_pct = 0
    pdf.stat_box('Content "Just Right"', f'{jr_pct:.0f}%', 139, y)
    pdf.set_y(y + 30)

    pdf.ln(5)
    pdf.sub_title('Content Depth Assessment')
    pdf.set_font('Helvetica', '', 10)
    pdf.set_text_color(40, 40, 40)
    for k in ['Just Right', 'Too Technical', 'Too Low Level']:
        v = depth_counts.get(k, 0)
        if total_depth > 0:
            pct = (v / total_depth) * 100
        else:
            pct = 0
        pdf.cell(0, 6, f'    {k}: {v} responses ({pct:.1f}%)', new_x='LMARGIN', new_y='NEXT')

    pdf.ln(6)
    went_well, to_improve = generate_overall_insights(data)
    pdf.sub_title('Key Highlights')
    for t in went_well[:6]:
        pdf.bullet(t)

    # ===== SPEAKER PERFORMANCE =====
    pdf.add_page()
    pdf.section_title('Speaker Performance')

    speaker_data = []
    for sp, sdata in speakers.items():
        avg_sk = statistics.mean(sdata['speaker_scores']) if sdata['speaker_scores'] else 0
        avg_ms = statistics.mean(sdata['module_scores']) if sdata['module_scores'] else 0
        n = len(sdata['speaker_scores'])
        mods = list(sdata['modules'])
        speaker_data.append((sp, avg_sk, avg_ms, n, mods))
    speaker_data.sort(key=lambda x: x[1], reverse=True)

    # Table header
    pdf.set_fill_color(*DARK_NAVY)
    pdf.set_text_color(*WHITE)
    pdf.set_font('Helvetica', 'B', 9)
    pdf.cell(45, 8, '  Speaker', border=0, fill=True)
    pdf.cell(28, 8, 'Knowledge', border=0, align='C', fill=True)
    pdf.cell(28, 8, 'Satisfaction', border=0, align='C', fill=True)
    pdf.cell(25, 8, 'Responses', border=0, align='C', fill=True)
    pdf.cell(25, 8, 'Modules', border=0, align='C', fill=True)
    pdf.ln()

    pdf.set_text_color(40, 40, 40)
    pdf.set_font('Helvetica', '', 9)
    for i, (sp, avg_sk, avg_ms, n, mods) in enumerate(speaker_data):
        if i % 2 == 0:
            pdf.set_fill_color(*LIGHT_BLUE)
        else:
            pdf.set_fill_color(*WHITE)
        pdf.cell(45, 7, f'  {sp}', border=0, fill=True)
        pdf.cell(28, 7, f'{avg_sk:.2f}', border=0, align='C', fill=True)
        pdf.cell(28, 7, f'{avg_ms:.2f}', border=0, align='C', fill=True)
        pdf.cell(25, 7, str(n), border=0, align='C', fill=True)
        pdf.cell(25, 7, str(len(mods)), border=0, align='C', fill=True)
        pdf.ln()

    pdf.ln(8)
    pdf.sub_title('Speaker Insights & Recommendations')

    speaker_insights = generate_speaker_insights(speakers, modules)
    for sp, avg_sk, avg_ms, n, mods in speaker_data:
        if pdf.get_y() > 230:
            pdf.add_page()
        pdf.set_font('Helvetica', 'B', 10)
        pdf.set_text_color(*DARK_NAVY)
        pdf.cell(0, 7, f'{sp} (Knowledge: {avg_sk:.2f}, Satisfaction: {avg_ms:.2f})', new_x='LMARGIN', new_y='NEXT')
        pdf.set_font('Helvetica', '', 9)
        if sp in speaker_insights:
            pdf.set_text_color(30, 100, 30)
            pdf.multi_cell(0, 5, f'  Strengths: {speaker_insights[sp]["strengths"]}')
            pdf.ln(1)
            pdf.set_text_color(150, 60, 30)
            pdf.multi_cell(0, 5, f'  Improve: {speaker_insights[sp]["improve"]}')
        pdf.set_text_color(40, 40, 40)
        pdf.ln(4)

    # ===== MODULE PERFORMANCE =====
    pdf.add_page()
    pdf.section_title('Module Performance Rankings')

    module_data = []
    for mod, mod_data in modules.items():
        avg_sk = statistics.mean(mod_data['speaker_scores']) if mod_data['speaker_scores'] else 0
        avg_ms = statistics.mean(mod_data['module_scores']) if mod_data['module_scores'] else 0
        n = len(mod_data['speaker_scores'])
        module_data.append((mod, mod_data['speaker'], avg_sk, avg_ms, n, mod_data['depth'], mod_data['comments']))
    module_data.sort(key=lambda x: x[3], reverse=True)

    # Table
    pdf.set_fill_color(*DARK_NAVY)
    pdf.set_text_color(*WHITE)
    pdf.set_font('Helvetica', 'B', 8)
    pdf.cell(58, 7, '  Module', border=0, fill=True)
    pdf.cell(32, 7, 'Speaker', border=0, align='C', fill=True)
    pdf.cell(22, 7, 'Knowledge', border=0, align='C', fill=True)
    pdf.cell(24, 7, 'Satisfaction', border=0, align='C', fill=True)
    pdf.cell(18, 7, 'Count', border=0, align='C', fill=True)
    pdf.cell(16, 7, 'Rank', border=0, align='C', fill=True)
    pdf.ln()

    pdf.set_text_color(40, 40, 40)
    pdf.set_font('Helvetica', '', 8)
    for i, (mod, speaker, avg_sk, avg_ms, n, depth, comments) in enumerate(module_data):
        if i % 2 == 0:
            pdf.set_fill_color(*LIGHT_BLUE)
        else:
            pdf.set_fill_color(*WHITE)
        name_short = mod[:32] if len(mod) > 32 else mod
        pdf.cell(58, 6, f'  {name_short}', border=0, fill=True)
        pdf.cell(32, 6, speaker, border=0, align='C', fill=True)
        pdf.cell(22, 6, f'{avg_sk:.2f}', border=0, align='C', fill=True)
        pdf.cell(24, 6, f'{avg_ms:.2f}', border=0, align='C', fill=True)
        pdf.cell(18, 6, str(n), border=0, align='C', fill=True)
        pdf.cell(16, 6, f'#{i+1}', border=0, align='C', fill=True)
        pdf.ln()

    # ===== MODULE DETAILS =====
    pdf.add_page()
    pdf.section_title('Module Details & Selected Comments')

    for mod, speaker, avg_sk, avg_ms, n, depth, comments in module_data:
        if pdf.get_y() > 235:
            pdf.add_page()
        pdf.set_font('Helvetica', 'B', 10)
        pdf.set_text_color(*DARK_NAVY)
        pdf.cell(0, 7, mod, new_x='LMARGIN', new_y='NEXT')
        pdf.set_font('Helvetica', '', 9)
        pdf.set_text_color(80, 80, 80)
        pdf.cell(0, 5, f'Speaker: {speaker}  |  Knowledge: {avg_sk:.2f}  |  Satisfaction: {avg_ms:.2f}  |  Responses: {n}', new_x='LMARGIN', new_y='NEXT')

        depth_c = defaultdict(int)
        for d in depth:
            if d:
                depth_c[d] += 1
        depth_str = ', '.join([f'{k}: {v}' for k, v in sorted(depth_c.items(), key=lambda x: -x[1])])
        pdf.cell(0, 5, f'Content Depth: {depth_str}', new_x='LMARGIN', new_y='NEXT')

        if comments:
            pdf.set_font('Helvetica', 'I', 8)
            pdf.set_text_color(100, 100, 100)
            for c in comments[:3]:
                clean = c.replace('\n', ' ').replace('\r', ' ')
                clean = clean.encode('latin-1', errors='replace').decode('latin-1')
                if len(clean) > 115:
                    clean = clean[:112] + '...'
                try:
                    pdf.multi_cell(0, 4, f'"{clean}"')
                except:
                    pass
        pdf.ln(4)

    # ===== WHAT WENT WELL =====
    pdf.add_page()
    pdf.section_title('What Went Well')
    for item in went_well:
        pdf.bullet(item)

    # ===== AREAS FOR IMPROVEMENT =====
    pdf.ln(8)
    pdf.section_title('Areas for Improvement')
    for item in to_improve:
        pdf.bullet(item)

    # ===== RECOMMENDATIONS =====
    pdf.add_page()
    pdf.section_title('Recommendations for Future Events')

    recommendations = generate_recommendations(data, went_well, to_improve)
    pdf.set_font('Helvetica', '', 10)
    pdf.set_text_color(40, 40, 40)
    for i, rec in enumerate(recommendations, 1):
        pdf.set_font('Helvetica', 'B', 10)
        pdf.set_text_color(*ACCENT_PINK)
        pdf.cell(8, 6, f'{i}.')
        pdf.set_font('Helvetica', '', 10)
        pdf.set_text_color(40, 40, 40)
        pdf.multi_cell(0, 5.5, rec)
        pdf.ln(2)

    # Save
    pdf.output(output_path)
    return overall_speaker_avg, overall_module_avg


def generate_recommendations(data, went_well, to_improve):
    """Generate actionable recommendations based on analysis."""
    recs = []
    all_comments = []
    for mod_data in data['modules'].values():
        all_comments.extend(mod_data['comments'])

    # Based on improvement areas
    if any('UI' in t or 'instruction' in t for t in to_improve):
        recs.append('Update all lab instructions to match current UI. Validate each lab end-to-end on the actual training environment before delivery.')

    if any('time' in t.lower() or 'rush' in t.lower() for t in to_improve):
        recs.append('Increase lab time by 15-20 minutes for complex modules, or split them into sequential parts.')

    if any('demo' in t.lower() for t in to_improve):
        recs.append('Add more live demonstrations and recorded demo segments to supplement slide-based content.')

    if any('technical' in t.lower() for t in to_improve):
        recs.append('Consider audience leveling - provide optional advanced/beginner tracks or pre-requisite assessments.')

    # Generic good practices
    recs.append('Provide all presentation materials (PPT, lab docs) as pre-downloads at session start.')
    recs.append('Schedule complex, high-value topics in morning time slots when attendee focus is highest.')
    recs.append('Add post-training resources: step-by-step guides, common pitfalls docs, and extended learning links.')
    recs.append('Create industry-specific use case starter kits as take-home reference material.')

    # Comment-driven
    use_case_requests = sum(1 for c in all_comments if 'use case' in c.lower() or 'real world' in c.lower() or 'example' in c.lower())
    if use_case_requests > 3:
        recs.append('Add real-world use case examples for each module - this was a frequent attendee request.')

    walkthrough_requests = sum(1 for c in all_comments if 'walkthrough' in c.lower() or 'walk through' in c.lower() or 'walk thru' in c.lower())
    if walkthrough_requests > 2:
        recs.append('Add "lab walkthrough" segments where the trainer completes the lab live before attendees attempt independently.')

    return recs[:12]  # Cap at 12 recommendations


# ============================================================
# MAIN
# ============================================================
def main():
    if len(sys.argv) < 2:
        print("Usage: python generate_report.py <input_csv> [output_pdf]")
        print("\nGenerates a branded CAT Bootcamp Series PDF report from feedback CSV data.")
        sys.exit(1)

    csv_path = sys.argv[1]
    if not os.path.exists(csv_path):
        print(f"ERROR: File not found: {csv_path}")
        sys.exit(1)

    if len(sys.argv) >= 3:
        output_path = sys.argv[2]
    else:
        csv_dir = os.path.dirname(os.path.abspath(csv_path))
        today = datetime.now().strftime('%Y-%m-%d')
        output_path = os.path.join(csv_dir, f'Training_Feedback_Report_{today}.pdf')

    print(f"Reading feedback data from: {csv_path}")
    data = analyze_data(csv_path)

    print(f"Analyzing {len(data['rows'])} responses across {len(data['modules'])} modules...")
    print(f"Generating PDF report...")

    speaker_avg, module_avg = generate_pdf(data, output_path)

    print(f"\n{'='*60}")
    print(f"  Report saved to: {output_path}")
    print(f"  Overall Speaker Knowledge: {speaker_avg:.2f} / 5.00")
    print(f"  Overall Module Satisfaction: {module_avg:.2f} / 5.00")
    print(f"  Total Responses: {len(data['rows'])}")
    print(f"  Modules: {len(data['modules'])}")
    print(f"  Speakers: {len(data['speakers'])}")
    print(f"{'='*60}")


if __name__ == '__main__':
    main()
