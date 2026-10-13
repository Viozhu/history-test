#!/usr/bin/env python3
"""PDF -> JSON + images pipeline for the 한국사능력검정시험 심화 simulator.

Reads the official booklets (문제지) and answer keys (정답표) from the source
folder (never modified), and writes:

  data/exams/{round}.json        one file per round
  data/exams/index.json          list of rounds
  public/exams/{round}/*.webp    question crops (full question + material)
  reports/review-report.md       questions to check by hand

Booklets with a text layer are parsed directly. Booklets whose text was
converted to vector outlines are OCR'd with Apple Vision (scripts/ocr.swift).

Usage:  .venv/bin/python scripts/build_data.py [--rounds 77,79] [--src DIR]
"""

from __future__ import annotations

import argparse
import io
import json
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path

import pymupdf
from PIL import Image

APP = Path(__file__).resolve().parent.parent
DEFAULT_SRC = APP.parent / "Questions & awnsers"
CACHE = APP / ".cache"
DATA = APP / "data"
OUT_JSON = DATA / "exams"
OUT_IMG = APP / "public" / "exams"
REPORT = APP / "reports" / "review-report.md"
ERA_MAP = DATA / "era-map.json"
ROUNDS_META = DATA / "rounds-meta.json"

ERAS = ["선사·고조선", "삼국·남북국", "고려", "조선 전기", "조선 후기", "개항기", "일제강점기", "현대"]

OCR_DPI = 300
CROP_DPI = 200

MARKERS = "①②③④⑤"
CIRCLED = {c: i + 1 for i, c in enumerate(MARKERS)}
NUM_QUESTIONS = 50



@dataclass(frozen=True)
class Geometry:
    """Booklet layout (points): two text columns per page, content band between top and bottom."""

    cols: tuple[tuple[tuple[float, float], tuple[float, float]], ...]  # by page index parity
    top_first: float  # page 1 has the title block
    top: float
    bottom: float


# Rounds 69–79: 728×1032 pages, same margins on every page.
GEOMETRY_69 = Geometry((((43.0, 354.0), (374.0, 686.0)),), 140.0, 58.0, 958.0)
# Rounds 60–68: 748×1091 pages whose margins alternate between odd and even pages.
GEOMETRY_60 = Geometry((((56.0, 370.0), (385.0, 700.0)), ((46.0, 360.0), (377.0, 692.0))), 175.0, 90.0, 1005.0)
GEOM = GEOMETRY_69


def geometry_for(doc: pymupdf.Document) -> Geometry:
    w = doc[0].rect.width
    if abs(w - 748.4) < 3:
        return GEOMETRY_60
    if abs(w - 728.5) < 3:
        return GEOMETRY_69
    raise PipelineError(f"unknown booklet page width {w:.1f} pt: add a Geometry for this layout")


def cols(page: int) -> tuple[tuple[float, float], tuple[float, float]]:
    return GEOM.cols[page % len(GEOM.cols)]


def content_top(page: int) -> float:
    return GEOM.top_first if page == 0 else GEOM.top


class PipelineError(Exception):
    pass


# --------------------------------------------------------------------------- discovery


def discover(src: Path) -> dict[int, dict[str, Path]]:
    rounds: dict[int, dict[str, Path]] = {}
    for f in sorted(src.glob("*.pdf")):
        name = unicodedata.normalize("NFC", f.name)  # macOS stores names as NFD
        m = re.search(r"(\d{2,3})회", name)
        if not m:
            raise PipelineError(f"cannot infer round from file name: {f.name}")
        if "문제지" in name:
            kind = "booklet"
        elif "정답" in name or "답지" in name:
            kind = "key"
        else:
            raise PipelineError(f"cannot tell booklet from answer key: {f.name}")
        slot = rounds.setdefault(int(m.group(1)), {})
        if kind in slot:
            raise PipelineError(f"round {m.group(1)}: two {kind} files ({slot[kind].name}, {f.name})")
        slot[kind] = f
    for r, slot in rounds.items():
        missing = {"booklet", "key"} - slot.keys()
        if missing:
            raise PipelineError(f"round {r}: missing {', '.join(missing)}")
    return dict(sorted(rounds.items()))


