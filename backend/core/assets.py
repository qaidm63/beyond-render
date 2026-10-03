"""
Shadow Matrix — Asset fact extraction.

Reads *verifiable* facts out of uploaded files: page counts, sheet
dimensions, embedded document titles, producing application, image
geometry. These are measurements, not interpretations.

Why this exists
---------------
A vision model looking at a floor plan can describe what it *thinks* it
sees. The PDF's own MediaBox cannot be wrong about the sheet size. Facts
extracted here are passed to the curator as ground truth it may rely on,
which narrows the surface where the model has to guess.

No new dependencies: the Blueprint fixes the dependency set, so the PDF
structure is read directly rather than via a parsing library. We only read
values that sit in the uncompressed object headers -- enough for metadata,
and it never executes or renders anything.
"""

from __future__ import annotations

import base64
import binascii
import logging
import re
from dataclasses import dataclass, field

logger = logging.getLogger("shadow-matrix.assets")

# Architectural sheet sizes in PDF points (1 pt = 1/72"), portrait.
# Tolerance absorbs rounding and trim variation between CAD exporters.
_SHEET_SIZES: list[tuple[str, float, float]] = [
    ("A0", 2384, 3370),
    ("A1", 1684, 2384),
    ("A2", 1191, 1684),
    ("A3", 842, 1191),
    ("A4", 595, 842),
    ("ANSI D", 1584, 2448),
    ("ANSI E", 2448, 3168),
    ("ARCH D", 1728, 2592),
    ("ARCH E", 2160, 2880),
]
_SHEET_TOLERANCE_PT = 20.0

_MAX_SCAN_BYTES = 2 * 1024 * 1024  # Metadata lives early; don't scan 50 MB.


@dataclass
class AssetFacts:
    """Measured properties of one uploaded file."""

    kind: str = "unknown"  # "pdf" | "image" | "unknown"
    mime: str | None = None
    byteSize: int | None = None
    pageCount: int | None = None
    sheetSize: str | None = None
    widthPt: float | None = None
    heightPt: float | None = None
    orientation: str | None = None
    title: str | None = None
    producer: str | None = None
    pixelWidth: int | None = None
    pixelHeight: int | None = None
    notes: list[str] = field(default_factory=list)

    def summary(self) -> str:
        """One line a language model can consume as fact."""
        bits: list[str] = []
        if self.kind == "pdf":
            if self.pageCount:
                bits.append(f"{self.pageCount}-page PDF")
            else:
                bits.append("PDF")
            if self.sheetSize:
                bits.append(f"{self.sheetSize} sheet")
            elif self.widthPt and self.heightPt:
                bits.append(
                    f"{self.widthPt / 72:.1f}x{self.heightPt / 72:.1f} in sheet"
                )
            if self.orientation:
                bits.append(self.orientation)
            if self.producer:
                bits.append(f"produced by {self.producer}")
            if self.title:
                bits.append(f'titled "{self.title}"')
        elif self.kind == "image":
            if self.pixelWidth and self.pixelHeight:
                bits.append(f"{self.pixelWidth}x{self.pixelHeight} image")
            else:
                bits.append("image")
            if self.orientation:
                bits.append(self.orientation)
        return ", ".join(bits) if bits else "unreadable asset"


# ---------------------------------------------------------------- #
# Data URL decoding                                                 #
# ---------------------------------------------------------------- #


def decode_data_url(asset: str) -> tuple[str | None, bytes | None]:
    """
    Split a `data:` URL into (mime, bytes).

    Remote URLs return (None, None): fetching an operator-supplied URL
    server-side would be a request-forgery vector, and we will not do it
    just to read a page count.
    """
    if not asset.startswith("data:"):
        return None, None
    try:
        header, encoded = asset.split(",", 1)
    except ValueError:
        return None, None
    if ";base64" not in header:
        return None, None
    mime = header[5:].split(";", 1)[0] or None
    try:
        return mime, base64.b64decode(encoded, validate=False)
    except (binascii.Error, ValueError):
        return mime, None


# ---------------------------------------------------------------- #
# PDF                                                               #
# ---------------------------------------------------------------- #


def _classify_sheet(width: float, height: float) -> str | None:
    short, long_ = sorted((width, height))
    for name, w, h in _SHEET_SIZES:
        if (
            abs(short - w) <= _SHEET_TOLERANCE_PT
            and abs(long_ - h) <= _SHEET_TOLERANCE_PT
        ):
            return name
    return None


def _decode_pdf_string(raw: bytes) -> str | None:
    """Decode a PDF literal string, handling UTF-16BE with a BOM."""
    if raw.startswith(b"\xfe\xff"):
        try:
            text = raw[2:].decode("utf-16-be", errors="ignore")
        except UnicodeDecodeError:
            return None
    else:
        text = raw.decode("latin-1", errors="ignore")
    # PDF escapes and stray control characters are noise in a prompt.
    text = re.sub(r"\\([()\\])", r"\1", text)
    text = "".join(ch for ch in text if ch.isprintable())
    text = text.strip()
    return text[:200] or None


