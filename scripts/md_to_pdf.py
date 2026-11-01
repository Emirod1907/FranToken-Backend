# -*- coding: utf-8 -*-
"""Convierte el documento de tareas (Markdown) a PDF con formato legible."""
import re
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Preformatted, HRFlowable,
    ListFlowable, ListItem,
)

SRC = r"C:\Escritorio\PROGRAMACION\FranToken-Contratos-Tareas-Revision.md"
OUT = r"C:\Escritorio\PROGRAMACION\FranToken-Contratos-Tareas-Revision.pdf"

GREEN = colors.HexColor("#11382e")
GREEN2 = colors.HexColor("#1b5e4f")
MUTED = colors.HexColor("#5f7969")

styles = getSampleStyleSheet()
TITLE = ParagraphStyle("TitleX", parent=styles["Heading1"], fontSize=18, spaceAfter=10, textColor=GREEN)
H2 = ParagraphStyle("H2X", parent=styles["Heading2"], fontSize=13, spaceBefore=14, spaceAfter=5, textColor=GREEN)
H3 = ParagraphStyle("H3X", parent=styles["Heading3"], fontSize=11, spaceBefore=9, spaceAfter=3, textColor=GREEN2)
BODY = ParagraphStyle("BodyX", parent=styles["BodyText"], fontSize=9.5, leading=13.5, spaceAfter=5, alignment=4)
BULLET = ParagraphStyle("BulletX", parent=BODY, leftIndent=12, spaceAfter=2)
QUOTE = ParagraphStyle("QuoteX", parent=BODY, leftIndent=10, rightIndent=6, borderPadding=7,
                       backColor=colors.HexColor("#eef1e6"), textColor=colors.HexColor("#102a22"), spaceBefore=4, spaceAfter=8)
CODE = ParagraphStyle("CodeX", parent=styles["Code"], fontName="Courier", fontSize=6.5, leading=8.2,
                      textColor=colors.HexColor("#102a22"), backColor=colors.HexColor("#f0f2ea"),
                      borderPadding=6, spaceBefore=3, spaceAfter=7)
META = ParagraphStyle("MetaX", parent=BODY, fontSize=9, textColor=MUTED, spaceAfter=3)

# Glifos ausentes en las fuentes base -> equivalentes seguros.
REPLACEMENTS = {"\U0001F534": "[Critico] ", "\U0001F7E0": "[Alto] ", "\u2192": "->"}


def esc(t: str) -> str:
    return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def inline(t: str) -> str:
    t = esc(t)
    t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)
    t = re.sub(r"\*(?!\s)(.+?)(?<!\s)\*", r"<i>\1</i>", t)
    t = re.sub(r"`([^`]+)`", r'<font face="Courier" size=8>\1</font>', t)
    return t


def build():
    with open(SRC, encoding="utf-8") as f:
        text = f.read()
    for a, b in REPLACEMENTS.items():
        text = text.replace(a, b)
    lines = text.split("\n")

    story = []
    i = 0
    bullets = []

    def flush_bullets():
        if bullets:
            story.append(ListFlowable(
                [ListItem(Paragraph(inline(b), BULLET), leftIndent=10, value="\u2013") for b in bullets],
                bulletType="bullet", start="\u2013", leftIndent=10,
            ))
            bullets.clear()

    while i < len(lines):
        line = lines[i]
        if line.startswith("```"):
            flush_bullets()
            i += 1
            buf = []
            while i < len(lines) and not lines[i].startswith("```"):
                # Preformatted dibuja texto crudo (no parsea XML): sin escapar.
                buf.append(lines[i])
                i += 1
            story.append(Preformatted("\n".join(buf), CODE))
            i += 1
            continue
        stripped = line.strip()
        if stripped.startswith("- "):
            bullets.append(stripped[2:])
            i += 1
            continue
        flush_bullets()
        if stripped == "":
            story.append(Spacer(1, 3))
        elif stripped.startswith("---"):
            story.append(Spacer(1, 2))
            story.append(HRFlowable(width="100%", color=colors.HexColor("#d5d8cc")))
        elif stripped.startswith("# "):
            story.append(Paragraph(inline(stripped[2:]), TITLE))
        elif stripped.startswith("## "):
            story.append(Paragraph(inline(stripped[3:]), H2))
        elif stripped.startswith("### "):
            story.append(Paragraph(inline(stripped[4:]), H3))
        elif stripped.startswith("> "):
            story.append(Paragraph(inline(stripped[2:]), QUOTE))
        elif stripped.startswith("**") and stripped.endswith("**") and stripped.count("**") == 2:
            story.append(Paragraph(inline(stripped), META))
        else:
            story.append(Paragraph(inline(stripped), BODY))
        i += 1
    flush_bullets()

    doc = SimpleDocTemplate(OUT, pagesize=A4, title="FranToken - Tareas de contratos",
                            leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=16 * mm)
    doc.build(story)
    print("OK ->", OUT)


if __name__ == "__main__":
    build()
    sys.exit(0)