# --------------------------------------------------------------------------- answer key


VOIDED = 0  # "없음": the question was annulled after appeal and every candidate gets its points


def parse_key(path: Path) -> dict[int, tuple[int, int]]:
    """Return {number: (answer, points)}, answer VOIDED for "정답 없음"; raises with a clear report when invalid."""
    page = pymupdf.open(path)[0]
    words = page.get_text("words")
    rows: list[list[tuple]] = []
    for w in sorted(words, key=lambda w: ((w[1] + w[3]) / 2, w[0])):
        yc = (w[1] + w[3]) / 2
        if rows and abs(((rows[-1][0][1] + rows[-1][0][3]) / 2) - yc) < 5:
            rows[-1].append(w)
        else:
            rows.append([w])
    key: dict[int, tuple[int, int]] = {}
    for row in rows:
        toks = []
        for w in sorted(row, key=lambda w: w[0]):
            t = w[4].strip()
            if t in CIRCLED:
                toks.append(CIRCLED[t])
            elif t in ("없음", "정답없음"):
                toks.append(VOIDED)
            elif re.fullmatch(r"[0-9]{1,2}", t):  # str.isdigit() is True for ③
                toks.append(int(t))
        if len(toks) != 15:
            continue
        for i in range(0, 15, 3):
            num, ans, pts = toks[i : i + 3]
            if num in key:
                raise PipelineError(f"{path.name}: question {num} appears twice in the key")
            key[num] = (ans, pts)

    problems = []
    if sorted(key) != list(range(1, NUM_QUESTIONS + 1)):
        missing = sorted(set(range(1, NUM_QUESTIONS + 1)) - set(key))
        extra = sorted(set(key) - set(range(1, NUM_QUESTIONS + 1)))
        problems.append(f"expected questions 1–50; missing={missing} extra={extra}")
    bad_ans = [n for n, (a, _) in key.items() if a != VOIDED and a not in range(1, 6)]
    bad_pts = [n for n, (_, p) in key.items() if p not in (1, 2, 3)]
    if bad_ans:
        problems.append(f"answers outside 1–5 for questions {bad_ans}")
    if bad_pts:
        problems.append(f"points outside 1–3 for questions {bad_pts}")
    total = sum(p for _, p in key.values())
    if total != 100:
        problems.append(f"points sum to {total}, expected 100")
    if problems:
        raise PipelineError(f"answer key {path.name} is invalid:\n  - " + "\n  - ".join(problems))
    return key


# --------------------------------------------------------------------------- page text


@dataclass
class Line:
    text: str
    x0: float
    y0: float
    x1: float
    y1: float
    conf: float = 1.0

    @property
    def h(self) -> float:
        return self.y1 - self.y0


def has_text_layer(doc: pymupdf.Document) -> bool:
    return sum(len(p.get_text().strip()) for p in doc) > 2000


def text_lines(page: pymupdf.Page) -> list[Line]:
    out = []
    for b in page.get_text("dict")["blocks"]:
        for l in b.get("lines", []):
            t = "".join(s["text"] for s in l["spans"])
            if t.strip():
                out.append(Line(t.strip(), *l["bbox"]))
    return out


def ocr_binary() -> Path:
    src = APP / "scripts" / "ocr.swift"
    binp = CACHE / "bin" / "ocr"
    if not binp.exists() or binp.stat().st_mtime < src.stat().st_mtime:
        binp.parent.mkdir(parents=True, exist_ok=True)
        print("  compiling OCR tool (swiftc)…")
        subprocess.run(["swiftc", "-O", str(src), "-o", str(binp)], check=True)
    return binp