def read_pdf_facts(data: bytes) -> AssetFacts:
    """Extract page count, sheet geometry and document info from a PDF."""
    facts = AssetFacts(kind="pdf", mime="application/pdf", byteSize=len(data))

    if not data.startswith(b"%PDF"):
        facts.notes.append("File does not carry a PDF signature.")
        return facts

    head = data[:_MAX_SCAN_BYTES]

    # Page count: prefer the catalogue's /Count, fall back to counting
    # /Type /Page objects, which also works on linearised exports.
    counts = [int(m) for m in re.findall(rb"/Count\s+(\d+)", head)]
    if counts:
        facts.pageCount = max(counts)
    else:
        pages = len(re.findall(rb"/Type\s*/Page[^s]", head))
        if pages:
            facts.pageCount = pages

    # Sheet geometry from the first MediaBox.
    box = re.search(
        rb"/MediaBox\s*\[\s*([\d.+-]+)\s+([\d.+-]+)\s+([\d.+-]+)\s+([\d.+-]+)\s*\]",
        head,
    )
    if box:
        try:
            x0, y0, x1, y1 = (float(v) for v in box.groups())
            width, height = abs(x1 - x0), abs(y1 - y0)
            if width > 0 and height > 0:
                facts.widthPt = round(width, 1)
                facts.heightPt = round(height, 1)
                facts.sheetSize = _classify_sheet(width, height)
                facts.orientation = (
                    "landscape"
                    if width > height
                    else "portrait"
                    if height > width
                    else "square"
                )
        except ValueError:
            pass

    for key, attr in (("Title", "title"), ("Producer", "producer")):
        match = re.search(
            rb"/" + key.encode() + rb"\s*\((.{0,400}?)\)\s*(?:/|>>)",
            head,
            re.DOTALL,
        )
        if match:
            setattr(facts, attr, _decode_pdf_string(match.group(1)))

    if re.search(rb"/Encrypt\b", head):
        facts.notes.append(
            "PDF is encrypted; metadata may be incomplete."
        )
    return facts


# ---------------------------------------------------------------- #
# Images                                                            #
# ---------------------------------------------------------------- #


def read_image_facts(data: bytes, mime: str | None = None) -> AssetFacts:
    """Read pixel dimensions straight from PNG/JPEG/GIF headers."""
    facts = AssetFacts(kind="image", mime=mime, byteSize=len(data))
    width = height = None

    if data.startswith(b"\x89PNG\r\n\x1a\n") and len(data) >= 24:
        width = int.from_bytes(data[16:20], "big")
        height = int.from_bytes(data[20:24], "big")

    elif data.startswith(b"\xff\xd8"):
        # Walk the JPEG marker chain to the first frame header.
        i = 2
        while i + 9 < len(data):
            if data[i] != 0xFF:
                i += 1
                continue
            marker = data[i + 1]
            if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
                height = int.from_bytes(data[i + 5 : i + 7], "big")
                width = int.from_bytes(data[i + 7 : i + 9], "big")
                break
            segment = int.from_bytes(data[i + 2 : i + 4], "big")
            if segment <= 0:
                break
            i += 2 + segment

    elif data.startswith((b"GIF87a", b"GIF89a")) and len(data) >= 10:
        width = int.from_bytes(data[6:8], "little")
        height = int.from_bytes(data[8:10], "little")

    if width and height:
        facts.pixelWidth = width
        facts.pixelHeight = height
        facts.orientation = (
            "landscape" if width > height else "portrait" if height > width else "square"
        )
    else:
        facts.notes.append("Could not read image dimensions from the header.")
    return facts


# ---------------------------------------------------------------- #
# Entry point                                                       #
# ---------------------------------------------------------------- #


def inspect_asset(asset: str) -> AssetFacts:
    """Measure one asset. Never raises: a bad file yields empty facts."""
    mime, data = decode_data_url(asset)
    if data is None:
        facts = AssetFacts(mime=mime)
        facts.notes.append(
            "Asset is not an inline upload; nothing could be measured."
        )
        return facts

    try:
        if mime == "application/pdf" or data.startswith(b"%PDF"):
            return read_pdf_facts(data)
        return read_image_facts(data, mime)
    except Exception as exc:  # noqa: BLE001 - measurement must never block
        logger.warning("Asset measurement failed: %s", exc)
        facts = AssetFacts(mime=mime, byteSize=len(data))
        facts.notes.append("Asset could not be parsed.")
        return facts


def describe_assets(assets: list[str], limit: int = 12) -> str:
    """Render measured facts as a block the curator can treat as given."""
    if not assets:
        return ""
    lines: list[str] = []
    for index, asset in enumerate(assets[:limit], start=1):
        facts = inspect_asset(asset)
        lines.append(f"- Asset {index}: {facts.summary()}")
        for note in facts.notes:
            lines.append(f"  note: {note}")
    if len(assets) > limit:
        lines.append(f"- (+{len(assets) - limit} further assets not measured)")
    return "\n".join(lines)
