#!/usr/bin/env python3
"""Collect deterministic evidence for the game-pr-readiness skill."""

from __future__ import annotations

import argparse
import json
import re
import struct
import subprocess
import sys
import xml.etree.ElementTree as ET
import zlib
from pathlib import Path
from typing import Any


IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}
SOURCE_SUFFIXES = {".svelte", ".ts", ".js", ".css", ".scss"}
IGNORED_PARTS = {"node_modules", ".svelte-kit", "build", "dist", "bundle", "esm"}


def git(*args: str, cwd: Path | None = None) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=cwd,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    return result.stdout.strip()


def changed_paths(base_ref: str, repo: Path) -> tuple[str, list[str]]:
    merge_base = git("merge-base", base_ref, "HEAD", cwd=repo)
    paths: set[str] = set()
    commands = [
        ("diff", "--name-only", f"{merge_base}..HEAD"),
        ("diff", "--name-only"),
        ("diff", "--cached", "--name-only"),
        ("ls-files", "--others", "--exclude-standard"),
    ]
    for command in commands:
        output = git(*command, cwd=repo)
        paths.update(line for line in output.splitlines() if line)
    return merge_base, sorted(paths)


def png_info(data: bytes) -> dict[str, Any]:
    if not data.startswith(b"\x89PNG\r\n\x1a\n"):
        raise ValueError("invalid PNG signature")
    width, height, bit_depth, color_type, _, _, interlace = struct.unpack(
        ">IIBBBBB", data[24:37]
    )
    chunks: list[tuple[bytes, bytes]] = []
    offset = 8
    while offset + 12 <= len(data):
        length = struct.unpack(">I", data[offset : offset + 4])[0]
        kind = data[offset + 4 : offset + 8]
        payload = data[offset + 8 : offset + 8 + length]
        chunks.append((kind, payload))
        offset += 12 + length
        if kind == b"IEND":
            break

    has_transparency: bool | None = False
    if color_type in (0, 2, 3):
        # A tRNS chunk only defines potentially transparent values. Proving that
        # pixels actually use them needs format-specific sample decoding.
        has_transparency = None if any(kind == b"tRNS" for kind, _ in chunks) else False
    elif color_type in (4, 6):
        if bit_depth != 8 or interlace != 0:
            has_transparency = None
        else:
            channels = 2 if color_type == 4 else 4
            stride = width * channels
            raw = zlib.decompress(b"".join(payload for kind, payload in chunks if kind == b"IDAT"))
            previous = bytearray(stride)
            position = 0
            transparent = False
            for _ in range(height):
                filter_type = raw[position]
                position += 1
                scan = bytearray(raw[position : position + stride])
                position += stride
                for index in range(stride):
                    left = scan[index - channels] if index >= channels else 0
                    up = previous[index]
                    upper_left = previous[index - channels] if index >= channels else 0
                    if filter_type == 1:
                        scan[index] = (scan[index] + left) & 255
                    elif filter_type == 2:
                        scan[index] = (scan[index] + up) & 255
                    elif filter_type == 3:
                        scan[index] = (scan[index] + ((left + up) // 2)) & 255
                    elif filter_type == 4:
                        estimate = left + up - upper_left
                        distances = (abs(estimate - left), abs(estimate - up), abs(estimate - upper_left))
                        predictor = (left, up, upper_left)[distances.index(min(distances))]
                        scan[index] = (scan[index] + predictor) & 255
                    elif filter_type != 0:
                        raise ValueError(f"unsupported PNG filter {filter_type}")
                if any(scan[index] < 255 for index in range(channels - 1, stride, channels)):
                    transparent = True
                    break
                previous = scan
            has_transparency = transparent
    return {
        "width": width,
        "height": height,
        "bit_depth": bit_depth,
        "color_type": color_type,
        "has_actual_transparency": has_transparency,
    }


def jpeg_dimensions(data: bytes) -> tuple[int, int]:
    if not data.startswith(b"\xff\xd8"):
        raise ValueError("invalid JPEG signature")
    offset = 2
    sof_markers = set(range(0xC0, 0xD4)) - {0xC4, 0xC8, 0xCC}
    while offset + 4 <= len(data):
        if data[offset] != 0xFF:
            offset += 1
            continue
        marker = data[offset + 1]
        offset += 2
        if marker in (0xD8, 0xD9) or 0xD0 <= marker <= 0xD7:
            continue
        length = struct.unpack(">H", data[offset : offset + 2])[0]
        if marker in sof_markers:
            height, width = struct.unpack(">HH", data[offset + 3 : offset + 7])
            return width, height
        offset += length
    raise ValueError("JPEG dimensions not found")


def image_info(path: Path, repo: Path) -> dict[str, Any]:
    result: dict[str, Any] = {
        "path": path.relative_to(repo).as_posix(),
        "bytes": path.stat().st_size,
    }
    try:
        if path.suffix.lower() == ".svg":
            root = ET.parse(path).getroot()
            result.update({"width": root.get("width"), "height": root.get("height"), "viewBox": root.get("viewBox")})
        else:
            data = path.read_bytes()
            suffix = path.suffix.lower()
            if suffix == ".png":
                result.update(png_info(data))
            elif suffix in (".jpg", ".jpeg"):
                result["width"], result["height"] = jpeg_dimensions(data)
                result["has_actual_transparency"] = False
            elif suffix == ".gif" and data[:6] in (b"GIF87a", b"GIF89a"):
                result["width"], result["height"] = struct.unpack("<HH", data[6:10])
            elif suffix == ".webp":
                if data[:4] != b"RIFF" or data[8:12] != b"WEBP":
                    raise ValueError("invalid WebP signature")
                kind = data[12:16]
                payload = data[20:]
                if kind == b"VP8X" and len(payload) >= 10:
                    result["width"] = 1 + int.from_bytes(payload[4:7], "little")
                    result["height"] = 1 + int.from_bytes(payload[7:10], "little")
                elif kind == b"VP8L" and len(payload) >= 5:
                    bits = int.from_bytes(payload[1:5], "little")
                    result["width"] = (bits & 0x3FFF) + 1
                    result["height"] = ((bits >> 14) & 0x3FFF) + 1
                elif kind == b"VP8 " and len(payload) >= 10 and payload[3:6] == b"\x9d\x01\x2a":
                    result["width"] = int.from_bytes(payload[6:8], "little") & 0x3FFF
                    result["height"] = int.from_bytes(payload[8:10], "little") & 0x3FFF
                else:
                    raise ValueError(f"unsupported WebP chunk {kind!r}")
    except Exception as error:
        result["error"] = str(error)
    return result


def source_files(roots: list[Path]) -> list[Path]:
    files: list[Path] = []
    for root in roots:
        for path in root.rglob("*"):
            if path.is_file() and path.suffix.lower() in SOURCE_SUFFIXES and not (set(path.parts) & IGNORED_PARTS):
                files.append(path)
    return sorted(files)


def find_hits(files: list[Path], patterns: dict[str, re.Pattern[str]]) -> dict[str, list[dict[str, Any]]]:
    hits = {name: [] for name in patterns}
    for path in files:
        try:
            lines = path.read_text(encoding="utf-8").splitlines()
        except UnicodeDecodeError:
            continue
        for number, line in enumerate(lines, 1):
            for name, pattern in patterns.items():
                if pattern.search(line):
                    hits[name].append({"path": path.as_posix(), "line": number, "text": line.strip()})
    return hits


def asset_references(images: list[Path], files: list[Path]) -> dict[str, list[dict[str, Any]]]:
    result: dict[str, list[dict[str, Any]]] = {}
    texts = [(path, path.read_text(encoding="utf-8", errors="ignore").splitlines()) for path in files]
    for image in images:
        references: list[dict[str, Any]] = []
        for path, lines in texts:
            for number, line in enumerate(lines, 1):
                if image.name in line:
                    references.append({"path": path.as_posix(), "line": number, "text": line.strip()})
        result[image.as_posix()] = references
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("slug", help="game directory slug, such as indonesia")
    parser.add_argument("--base", required=True, help="PR base ref or fixed comparison commit")
    parser.add_argument("--output", help="write JSON evidence to this file instead of stdout")
    args = parser.parse_args()

    repo = Path(git("rev-parse", "--show-toplevel"))
    logic_root = repo / "games" / args.slug
    ui_root = repo / "games" / f"{args.slug}-ui"
    if not logic_root.is_dir() or not ui_root.is_dir():
        parser.error(f"expected both {logic_root} and {ui_root}")

    merge_base, changes = changed_paths(args.base, repo)
    allowed = (f"games/{args.slug}/", f"games/{args.slug}-ui/")
    sources = source_files([logic_root, ui_root])
    images = sorted(
        path for path in ui_root.rglob("*")
        if path.is_file() and path.suffix.lower() in IMAGE_SUFFIXES and not (set(path.parts) & IGNORED_PARTS)
    )
    patterns = {
        "svelte_effect": re.compile(r"\$effect(?:\s*\(|\.(?:pre|root)\s*\()"),
        "thumbnail_url": re.compile(r"\bthumbnailUrl\b"),
        "gsap": re.compile(r"\bgsap\b|from\s+['\"]gsap"),
        "animation_context": re.compile(r"\banimationContext\b|\bAnimationContext\b"),
        "state_change_listener": re.compile(r"onGameStateChange|addGameStateChangeListener"),
        "non_gsap_animation": re.compile(
            r"animate:|transition:|\bin:|\bout:|@keyframes|\banimation(?:-[\w-]+)?\s*:|"
            r"\btransition(?:-[\w-]+)?\s*:|\.animate\s*\(|requestAnimationFrame|"
            r"setTimeout\s*\(|setInterval\s*\("
        ),
        "duration": re.compile(r"duration\s*:|ensureDuration\s*\(|repeat\s*:|delay\s*:"),
        "action_branch": re.compile(r"\baction\b"),
    }
    evidence = {
        "game": args.slug,
        "base_ref": args.base,
        "merge_base": merge_base,
        "allowed_roots": list(allowed),
        "changed_paths": changes,
        "outside_allowed_roots": [path for path in changes if not path.startswith(allowed)],
        "images": [image_info(path, repo) for path in images],
        "asset_references": asset_references(images, sources),
        "search_hits": find_hits(sources, patterns),
        "source_file_count": len(sources),
    }
    serialized = json.dumps(evidence, indent=2) + "\n"
    if args.output:
        Path(args.output).write_text(serialized, encoding="utf-8")
    else:
        sys.stdout.write(serialized)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