def ocr_lines(round_no: int, doc: pymupdf.Document, booklet: Path) -> list[list[Line]]:
    cache = CACHE / "ocr" / f"{round_no}.json"
    stamp = f"{booklet.name}:{booklet.stat().st_size}:{OCR_DPI}"
    if cache.exists():
        cached = json.loads(cache.read_text())
        if cached.get("stamp") == stamp:
            return [[Line(**l) for l in page] for page in cached["pages"]]
    print(f"  OCR {len(doc)} pages (Apple Vision)…")
    tool = ocr_binary()
    with tempfile.TemporaryDirectory() as tmp:
        paths = []
        for i, page in enumerate(doc):
            p = Path(tmp) / f"p{i:02d}.png"
            page.get_pixmap(dpi=OCR_DPI).save(p)
            paths.append(str(p))
        res = subprocess.run([str(tool), *paths], check=True, capture_output=True, text=True)
    scale = 72 / OCR_DPI
    pages = []
    for raw in res.stdout.splitlines():
        d = json.loads(raw)
        pages.append(
            [
                {
                    "text": l["text"].strip().replace("•", "·"),
                    "x0": l["bbox"][0] * scale,
                    "y0": l["bbox"][1] * scale,
                    "x1": l["bbox"][2] * scale,
                    "y1": l["bbox"][3] * scale,
                    "conf": l["conf"],
                }
                for l in d["lines"]
                if l["text"].strip()
            ]
        )
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps({"stamp": stamp, "pages": pages}, ensure_ascii=False))
    return [[Line(**l) for l in page] for page in pages]


# --------------------------------------------------------------------------- segmentation

HEADER_RE = re.compile(r"^\s*(\d{1,2})\s*[.,·]\s*(.*)$")
# "[2점]". OCR often reads the opening bracket as 1/l/I/|, e.g. "12점]".
POINTS_LINE_RE = re.compile(r"^[\[\(1lI|]?\s*([123])\s*점\s*[\]\)]?$")
# At the end of the stem; OCR may also drop the opening bracket entirely ("…것은? 2점]").
POINTS_INLINE_RE = re.compile(r"\s*(?:[\[\(1lI|]\s*([123])\s*점\s*[\]\)]?|([123])\s*점\s*[\]\)])\s*$")
# What OCR sometimes produces instead of a circled digit at the start of an option.
MARKER_JUNK_RE = re.compile(r"^\s*(?:[①②③④⑤]|\(?[1-5]\)|[lI|ⓛ©®])\s*")


@dataclass
class Header:
    number: int
    page: int
    col: int
    line: Line


@dataclass
class Question:
    number: int
    page: int
    col: int
    top: float
    bottom: float
    header: Line
    lines: list[Line]  # lines inside the region, header excluded
    flags: list[str] = field(default_factory=list)


def col_of(line: Line, page: int) -> int | None:
    for i, (a, b) in enumerate(cols(page)):
        if a - 8 <= line.x0 <= b:
            return i
    return None


def find_headers(pages: list[list[Line]]) -> list[Header]:
    expected = 1
    headers: list[Header] = []
    for pno, lines in enumerate(pages):
        top = content_top(pno)
        for col, (cx0, _) in enumerate(cols(pno)):
            cands = sorted(
                (l for l in lines if cx0 - 12 <= l.x0 <= cx0 + 8 and top <= l.y0 < GEOM.bottom and l.h >= 11),
                key=lambda l: l.y0,
            )
            for l in cands:
                m = HEADER_RE.match(l.text)
                if m and int(m.group(1)) == expected and m.group(2).strip():
                    headers.append(Header(expected, pno, col, l))
                    expected += 1
    if expected != NUM_QUESTIONS + 1:
        raise PipelineError(f"found question headers 1–{expected - 1} only; could not locate question {expected}")
    return headers


def build_regions(pages: list[list[Line]], headers: list[Header]) -> list[Question]:
    qs = []
    for i, h in enumerate(headers):
        nxt = next((o for o in headers[i + 1 :] if o.page == h.page and o.col == h.col), None)
        top = h.line.y0 - 4
        bottom = (nxt.line.y0 - 6) if nxt else GEOM.bottom
        cx0, cx1 = cols(h.page)[h.col]
        inside = [
            l
            for l in pages[h.page]
            if l is not h.line
            and cx0 - 8 <= l.x0 < cx1
            and top <= (l.y0 + l.y1) / 2 <= bottom
        ]
        inside.sort(key=lambda l: (round(l.y0 / 4), l.x0))
        qs.append(Question(h.number, h.page, h.col, top, bottom, h.line, inside))
    return qs


