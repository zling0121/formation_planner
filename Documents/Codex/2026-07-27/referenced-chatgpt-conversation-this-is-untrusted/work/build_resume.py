from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.style import WD_STYLE_TYPE
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING, WD_TAB_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


OUT = Path("outputs/Ziyue_Ling_NoRILLA_Resume.docx")

# standard_business_brief preset with a named compact_resume_override:
# Letter portrait; 0.55" margins; Arial; 9.35 pt body; 10.25 pt section
# headings; 1.0 line spacing; 0/1.4 pt body rhythm; navy accent.
FONT = "Arial"
NAVY = "1F4E79"
INK = "202124"
MUTED = "555555"


def set_cell_or_run_font(run, size, bold=False, color=INK, italic=False):
    run.font.name = FONT
    run._element.get_or_add_rPr().rFonts.set(qn("w:ascii"), FONT)
    run._element.get_or_add_rPr().rFonts.set(qn("w:hAnsi"), FONT)
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = RGBColor.from_string(color)


def set_keep_with_next(paragraph, enabled=True):
    pPr = paragraph._p.get_or_add_pPr()
    node = pPr.find(qn("w:keepNext"))
    if enabled and node is None:
        pPr.append(OxmlElement("w:keepNext"))
    elif not enabled and node is not None:
        pPr.remove(node)


def add_bottom_border(paragraph, color=NAVY, size="8", space="2"):
    pPr = paragraph._p.get_or_add_pPr()
    pBdr = pPr.find(qn("w:pBdr"))
    if pBdr is None:
        pBdr = OxmlElement("w:pBdr")
        pPr.append(pBdr)
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), size)
    bottom.set(qn("w:space"), space)
    bottom.set(qn("w:color"), color)
    pBdr.append(bottom)


def add_numbering(doc):
    numbering = doc.part.numbering_part.element
    abstract_ids = [
        int(el.get(qn("w:abstractNumId")))
        for el in numbering.findall(qn("w:abstractNum"))
    ]
    num_ids = [int(el.get(qn("w:numId"))) for el in numbering.findall(qn("w:num"))]
    abstract_id = max(abstract_ids, default=0) + 1
    num_id = max(num_ids, default=0) + 1

    abstract = OxmlElement("w:abstractNum")
    abstract.set(qn("w:abstractNumId"), str(abstract_id))
    multi = OxmlElement("w:multiLevelType")
    multi.set(qn("w:val"), "singleLevel")
    abstract.append(multi)
    lvl = OxmlElement("w:lvl")
    lvl.set(qn("w:ilvl"), "0")
    start = OxmlElement("w:start")
    start.set(qn("w:val"), "1")
    num_fmt = OxmlElement("w:numFmt")
    num_fmt.set(qn("w:val"), "bullet")
    lvl_text = OxmlElement("w:lvlText")
    lvl_text.set(qn("w:val"), "•")
    lvl_jc = OxmlElement("w:lvlJc")
    lvl_jc.set(qn("w:val"), "left")
    pPr = OxmlElement("w:pPr")
    tabs = OxmlElement("w:tabs")
    tab = OxmlElement("w:tab")
    tab.set(qn("w:val"), "num")
    tab.set(qn("w:pos"), "300")
    tabs.append(tab)
    ind = OxmlElement("w:ind")
    ind.set(qn("w:left"), "300")
    ind.set(qn("w:hanging"), "150")
    pPr.extend([tabs, ind])
    rPr = OxmlElement("w:rPr")
    r_fonts = OxmlElement("w:rFonts")
    r_fonts.set(qn("w:ascii"), FONT)
    r_fonts.set(qn("w:hAnsi"), FONT)
    rPr.append(r_fonts)
    lvl.extend([start, num_fmt, lvl_text, lvl_jc, pPr, rPr])
    abstract.append(lvl)
    numbering.append(abstract)

    num = OxmlElement("w:num")
    num.set(qn("w:numId"), str(num_id))
    abstract_ref = OxmlElement("w:abstractNumId")
    abstract_ref.set(qn("w:val"), str(abstract_id))
    num.append(abstract_ref)
    numbering.append(num)
    return num_id


def section_heading(doc, text):
    p = doc.add_paragraph(style="Section Heading")
    p.add_run(text.upper())
    add_bottom_border(p)
    set_keep_with_next(p)
    return p


