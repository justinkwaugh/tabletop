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
SCRIPT_SUFFIXES = {".svelte", ".ts", ".js"}
IGNORED_PARTS = {"node_modules", ".svelte-kit", "build", "dist", "bundle", "esm"}
TEST_PARTS = {"test", "tests", "testing", "__tests__", "__mocks__", "fixtures", "e2e"}
TEST_NAME = re.compile(r"\.(?:spec|test|fixture)\.[^/]+$")
HARNESS_CAST = "UiDefinition as unknown as GameUiDefinition<GameState, HydratedGameState>"
CATALOGUE_PATH = "config/config-games/src/games.json"
LOCKFILE_PATH = "pnpm-lock.yaml"


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
        ">IIBBBBB", data[16:29]
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


def is_test_file(path: Path) -> bool:
    return bool(TEST_NAME.search(path.name) or set(path.parts) & TEST_PARTS)


def is_harness_cast(path: Path, ui_root: Path, text: str) -> bool:
    return path == ui_root / "src" / "routes" / "+page.svelte" and text == HARNESS_CAST


def type_escapes(files: list[Path], ui_root: Path, repo: Path) -> dict[str, Any]:
    script = Path(__file__).with_name("find_type_escapes.mjs")
    result = subprocess.run(
        ["node", str(script), str(ui_root)],
        input=json.dumps([path.as_posix() for path in files]),
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    violations: list[dict[str, Any]] = []
    exempt: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []
    for entry in json.loads(result.stdout):
        path = Path(entry["path"])
        relative = path.relative_to(repo).as_posix()
        if "error" in entry:
            errors.append({"path": relative, "error": entry["error"]})
            continue
        for finding in entry["findings"]:
            item = {"path": relative, **finding}
            if finding["kind"] == "cast" and is_harness_cast(path, ui_root, finding["text"]):
                exempt.append(item)
            else:
                violations.append(item)
    return {"violations": violations, "exempt_harness_casts": exempt, "unparsed_files": errors}


def schema_diff(merge_base: str, logic_root: Path, repo: Path) -> dict[str, list[str]]:
    output = git("diff", "--unified=0", merge_base, "--", logic_root.relative_to(repo).as_posix(), cwd=repo)
    changes: dict[str, list[str]] = {}
    current = ""
    for line in output.splitlines():
        if line.startswith("+++ ") or line.startswith("--- "):
            if line.startswith("+++ ") and line != "+++ /dev/null":
                current = line[6:]
            elif line.startswith("--- ") and line != "--- /dev/null":
                current = line[6:]
            continue
        if line[:1] in "+-" and re.search(r"\bType\.|Schema\b|\bschemas?\b", line):
            changes.setdefault(current, []).append(line)
    return changes


def css_encapsulation(ui_root: Path, sources: list[Path], repo: Path) -> dict[str, Any]:
    config = ui_root / "postcss.config.js"
    config_text = config.read_text(encoding="utf-8") if config.is_file() else ""
    prefix = re.search(r"data-game-ui=\"([^\"]+)\"", config_text)
    scoped_file = re.search(r"endsWith\('([^']+)'\)", config_text)
    imports: list[dict[str, Any]] = []
    for path in sources:
        if (
            not path.is_relative_to(ui_root)
            or path.suffix.lower() not in SCRIPT_SUFFIXES
            or "routes" in path.relative_to(ui_root).parts
        ):
            continue
        for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            match = re.search(r"import\s+['\"]([^'\"]+\.css)['\"]", line)
            if not match:
                continue
            target = match.group(1)
            resolved = (ui_root / "src" / "lib" / target[5:]) if target.startswith("$lib/") else (path.parent / target)
            resolved_text = resolved.resolve().as_posix()
            imports.append({
                "path": path.relative_to(repo).as_posix(),
                "line": number,
                "stylesheet": resolved.resolve().relative_to(repo).as_posix() if resolved.resolve().is_relative_to(repo) else resolved_text,
                "covered_by_scope_plugin": bool(scoped_file) and resolved_text.endswith(scoped_file.group(1)),
            })
    scan = subprocess.run(
        ["node", str(Path(__file__).with_name("scan_bundle_css.mjs")), str(ui_root)],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    bundle_index = ui_root / "bundle" / "index.js"
    site_css = repo / "apps" / "frontend" / "src" / "app.css"
    return {
        "site_tailwind_scans_title": site_css.is_file()
        and f"games/{ui_root.name}/" in site_css.read_text(encoding="utf-8"),
        "scope_prefix": prefix.group(1) if prefix else None,
        "scope_plugin_file": scoped_file.group(1) if scoped_file else None,
        "stylesheet_imports": imports,
        "bundle_built_at": bundle_index.stat().st_mtime if bundle_index.is_file() else None,
        "bundle_scan": json.loads(scan.stdout) if scan.returncode == 0 else {"error": scan.stderr.strip()[-500:]},
    }


def dev_harness(ui_root: Path) -> dict[str, bool]:
    page = ui_root / "src" / "routes" / "+page.svelte"
    scripts = json.loads((ui_root / "package.json").read_text(encoding="utf-8")).get("scripts", {})
    return {
        "dev_script": "dev" in scripts,
        "vite_config": (ui_root / "vite.config.ts").is_file(),
        "app_html": (ui_root / "src" / "app.html").is_file(),
        "harness_page": page.is_file(),
        "harness_page_renders_harness": page.is_file() and "<Harness" in page.read_text(encoding="utf-8"),
    }


def lockfile_sections(text: str) -> dict[str, Any]:
    sections: dict[str, Any] = {}
    section = ""
    entry = ""
    for line in text.splitlines():
        if line and not line.startswith(" "):
            section, entry = line, ""
            sections[section] = {"": []}
        elif line.startswith("  ") and not line.startswith("   ") and section:
            entry = line.strip()
            sections[section][entry] = [line]
        elif section:
            sections[section].setdefault(entry, []).append(line)
    return sections


def lockfile_change(merge_base: str, slug: str, repo: Path) -> dict[str, Any] | None:
    try:
        before = lockfile_sections(git("show", f"{merge_base}:{LOCKFILE_PATH}", cwd=repo))
        after = lockfile_sections((repo / LOCKFILE_PATH).read_text(encoding="utf-8"))
    except (subprocess.CalledProcessError, OSError):
        return None
    title_importers = {f"games/{slug}:", f"games/{slug}-ui:"}
    outside: list[str] = []
    added: list[str] = []
    for section in sorted(set(before) | set(after)):
        old, new = before.get(section, {}), after.get(section, {})
        for key in sorted(set(old) | set(new)):
            if old.get(key) == new.get(key):
                continue
            label = f"{section} {key}".strip()
            if section == "importers:" and key in title_importers:
                continue
            if section in ("packages:", "snapshots:") and key not in old:
                added.append(label)
                continue
            outside.append(label)
    frozen = subprocess.run(
        ["pnpm", "install", "--frozen-lockfile", "--lockfile-only"],
        cwd=repo,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    return {
        "changed": before != after,
        "added_package_entries": added,
        "changes_outside_title": outside,
        "frozen_lockfile_check": "passed" if frozen.returncode == 0 else frozen.stdout.strip()[-500:],
        "exempt": before != after and not outside and frozen.returncode == 0,
    }


def package_version(root: Path) -> str | None:
    return json.loads((root / "package.json").read_text(encoding="utf-8")).get("version")


def generated_version(logic_root: Path) -> str | None:
    path = logic_root / "src" / "definition" / "version.ts"
    if not path.is_file():
        return None
    match = re.search(r"GAME_VERSION\s*=\s*'([^']*)'", path.read_text(encoding="utf-8"))
    return match.group(1) if match else None


def release_tags(slug: str, repo: Path) -> dict[str, Any]:
    patterns = [f"refs/tags/{slug}-v*", f"refs/tags/{slug}-ui-v*"]
    remote = subprocess.run(
        ["git", "ls-remote", "--tags", "origin", *patterns],
        cwd=repo,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
    )
    if remote.returncode == 0:
        refs = [line.split("\t", 1)[1] for line in remote.stdout.splitlines() if "\t" in line]
        tags = sorted({ref.removeprefix("refs/tags/").removesuffix("^{}") for ref in refs})
        return {"source": "origin", "tags": tags}
    output = git("tag", "--list", f"{slug}-v*", f"{slug}-ui-v*", cwd=repo)
    return {"source": "local tags; origin unreachable", "tags": output.splitlines()}


def catalogue_addition(merge_base: str, slug: str, repo: Path) -> dict[str, Any] | None:
    try:
        before = json.loads(git("show", f"{merge_base}:{CATALOGUE_PATH}", cwd=repo))
        after = json.loads((repo / CATALOGUE_PATH).read_text(encoding="utf-8"))
    except (subprocess.CalledProcessError, OSError, json.JSONDecodeError):
        return None
    added = [entry for entry in after if entry.get("packageId") == slug]
    if len(added) != 1 or any(entry.get("packageId") == slug for entry in before):
        return None
    remaining = list(after)
    remaining.remove(added[0])
    return added[0] if remaining == before and set(added[0]) == {"gameId", "packageId"} else None


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
    production_sources = [path for path in sources if not is_test_file(path)]
    production_scripts = [path for path in production_sources if path.suffix.lower() in SCRIPT_SUFFIXES]
    logic_sources = [path for path in production_sources if path.is_relative_to(logic_root)]
    releases = release_tags(args.slug, repo)
    new_title = not releases["tags"]
    added_entry = catalogue_addition(merge_base, args.slug, repo) if new_title else None
    lockfile = lockfile_change(merge_base, args.slug, repo)
    exempt_paths = [CATALOGUE_PATH] if added_entry is not None else []
    if lockfile is not None and lockfile["exempt"]:
        exempt_paths.append(LOCKFILE_PATH)
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
        "animation_mechanism": re.compile(
            r"animate:|transition:|\bin:|\bout:|@keyframes|\banimation(?:-[\w-]+)?\s*:|"
            r"\btransition(?:-[\w-]+)?\s*:|\.animate\s*\(|requestAnimationFrame|"
            r"setTimeout\s*\(|setInterval\s*\("
        ),
        "animation_context_timeline": re.compile(
            r"animationContext\.(?:actionTimeline|finalTimeline|ensureDuration)|"
            r"\b(?:actionTimeline|finalTimeline)\b"
        ),
        "duration": re.compile(r"duration\s*:|ensureDuration\s*\(|repeat\s*:|delay\s*:"),
        "action_branch": re.compile(r"\baction\b"),
    }
    production_patterns = {
        "type_check_suppression": re.compile(r"@ts-(?:ignore|expect-error|nocheck)|eslint-disable"),
        "page_styling": re.compile(
            r"document\.(?:body|documentElement)\.(?:style|classList|className)|document\.head\.(?:append|insertBefore)|"
            r"createElement\(['\"]style|adoptedStyleSheets|insertRule\("
        ),
    }
    logic_patterns = {
        "nondeterminism": re.compile(
            r"Math\.random|Date\.now|new Date\(|randomUUID|performance\.now|crypto\.getRandomValues"
        ),
        "title_metadata": re.compile(
            r"\b(?:minPlayers|maxPlayers|defaultPlayerCount|beta|version)\s*:|GameVisibility\.\w+"
        ),
        "runtime_registration": re.compile(
            r"\b(?:canonicalStateValidator|randomnessVersion|supportsStartingPositions|scoring|visibility|"
            r"exploration)\s*[:=]|createEighteenXXRuntime|defineGame\s*\("
        ),
        "competition": re.compile(
            r"supportsStartingPositions|StartingPositionAssignment|startingPositions|"
            r"HydratedTurnManager\.generate|finalScores|validateGameResult|GameResult\.\w+|winningPlayerIds"
        ),
        "hidden_information_api": re.compile(
            r"Visibility\.(?:protect|Policy|createProjectionSchema|createProjector|createActionProjector)|"
            r"getProtectedPrng|protectedPrng|createFromProjectedState"
        ),
        "hidden_information_candidates": re.compile(
            r"\b(?:deck|bag|hand|hands|bid|bids|shuffle|draw|drawn|secret|hidden|private\w*|sealed|"
            r"concealed|faceDown)\b",
            re.IGNORECASE,
        ),
    }
    evidence = {
        "game": args.slug,
        "base_ref": args.base,
        "merge_base": merge_base,
        "allowed_roots": list(allowed),
        "changed_paths": changes,
        "outside_allowed_roots": [
            path for path in changes if not path.startswith(allowed) and path not in exempt_paths
        ],
        "exempt_catalogue_addition": added_entry,
        "lockfile_change": lockfile,
        "images": [image_info(path, repo) for path in images],
        "asset_references": asset_references(images, sources),
        "search_hits": find_hits(sources, patterns),
        "source_file_count": len(sources),
        "new_title": new_title,
        "release_tags": releases,
        "test_files_exempt_from_forbidden_constructs": sorted(
            path.relative_to(repo).as_posix() for path in sources if is_test_file(path)
        ),
        "type_escapes": type_escapes(production_scripts, ui_root, repo),
        "production_hits": find_hits(production_sources, production_patterns),
        "logic_hits": find_hits(logic_sources, logic_patterns),
        "versions": {
            "logic_package": package_version(logic_root),
            "ui_package": package_version(ui_root),
            "generated_game_version": generated_version(logic_root),
        },
        "dev_harness": dev_harness(ui_root),
        "css_encapsulation": css_encapsulation(ui_root, production_sources, repo),
        "competition_specs": sorted(
            path.relative_to(repo).as_posix()
            for path in logic_root.rglob("competition.*")
            if not (set(path.parts) & IGNORED_PARTS)
        ),
        "schema_diff": {} if new_title else schema_diff(merge_base, logic_root, repo),
    }
    serialized = json.dumps(evidence, indent=2) + "\n"
    if args.output:
        Path(args.output).write_text(serialized, encoding="utf-8")
    else:
        sys.stdout.write(serialized)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