# "[47~48] 다음을 읽고 물음에 답하시오." — OCR may read the closing bracket as 」 or ).
GROUP_RE = re.compile(r"^\s*[\[［(]?\s*(\d{1,2})\s*[~∼～\-]\s*(\d{1,2})\s*[\]］」)]")


@dataclass
class Shared:
    """Material printed once above a group of questions ("[47~48] …"), outside every question region."""

    first: int
    last: int
    page: int
    col: int
    top: float
    bottom: float
    lines: list[Line]  # material lines, instruction line excluded


def find_shared_blocks(pages: list[list[Line]], headers: list[Header]) -> list[Shared]:
    out = []
    for pno, lines in enumerate(pages):
        for l in lines:
            m = GROUP_RE.match(l.text)
            col = col_of(l, pno)
            if not m or col is None or not ("답하시오" in l.text or "물음" in l.text):
                continue
            below = [h.line.y0 for h in headers if h.page == pno and h.col == col and h.line.y0 > l.y0]
            top, bottom = l.y0 - 4, (min(below) - 6) if below else GEOM.bottom
            cx0, cx1 = cols(pno)[col]
            inside = [
                o for o in lines if o is not l and cx0 - 8 <= o.x0 < cx1 and top <= (o.y0 + o.y1) / 2 <= bottom
            ]
            inside.sort(key=lambda o: (round(o.y0 / 4), o.x0))
            out.append(Shared(int(m.group(1)), int(m.group(2)), pno, col, top, bottom, inside))
    return out


def split_markers(text: str) -> list[tuple[int, str]]:
    """'① ㄱ, ㄴ ② ㄱ, ㄷ' -> [(1,'ㄱ, ㄴ'), (2,'ㄱ, ㄷ')]; text before the first marker gets 0."""
    parts: list[tuple[int, str]] = []
    cur_n, buf = 0, ""
    for ch in text:
        if ch in CIRCLED:
            if buf.strip() or cur_n:
                parts.append((cur_n, buf.strip()))
            cur_n, buf = CIRCLED[ch], ""
        else:
            buf += ch
    if buf.strip() or cur_n:
        parts.append((cur_n, buf.strip()))
    return parts


@dataclass
class Options:
    texts: list[str]
    top: float  # y of the first option line
    pictures: bool = False
    repaired: list[int] = field(default_factory=list)


def find_vertical_options(q: Question) -> Options | None:
    """Five left-aligned lines at the bottom of the region (the common layout)."""
    cx0 = cols(q.page)[q.col][0]
    left = [l for l in q.lines if cx0 + 3 <= l.x0 <= cx0 + 17]
    if len(left) < 5:
        return None
    left.sort(key=lambda l: l.y0)
    run = left[-5:]
    gaps = [b.y0 - a.y0 for a, b in zip(run, run[1:])]
    if not all(14 <= g <= 46 for g in gaps):
        return None
    # Nothing substantial may sit below the run (other than wrapped option text).
    if any(l.y0 > run[-1].y1 + 4 and l.x0 < run[-1].x0 + 6 for l in q.lines):
        return None
    texts, repaired, hits = [], [], 0
    for i, l in enumerate(run):
        parts = split_markers(l.text)
        if len(parts) == 1 and parts[0][0] == i + 1:
            hits += 1
            t = parts[0][1]
        elif any(n for n, _ in parts):
            return None  # several markers on one line: not a vertical list
        else:
            t = MARKER_JUNK_RE.sub("", l.text, count=1)
            t = re.sub(rf"^{i + 1}\s+", "", t)  # "1 러일 전쟁…" (① read as 1)
            repaired.append(i + 1)
        # Wrapped continuation lines: indented, between this option and the next.
        y_next = run[i + 1].y0 if i < 4 else q.bottom
        cont = [c for c in q.lines if c not in run and l.y1 - 2 <= c.y0 < y_next - 2 and c.x0 > l.x0 + 6]
        for c in sorted(cont, key=lambda c: c.y0):
            if c.x0 < l.x0 + 40:  # same column of text, not a picture caption far right
                t += " " + c.text
        texts.append(t.strip())
    # Position is strong evidence; require some marker agreement unless spacing is regular.
    if hits < 2 and max(gaps) - min(gaps) > 4:
        return None
    return Options(texts, run[0].y0, repaired=repaired)