def add_role(doc, organization, location, title, dates):
    p = doc.add_paragraph(style="Role Header")
    p.paragraph_format.tab_stops.add_tab_stop(Inches(7.4), WD_TAB_ALIGNMENT.RIGHT)
    r = p.add_run(organization)
    set_cell_or_run_font(r, 9.55, bold=True)
    r = p.add_run("\t" + location)
    set_cell_or_run_font(r, 9.15, color=MUTED)
    set_keep_with_next(p)

    p2 = doc.add_paragraph(style="Role Subheader")
    p2.paragraph_format.tab_stops.add_tab_stop(Inches(7.4), WD_TAB_ALIGNMENT.RIGHT)
    r = p2.add_run(title)
    set_cell_or_run_font(r, 9.35, italic=True)
    r = p2.add_run("\t" + dates)
    set_cell_or_run_font(r, 9.15, color=MUTED)
    set_keep_with_next(p2)


def bullet(doc, text, num_id):
    p = doc.add_paragraph(style="Resume Bullet")
    pPr = p._p.get_or_add_pPr()
    numPr = OxmlElement("w:numPr")
    ilvl = OxmlElement("w:ilvl")
    ilvl.set(qn("w:val"), "0")
    numId = OxmlElement("w:numId")
    numId.set(qn("w:val"), str(num_id))
    numPr.extend([ilvl, numId])
    pPr.insert(0, numPr)
    r = p.add_run(text)
    set_cell_or_run_font(r, 9.25)
    return p


def add_labeled_line(doc, label, value):
    p = doc.add_paragraph(style="Compact Line")
    r = p.add_run(label + ": ")
    set_cell_or_run_font(r, 9.15, bold=True, color=NAVY)
    r = p.add_run(value)
    set_cell_or_run_font(r, 9.15)
    return p


doc = Document()
section = doc.sections[0]
section.page_width = Inches(8.5)
section.page_height = Inches(11)
section.top_margin = Inches(0.48)
section.bottom_margin = Inches(0.48)
section.left_margin = Inches(0.55)
section.right_margin = Inches(0.55)
section.header_distance = Inches(0.25)
section.footer_distance = Inches(0.25)

styles = doc.styles
normal = styles["Normal"]
normal.font.name = FONT
normal._element.rPr.rFonts.set(qn("w:ascii"), FONT)
normal._element.rPr.rFonts.set(qn("w:hAnsi"), FONT)
normal.font.size = Pt(9.35)
normal.font.color.rgb = RGBColor.from_string(INK)
normal.paragraph_format.space_before = Pt(0)
normal.paragraph_format.space_after = Pt(1.4)
normal.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE

for name, size, before, after in [
    ("Section Heading", 10.25, 4.8, 2.0),
    ("Role Header", 9.55, 2.2, 0),
    ("Role Subheader", 9.35, 0, 0.2),
    ("Resume Bullet", 9.25, 0, 0.45),
    ("Compact Line", 9.15, 0, 0.7),
]:
    style = styles.add_style(name, WD_STYLE_TYPE.PARAGRAPH)
    style.font.name = FONT
    style._element.rPr.rFonts.set(qn("w:ascii"), FONT)
    style._element.rPr.rFonts.set(qn("w:hAnsi"), FONT)
    style.font.size = Pt(size)
    style.font.color.rgb = RGBColor.from_string(INK)
    style.paragraph_format.space_before = Pt(before)
    style.paragraph_format.space_after = Pt(after)
    style.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE

styles["Section Heading"].font.bold = True
styles["Section Heading"].font.color.rgb = RGBColor.from_string(NAVY)
styles["Resume Bullet"].paragraph_format.left_indent = Inches(0.21)
styles["Resume Bullet"].paragraph_format.first_line_indent = Inches(-0.10)

num_id = add_numbering(doc)

# Simple ATS-readable header.
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.paragraph_format.space_after = Pt(1)
r = p.add_run("ZIYUE (ZOEY) LING")
set_cell_or_run_font(r, 18.5, bold=True, color=NAVY)

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.paragraph_format.space_after = Pt(3)
r = p.add_run("(878) 787-0139  |  ziyuelin@andrew.cmu.edu  |  Pittsburgh, PA")
set_cell_or_run_font(r, 9.25, color=MUTED)

section_heading(doc, "Professional Summary")
p = doc.add_paragraph()
p.paragraph_format.space_after = Pt(1.5)
r = p.add_run(
    "Information Systems and Artificial Intelligence student with experience in "
    "hardware-software deployments, youth engagement, community outreach, event "
    "coordination, user-centered product design, and data-informed research. "
    "Interested in translating HCI research into accessible educational products "
    "and partnerships."
)
set_cell_or_run_font(r, 9.25)