def find_marker_options(q: Question) -> Options | None:
    """Last ①→⑤ sequence of markers in reading order (grid and picture options)."""
    tokens: list[tuple[int, str, Line]] = []
    for l in q.lines:
        for n, t in split_markers(l.text):
            tokens.append((n, t, l))
    seq: list[tuple[int, str, Line]] = []
    want = 5
    for n, t, l in reversed(tokens):
        if n == want:
            seq.append((n, t, l))
            want -= 1
            if want == 0:
                break
        elif n and seq and n > want:  # a stray later marker: restart is not needed, skip
            continue
    if len(seq) != 5:
        return None
    seq.reverse()
    texts = [t for _, t, _ in seq]
    top = min(l.y0 for _, _, l in seq)
    pictures = all(len(t) <= 1 for t in texts)
    return Options(["" for _ in texts] if pictures else texts, top, pictures=pictures)


def extract_stem(q: Question) -> tuple[str, float, int | None]:
    m = HEADER_RE.match(q.header.text)
    stem = m.group(2) if m else q.header.text
    bottom = q.header.y1
    pts = None
    pm = POINTS_INLINE_RE.search(stem)
    if pm:
        pts = int(pm.group(1) or pm.group(2))
        stem = stem[: pm.start()]
    used = 0
    for l in sorted(q.lines, key=lambda l: l.y0):
        if l.y0 > bottom + 10:
            break
        tm = POINTS_LINE_RE.match(l.text.strip())
        if tm:
            pts = pts or int(tm.group(1))
            bottom = max(bottom, l.y1)
            continue
        if "?" in stem or used >= 2 or l.x0 > cols(q.page)[q.col][0] + 40:
            continue
        text = l.text
        tm = POINTS_INLINE_RE.search(text)
        if tm:
            pts = pts or int(tm.group(1) or tm.group(2))
            text = text[: tm.start()]
        stem += " " + text
        bottom = max(bottom, l.y1)
        used += 1
    return re.sub(r"\s+", " ", stem).strip(), bottom, pts


# --------------------------------------------------------------------------- rendering


def save_crop(page: pymupdf.Page, rect: pymupdf.Rect, dest: Path) -> dict:
    pix = page.get_pixmap(dpi=CROP_DPI, clip=rect)
    img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, "WEBP", quality=80, method=6)
    rel = "/" + dest.relative_to(APP / "public").as_posix()
    return {"src": rel, "width": img.width, "height": img.height}


# --------------------------------------------------------------------------- per round


def load_json(path: Path, default):
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return default


def process_round(round_no: int, files: dict[str, Path], eras: dict, meta: dict) -> tuple[dict, list[dict]]:
    key = parse_key(files["key"])
    global GEOM
    doc = pymupdf.open(files["booklet"])
    GEOM = geometry_for(doc)
    source = "text" if has_text_layer(doc) else "ocr"
    pages = [text_lines(p) for p in doc] if source == "text" else ocr_lines(round_no, doc, files["booklet"])
    headers = find_headers(pages)
    regions = build_regions(pages, headers)

    year = None
    for l in pages[0]:
        ym = re.search(r"(20\d\d)\s*년도", l.text)
        if ym:
            year = int(ym.group(1))
            break

    img_dir = OUT_IMG / str(round_no)
    if img_dir.exists():
        shutil.rmtree(img_dir)
    round_eras = eras.get(str(round_no), {})
    shared_by_q: dict[int, dict] = {}
    for sb in find_shared_blocks(pages, headers):
        cx0, cx1 = cols(sb.page)[sb.col]
        text = "\n".join(l.text for l in sb.lines) or None
        img = save_crop(doc[sb.page], pymupdf.Rect(cx0 - 6, sb.top, cx1 + 4, sb.bottom), img_dir / f"s{sb.first:02d}-{sb.last:02d}.webp")
        img["alt"] = f"{sb.first}~{sb.last}번 공통 자료" + (f": {text[:300]}" if text else "")
        for n in range(sb.first, sb.last + 1):
            shared_by_q[n] = {"range": [sb.first, sb.last], "image": img, "passage": text}
    questions, review = [], []
    for q in regions:
        page = doc[q.page]
        cx0, cx1 = cols(q.page)[q.col]
        n = q.number
        answer, points = key[n]
        flags: list[str] = []

        stem, stem_bottom, header_pts = extract_stem(q)
        if header_pts is None:
            flags.append("points tag [N점] not found in the booklet")
        elif header_pts != points:
            flags.append(f"booklet says {header_pts}점 but the key says {points}점 (key used)")

        opts = find_vertical_options(q) or find_marker_options(q)
        full = save_crop(page, pymupdf.Rect(cx0 - 6, q.top, cx1 + 4, q.bottom), img_dir / f"q{n:02d}.webp")

        use_fallback = False
        if opts is None:
            use_fallback = True
            flags.append("options not found → whole-question image fallback")
        elif not opts.pictures and any(len(t) < 1 for t in opts.texts):
            use_fallback = True
            flags.append("an option has no text → whole-question image fallback")
        if not stem or len(stem) < 6:
            use_fallback = True
            flags.append("stem not found → whole-question image fallback")
        if opts and opts.repaired:
            repaired_count = len(opts.repaired)
        else:
            repaired_count = 0
        if opts and opts.pictures:
            flags.append("picture options (options are shown inside the question image)")
        low = [l for l in q.lines + [q.header] if l.conf < 0.4]
        if low:
            flags.append(f"{len(low)} low-confidence OCR line(s)")

        images, passage = [], None
        if not use_fallback:
            m_top = stem_bottom + 2
            m_bot = q.bottom if opts.pictures else opts.top - 4
            if m_bot - m_top > 12:
                body = [l for l in q.lines if m_top - 2 <= l.y0 and l.y1 <= m_bot + 2]
                passage = "\n".join(l.text for l in sorted(body, key=lambda l: (round(l.y0 / 4), l.x0))) or None
                img = save_crop(page, pymupdf.Rect(cx0 - 6, m_top, cx1 + 4, m_bot), img_dir / f"q{n:02d}-m.webp")
                img["alt"] = f"{n}번 문항 자료" + (f": {passage[:300]}" if passage else "")
                images.append(img)

        era = round_eras.get(str(n))
        if era is not None and era not in ERAS:
            raise PipelineError(f"era-map.json round {round_no} q{n}: unknown era '{era}' (allowed: {ERAS})")

        question = {
            "id": f"{round_no}-{n:02d}",
            "round": round_no,
            "number": n,
            "points": points,
            "answer": None if answer == VOIDED else answer,
            "stem": stem,
            "passage": passage,
            "images": images,
            "options": opts.texts if (opts and not use_fallback) else ["", "", "", "", ""],
            "optionsAreImages": bool(opts and opts.pictures),
            "era": era,
            "shared": shared_by_q.get(n),
            "fallbackImage": {**full, "alt": f"{n}번 문항 원본"},
            "useFallback": use_fallback,
            "source": source,
        }
        question["_repairedMarkers"] = repaired_count
        questions.append(question)
        if flags:
            review.append({"id": question["id"], "flags": flags})

    exam = {
        "round": round_no,
        "title": f"제{round_no}회 한국사능력검정시험 심화",
        "year": year,
        "date": meta.get(str(round_no), {}).get("date"),
        "timeLimitMinutes": 80,
        "source": source,
        "totalPoints": sum(q["points"] for q in questions),
        "questions": questions,
    }
    assert len(questions) == NUM_QUESTIONS and exam["totalPoints"] == 100
    return exam, review


# --------------------------------------------------------------------------- main