section_heading(doc, "Education")
add_role(
    doc,
    "Carnegie Mellon University",
    "Pittsburgh, PA",
    "B.S. Information Systems; Additional Major in Artificial Intelligence | GPA: 3.65/4.0",
    "Expected May 2028",
)
add_labeled_line(
    doc,
    "Relevant Coursework",
    "Designing Human-Centered Software; Interaction Design Fundamentals; "
    "Database Design and Development; Probability Theory for Computer Scientists",
)

section_heading(doc, "Relevant Experience")
add_role(
    doc,
    "Mellon College of Science, Carnegie Mellon University",
    "Pittsburgh, PA",
    "Linux Programmer",
    "Sep 2025 - Present",
)
bullet(
    doc,
    "Support deployment of datacenter sensors, integrating hardware and software "
    "components and building hands-on product installation experience.",
    num_id,
)
bullet(
    doc,
    "Develop web applications and backend data infrastructure with HTML, CSS, "
    "JavaScript, Python, and SQL in collaboration with the Director of Scientific Computing.",
    num_id,
)
bullet(
    doc,
    "Conduct website security audits to identify vulnerabilities and support secure data handling.",
    num_id,
)

add_role(
    doc,
    "Carnegie Mellon University Pre-College Program",
    "Pittsburgh, PA",
    "Resident Assistant",
    "Jun 2025 - Aug 2025",
)
bullet(
    doc,
    "Supported a community of high school students throughout a six-week residential "
    "program, helping ensure safety, well-being, and a successful transition to campus life.",
    num_id,
)
bullet(
    doc,
    "Led floor meetings and community-building events; communicated with students and "
    "professional staff to resolve concerns and foster an inclusive environment.",
    num_id,
)

add_role(
    doc,
    "IS Sphere",
    "Carnegie Mellon University",
    "Women in IS Mentor",
    "May 2025 - Present",
)
bullet(
    doc,
    "Help organize university-wide Information Systems events that strengthen outreach "
    "and community engagement.",
    num_id,
)
bullet(
    doc,
    "Facilitate networking activities, including student coffee chats with professors "
    "and opportunities to connect with Information Systems advisors.",
    num_id,
)

section_heading(doc, "Product, Design & Research")
add_role(doc, "ProdHacks", "", "Team Member", "Feb 2025")
bullet(
    doc,
    "Analyzed rider and driver journeys and proposed Uber mobile-app improvements focused "
    "on trip-time accuracy and transparency in driver performance metrics.",
    num_id,
)
bullet(
    doc,
    "Designed Figma prototypes for rider and driver experiences, simplifying navigation "
    "and addressing friction points identified through user-journey analysis.",
    num_id,
)

add_role(
    doc,
    "Lake Pollution and Policies in China",
    "",
    "Research Paper",
    "Jun 2022 - Aug 2022",
)
bullet(
    doc,
    "Analyzed environmental datasets and synthesized peer-reviewed literature to identify "
    "factors contributing to water-quality degradation under the guidance of Dr. Catherine "
    "Cardelus, Colgate University.",
    num_id,
)

add_role(doc, "Minesweeper Kings' Tour", "", "Term Project (15-112)", "Dec 2024")
bullet(
    doc,
    "Built a two-player strategy game and implemented Python-based AI decision models "
    "across multiple difficulty levels.",
    num_id,
)

section_heading(doc, "Skills")
add_labeled_line(
    doc,
    "Business & Product",
    "Community outreach, event coordination, stakeholder communication, youth engagement, "
    "user-journey analysis, product deployment",
)
add_labeled_line(
    doc,
    "Design & Data",
    "Figma, Canva, SQL, Python, RStudio, database design, qualitative and quantitative research",
)
add_labeled_line(
    doc,
    "Technical",
    "HTML, CSS, JavaScript, C, GitHub",
)
add_labeled_line(
    doc,
    "Languages",
    "English (fluent), Chinese (fluent), French (intermediate)",
)

# Prevent accidental blank trailing page and set document metadata.
doc.core_properties.title = "Ziyue Ling - NoRILLA Business Developer / Research Assistant Resume"
doc.core_properties.subject = "Tailored resume for NoRILLA"
doc.core_properties.author = "Ziyue Ling"

OUT.parent.mkdir(parents=True, exist_ok=True)
doc.save(OUT)
print(OUT)