def ensure_editable_files(rounds: list[int]) -> tuple[dict, dict]:
    eras = load_json(ERA_MAP, {"_eras": ERAS, "_help": "Map question number → era per round, e.g. \"79\": {\"1\": \"선사·고조선\"}. Edit by hand, then rerun the pipeline."})
    meta = load_json(ROUNDS_META, {"_help": "Exam date per round (YYYY-MM-DD). Edit by hand, then rerun the pipeline."})
    for r in rounds:
        eras.setdefault(str(r), {})
        meta.setdefault(str(r), {"date": None})
    ERA_MAP.write_text(json.dumps(eras, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    ROUNDS_META.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return eras, meta


def write_report(results: dict[int, tuple[dict, list[dict]]], errors: dict[int, str]) -> None:
    out = ["# Review report", "", "Generated by `scripts/build_data.py`. Check these questions against the original PDF.", ""]
    out += [
        "Every question's points tag in the booklet was cross-checked against the answer key;",
        "a mismatch is listed below. *OCR marker fixes* counts options whose circled digit OCR",
        "misread (usually ①); their text was taken by position and the stray marker stripped.",
        "",
        "| 회차 | Source | Fallback | Flagged | OCR marker fixes |",
        "|---|---|---|---|---|",
    ]
    for r, (exam, review) in results.items():
        fb = sum(q["useFallback"] for q in exam["questions"])
        out.append(f"| {r} | {exam['source']} | {fb} | {len(review)} | {exam['_stats']['repairedMarkers']} |")
    for r, err in errors.items():
        out.append(f"| {r} | **FAILED** | – | – | – |")
    out.append("")
    if errors:
        out += ["## Failed rounds", ""]
        for r, err in errors.items():
            out += [f"### {r}회", "", "```", err, "```", ""]
    for r, (exam, review) in results.items():
        if not review:
            continue
        out += [f"## {r}회 ({exam['source']})", ""]
        for item in review:
            out.append(f"- **{item['id']}**: " + "; ".join(item["flags"]))
        out.append("")
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text("\n".join(out), encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", type=Path, default=DEFAULT_SRC)
    ap.add_argument("--rounds", help="comma-separated subset, e.g. 77,79")
    ap.add_argument("--list", action="store_true", help="only print the round → files mapping")
    args = ap.parse_args()

    mapping = discover(args.src)
    print("Round → files")
    for r, f in mapping.items():
        print(f"  {r}회  booklet: {f['booklet'].name}   key: {f['key'].name}")
    if args.list:
        return 0
    wanted = [int(x) for x in args.rounds.split(",")] if args.rounds else list(mapping)

    eras, meta = ensure_editable_files(list(mapping))
    OUT_JSON.mkdir(parents=True, exist_ok=True)
    results: dict[int, tuple[dict, list[dict]]] = {}
    errors: dict[int, str] = {}
    for r in wanted:
        print(f"[{r}회]")
        try:
            exam, review = process_round(r, mapping[r], eras, meta)
        except PipelineError as e:
            errors[r] = str(e)
            print(f"  ERROR: {e}", file=sys.stderr)
            continue
        repaired = sum(q.pop("_repairedMarkers") for q in exam["questions"])
        exam["_stats"] = {"repairedMarkers": repaired}
        stats = exam.pop("_stats")
        (OUT_JSON / f"{r}.json").write_text(json.dumps(exam, ensure_ascii=False, indent=1), encoding="utf-8")
        exam["_stats"] = stats
        results[r] = (exam, review)
        fb = sum(q["useFallback"] for q in exam["questions"])
        print(f"  ok: 50 questions, 100 points, source={exam['source']}, fallback={fb}, flagged={len(review)}")

    # index.json reflects every round that has a JSON file on disk.
    index = []
    for p in sorted(OUT_JSON.glob("[0-9]*.json"), key=lambda p: int(p.stem)):
        e = json.loads(p.read_text(encoding="utf-8"))
        index.append({k: e[k] for k in ("round", "title", "year", "date", "source", "timeLimitMinutes")})
    (OUT_JSON / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")

    write_report(results, errors)
    print(f"Report: {REPORT.relative_to(APP)}")
    if errors:
        print(f"FAILED rounds: {sorted(errors)}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
