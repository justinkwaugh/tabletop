#!/usr/bin/env python3
"""Collect deterministic evidence for the game-pr-readiness skill."""

from __future__ import annotations

import argparse
import difflib
import json
import re
import struct
import subprocess
import sys
import unicodedata
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
PLATFORM_PACKAGES = {"@tabletop/common", "@tabletop/frontend-components"}
ACTION_PATCH_READ = re.compile(r"\b(?:undoPatch|forwardPatch)\b")


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


def webp_info(data: bytes) -> dict[str, Any]:
    if data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        raise ValueError("invalid WebP signature")
    kind = data[12:16]
    payload = data[20:]
    if kind == b"VP8 " and len(payload) >= 10 and payload[3:6] == b"\x9d\x01\x2a":
        return {
            "width": int.from_bytes(payload[6:8], "little") & 0x3FFF,
            "height": int.from_bytes(payload[8:10], "little") & 0x3FFF,
            "encoding": "webp-lossy",
            "has_actual_transparency": False,
        }
    # An alpha flag only says the file can hold transparency. Proving that pixels
    # use it needs a WebP decoder, so it is reported as unknown.
    if kind == b"VP8L" and len(payload) >= 5:
        bits = int.from_bytes(payload[1:5], "little")
        return {
            "width": (bits & 0x3FFF) + 1,
            "height": ((bits >> 14) & 0x3FFF) + 1,
            "encoding": "webp-lossless",
            "has_actual_transparency": None if bits >> 28 & 1 else False,
        }
    if kind == b"VP8X" and len(payload) >= 10:
        flags = payload[0]
        chunks: set[bytes] = set()
        offset = 12
        while offset + 8 <= len(data):
            chunks.add(data[offset : offset + 4])
            size = int.from_bytes(data[offset + 4 : offset + 8], "little")
            offset += 8 + size + size % 2
        if flags & 0x02:
            encoding = "webp-animated"
        elif b"VP8L" in chunks:
            encoding = "webp-lossless"
        elif b"VP8 " in chunks:
            encoding = "webp-lossy"
        else:
            raise ValueError("WebP image data not found")
        return {
            "width": 1 + int.from_bytes(payload[4:7], "little"),
            "height": 1 + int.from_bytes(payload[7:10], "little"),
            "encoding": encoding,
            "has_actual_transparency": None if flags & 0x10 else False,
        }
    raise ValueError(f"unsupported WebP chunk {kind!r}")


def blobs_at(commit: str, root: Path, repo: Path) -> set[str]:
    listing = git("ls-tree", "-r", commit, "--", root.relative_to(repo).as_posix(), cwd=repo)
    return {line.split()[2] for line in listing.splitlines() if line}


def image_info(path: Path, repo: Path, base_blobs: set[str]) -> dict[str, Any]:
    relative = path.relative_to(repo).as_posix()
    result: dict[str, Any] = {
        "path": relative,
        "bytes": path.stat().st_size,
        "existed_at_base": git("hash-object", "--", relative, cwd=repo) in base_blobs,
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
                result["encoding"] = "png"
            elif suffix in (".jpg", ".jpeg"):
                result["width"], result["height"] = jpeg_dimensions(data)
                result["encoding"] = "jpeg"
                result["has_actual_transparency"] = False
            elif suffix == ".gif" and data[:6] in (b"GIF87a", b"GIF89a"):
                result["width"], result["height"] = struct.unpack("<HH", data[6:10])
                result["encoding"] = "gif"
            elif suffix == ".webp":
                result.update(webp_info(data))
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


def family_library_roots(package_roots: list[Path], repo: Path) -> list[Path]:
    libraries = {}
    for package_json in (repo / "libs").glob("*/package.json"):
        libraries[json.loads(package_json.read_text(encoding="utf-8"))["name"]] = package_json.parent
    names: set[str] = set()
    for root in package_roots:
        manifest = json.loads((root / "package.json").read_text(encoding="utf-8"))
        names.update(manifest.get("dependencies", {}))
        names.update(manifest.get("devDependencies", {}))
    return sorted(libraries[name] for name in names - PLATFORM_PACKAGES if name in libraries)


def is_test_file(path: Path) -> bool:
    return bool(TEST_NAME.search(path.name) or set(path.parts) & TEST_PARTS)


def is_harness_cast(path: Path, ui_root: Path, text: str) -> bool:
    return path == ui_root / "src" / "routes" / "+page.svelte" and text == HARNESS_CAST


def run_node_scan(script_name: str, files: list[Path], ui_root: Path, repo: Path) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Runs a scanner script on files; returns its per-file results and the files it could not parse."""
    result = subprocess.run(
        ["node", str(Path(__file__).with_name(script_name)), str(ui_root)],
        input=json.dumps([path.as_posix() for path in files]),
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    entries: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []
    for entry in json.loads(result.stdout):
        entry["relative"] = Path(entry["path"]).relative_to(repo).as_posix()
        if "error" in entry:
            errors.append({"path": entry["relative"], "error": entry["error"]})
        else:
            entries.append(entry)
    return entries, errors


def type_escapes(files: list[Path], ui_root: Path, repo: Path) -> dict[str, Any]:
    entries, errors = run_node_scan("find_type_escapes.mjs", files, ui_root, repo)
    violations: list[dict[str, Any]] = []
    exempt: list[dict[str, Any]] = []
    for entry in entries:
        path = Path(entry["path"])
        for finding in entry["findings"]:
            item = {"path": entry["relative"], **finding}
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


def css_encapsulation(ui_root: Path, sources: list[Path], repo: Path, static: bool) -> dict[str, Any]:
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
    bundle_index = ui_root / "bundle" / "index.js"
    if static:
        bundle_scan: dict[str, Any] = {"not_run": "--static: any bundle/ predates this change"}
    else:
        scan = subprocess.run(
            ["node", str(Path(__file__).with_name("scan_bundle_css.mjs")), str(ui_root)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        bundle_scan = json.loads(scan.stdout) if scan.returncode == 0 else {"error": scan.stderr.strip()[-500:]}
    site_css = repo / "apps" / "frontend" / "src" / "app.css"
    return {
        "site_tailwind_scans_title": site_css.is_file()
        and f"games/{ui_root.name}/" in site_css.read_text(encoding="utf-8"),
        "scope_prefix": prefix.group(1) if prefix else None,
        "scope_plugin_file": scoped_file.group(1) if scoped_file else None,
        "stylesheet_imports": imports,
        "bundle_built_at": bundle_index.stat().st_mtime if bundle_index.is_file() else None,
        "bundle_scan": bundle_scan,
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


def lockfile_resolution(lines: list[str]) -> str:
    text = "\n".join(lines)
    match = re.search(r"resolution:\s*\{([^}]*)\}", text)
    if not match:
        return "unknown"
    fields = match.group(1).strip()
    return "registry" if re.fullmatch(r"integrity: [\w+/=-]+", fields) else fields


def lockfile_change(merge_base: str, slug: str, repo: Path, static: bool) -> dict[str, Any] | None:
    try:
        before = lockfile_sections(git("show", f"{merge_base}:{LOCKFILE_PATH}", cwd=repo))
        after = lockfile_sections((repo / LOCKFILE_PATH).read_text(encoding="utf-8"))
    except (subprocess.CalledProcessError, OSError):
        return None
    title_importers = {f"games/{slug}:", f"games/{slug}-ui:"}
    outside: list[str] = []
    added: list[str] = []
    resolutions: list[dict[str, str]] = []
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
                if section == "packages:":
                    resolutions.append({"entry": key.rstrip(":"), "resolution": lockfile_resolution(new[key])})
                continue
            outside.append(label)
    if static:
        return {
            "changed": before != after,
            "added_package_entries": added,
            "added_package_resolutions": resolutions,
            "changes_outside_title": outside,
            "frozen_lockfile_check": "not run: --static",
            "exempt": before != after and not outside,
        }
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
        "added_package_resolutions": resolutions,
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


def base_manifest(root: Path, merge_base: str, repo: Path) -> dict[str, Any]:
    try:
        return json.loads(git("show", f"{merge_base}:{(root / 'package.json').relative_to(repo).as_posix()}", cwd=repo))
    except (subprocess.CalledProcessError, json.JSONDecodeError):
        return {}


def release_owned_changes(
    merge_base: str, logic_root: Path, ui_root: Path, changes: list[str], new_title: bool, repo: Path
) -> dict[str, Any] | None:
    if new_title:
        return None
    version_module = (logic_root / "src" / "definition" / "version.ts").relative_to(repo).as_posix()
    package_versions = []
    for root in (logic_root, ui_root):
        base = base_manifest(root, merge_base, repo).get("version")
        current = package_version(root)
        if base != current:
            package_versions.append({"package": root.relative_to(repo).as_posix(), "base": base, "current": current})
    return {"version_module_changed": version_module in changes, "package_versions": package_versions}


def state_shape(files: list[Path], ui_root: Path, repo: Path) -> dict[str, Any]:
    scripts = [path for path in files if path.suffix in {".ts", ".js"}]
    entries, errors = run_node_scan("scan_state_shape.mjs", scripts, ui_root, repo)
    return {
        "object_schemas": [
            {"path": entry["relative"], **schema} for entry in entries for schema in entry["schemas"]
        ],
        "constant_tables": [
            {"path": entry["relative"], **table} for entry in entries for table in entry["tables"]
        ] + [
            {"path": path.relative_to(repo).as_posix(), "bytes": path.stat().st_size}
            for path in files
            if path.suffix == ".json"
        ],
        "unparsed_files": errors,
    }


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


UNTRUSTED_SCRIPT_SUFFIXES = {".svelte", ".ts", ".js", ".mjs", ".cjs", ".mts", ".cts", ".jsx", ".tsx"}
STYLE_SUFFIXES = {".css", ".scss", ".svelte"}
TOOL_CONFIG_NAMES = {
    "CLAUDE.md", "CLAUDE.local.md", "AGENTS.md", "GEMINI.md", "SKILL.md", ".cursorrules", ".windsurfrules",
    ".mcp.json", ".npmrc", ".yarnrc", ".yarnrc.yml", ".pnpmfile.cjs", "pnpm-workspace.yaml", "package-lock.json",
    "yarn.lock", "pnpm-lock.yaml", ".gitattributes", ".gitmodules", "Dockerfile", "Makefile",
}
TOOL_CONFIG_DIRS = {".claude", ".agents", ".cursor", ".github", ".vscode", ".idea", ".devcontainer", ".husky", ".githooks"}
LIFECYCLE_SCRIPTS = {"preinstall", "install", "postinstall", "prepare", "preprepare", "postprepare", "prepublish", "prepack", "postpack"}
COMMON_PACKAGE_FIELDS = {
    "name", "version", "private", "type", "description", "license", "author", "scripts", "dependencies",
    "devDependencies", "peerDependencies", "exports", "main", "module", "types", "svelte", "files", "sideEffects",
    "imports", "typesVersions",
}
AGENT_DIRECTED = re.compile(
    r"ignore (?:all |any )?(?:previous|prior|above|earlier) (?:instructions|rules)|system prompt|\bas an ai\b|"
    r"\byou are (?:an? |the )?(?:ai|llm|language model|assistant|agent|reviewer)\b|"
    r"\b(?:claude|chatgpt|codex|copilot|gemini|llm|anthropic|openai)\b|<\s*/?\s*(?:system|instructions?|assistant)\s*>|"
    r"\breviewers?\b|\b(?:automated|ai) (?:review|reviewer|agent)s?\b|\breadiness\b|\bgate \d+\b",
    re.IGNORECASE,
)
CSS_REMOTE = re.compile(r"url\(\s*['\"]?(?:https?:)?//|@import\s+(?:url\()?\s*['\"]?(?:https?:)?//", re.IGNORECASE)
SVG_HAZARDS = {
    "script": re.compile(r"<script\b", re.IGNORECASE),
    "event_handler": re.compile(r"\son[a-z]+\s*=", re.IGNORECASE),
    "foreign_object": re.compile(r"<foreignObject\b", re.IGNORECASE),
    "external_reference": re.compile(r"(?:xlink:)?href\s*=\s*[\"'](?:(?!data:image/)[a-z][a-z0-9+.-]*:|//)", re.IGNORECASE),
    "external_css": re.compile(r"url\(\s*['\"]?(?:(?!data:image/)[a-z][a-z0-9+.-]*:|//)", re.IGNORECASE),
    "doctype_or_entity": re.compile(r"<!DOCTYPE|<!ENTITY", re.IGNORECASE),
    "embedded_document": re.compile(r"<(?:iframe|embed|object|html|body)\b", re.IGNORECASE),
}
OTHER_SCRIPT_SUFFIXES = {".py", ".sh", ".bash", ".zsh", ".html", ".htm", ".ps1", ".rb", ".pl"}
OTHER_SCRIPT_CAPABILITIES = {
    "network": re.compile(r"\b(?:urllib|requests|httpx|aiohttp|http\.client|socket|curl|wget)\b|<script\b[^>]*\bsrc="),
    "process": re.compile(r"\b(?:subprocess|os\.system|os\.popen|os\.exec\w*|pty)\b|\$\("),
    "evaluated_code": re.compile(
        r"(?<![\w.])(?:eval|exec|compile|__import__)\s*\(|\b(?:importlib|pickle\.loads?|marshal\.loads?)\b|<script\b"
    ),
    "environment": re.compile(r"\bos\.environ\b|\bgetenv\b|\$\{?[A-Z_]{3,}\}?"),
    "remote_url": re.compile(r"\b(?:https?|wss?|ftp)://(?!localhost|127\.0\.0\.1|www\.w3\.org/)", re.IGNORECASE),
}
HOST_ACCESS = re.compile(
    r"(?<![\w.])getContext\s*\(|\.(?:api|authorizationBridge|chatBridge|notifications|chatService|gameService|bridge)\b|"
    r"\[\s*['\"`](?:api|authorizationBridge|chatBridge|notifications|chatService|gameService|bridge)['\"`]\s*\]|"
    r"\bsetGameState\s*\("
)
DEVELOPER_GATES = re.compile(r"\b(?:isDeveloperHarness|isActingAdmin|showDebug)\b")
SIGNATURES = [
    (b"\x89PNG\r\n\x1a\n", "png"), (b"\xff\xd8\xff", "jpeg"), (b"GIF87a", "gif"), (b"GIF89a", "gif"),
    (b"wOFF", "woff"), (b"wOF2", "woff2"), (b"\x00\x01\x00\x00", "ttf"), (b"OTTO", "otf"), (b"\x00asm", "wasm"),
    (b"\x7fELF", "elf"), (b"PK\x03\x04", "zip"), (b"\x1f\x8b", "gzip"), (b"%PDF", "pdf"), (b"OggS", "ogg"),
    (b"ID3", "mp3"), (b"MZ", "windows-executable"), (b"\xcf\xfa\xed\xfe", "mach-o"), (b"\xca\xfe\xba\xbe", "mach-o"),
]
EXPECTED_SIGNATURE = {
    ".png": "png", ".jpg": "jpeg", ".jpeg": "jpeg", ".gif": "gif", ".webp": "webp", ".woff": "woff",
    ".woff2": "woff2", ".ttf": "ttf", ".otf": "otf", ".ogg": "ogg", ".mp3": "mp3", ".wav": "wav", ".pdf": "pdf",
}


GENERATED_MARKER = re.compile(r"generated by|@generated|do not edit|auto-?generated", re.IGNORECASE)
VERSION_MODULE_HEADER = "// Generated by tools/scripts/write-game-version.cjs"


def generated_reason(path: Path, text: str) -> str | None:
    if text.startswith(VERSION_MODULE_HEADER):
        return None
    if ".generated." in path.name:
        return "file name marks it generated"
    head = "\n".join(text.splitlines()[:5])
    if GENERATED_MARKER.search(head):
        return "header marks it generated"
    if path.suffix.lower() in UNTRUSTED_SCRIPT_SUFFIXES | {".css"}:
        for line in text.splitlines():
            if len(line) > 500 and sum(line.count(mark) for mark in "{}();=") > len(line) / 20:
                return "minified: long lines dense with code"
    return None


def title_files(roots: list[Path], repo: Path) -> list[Path]:
    output = git(
        "ls-files", "--cached", "--others", "--exclude-standard", "--",
        *(root.relative_to(repo).as_posix() for root in roots), cwd=repo,
    )
    return sorted(
        repo / line for line in output.splitlines()
        if line and ((repo / line).is_symlink() or (repo / line).is_file())
    )


def gltf_buffers(files: list[Path]) -> set[Path]:
    buffers: set[Path] = set()
    for path in files:
        if path.suffix.lower() != ".gltf":
            continue
        try:
            entries = json.loads(path.read_text(encoding="utf-8")).get("buffers", [])
        except (json.JSONDecodeError, UnicodeDecodeError, AttributeError):
            continue
        for entry in entries:
            uri = entry.get("uri") if isinstance(entry, dict) else None
            if isinstance(uri, str) and not uri.startswith("data:") and (path.parent / uri).is_file():
                buffer = (path.parent / uri).resolve()
                if buffer.stat().st_size == entry.get("byteLength"):
                    buffers.add(buffer)
    return buffers


def file_signature(data: bytes) -> str | None:
    if data[:4] == b"RIFF" and data[8:12] in (b"WEBP", b"WAVE"):
        return "webp" if data[8:12] == b"WEBP" else "wav"
    if data[:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2"):
        return "mp3"
    return next((kind for signature, kind in SIGNATURES if data.startswith(signature)), None)


def normalized_for_title(text: str, slug: str) -> str:
    text = text.replace(f"{slug}-ui", "<slug>-ui").replace(slug, "<slug>")
    return re.sub(r"data-game-ui=\"[^\"]*\"", 'data-game-ui="<id>"', text)


def other_titles(slug: str, repo: Path) -> list[str]:
    games = repo / "games"
    return sorted(
        path.name for path in games.iterdir()
        if path.is_dir() and path.name != slug and not path.name.endswith("-ui") and (games / f"{path.name}-ui").is_dir()
    )


def standard_comparison(path: Path, suffix: str, slug: str, titles: list[str], repo: Path) -> dict[str, Any]:
    own = normalized_for_title(path.read_text(encoding="utf-8", errors="replace"), slug)
    variants: dict[str, int] = {}
    for title in titles:
        sibling = repo / "games" / f"{title}{suffix}" / path.name
        if sibling.is_file():
            text = normalized_for_title(sibling.read_text(encoding="utf-8", errors="replace"), title)
            variants[text] = variants.get(text, 0) + 1
    result: dict[str, Any] = {
        "titles_with_this_file": sum(variants.values()),
        "titles_with_identical_file": variants.get(own, 0),
    }
    if variants and own not in variants:
        closest = max(variants, key=lambda text: difflib.SequenceMatcher(None, own, text).ratio())
        diff = list(difflib.unified_diff(closest.splitlines(), own.splitlines(), "closest sibling", path.name, lineterm=""))
        result["closest_sibling_titles"] = variants[closest]
        result["diff_from_closest_sibling"] = diff[:120]
    return result


def build_surface(slug: str, roots: list[tuple[Path, str]], files: list[Path], changes: list[str], repo: Path) -> dict[str, Any]:
    titles = other_titles(slug, repo)
    configs: list[dict[str, Any]] = []
    scripts: list[dict[str, Any]] = []
    unusual_fields: list[dict[str, Any]] = []
    referenced: list[dict[str, Any]] = []
    for root, suffix in roots:
        relative_root = root.relative_to(repo).as_posix()
        for path in files:
            parent = path.parent
            is_config = parent == root and re.search(r"\.config\.[cm]?[jt]s$|^babel\.config|^\.babelrc", path.name)
            if is_config or (path.is_relative_to(root / "scripts") and path.suffix in UNTRUSTED_SCRIPT_SUFFIXES | {".sh", ".py"}):
                relative = path.relative_to(repo).as_posix()
                configs.append({
                    "path": relative,
                    "changed": relative in changes,
                    **standard_comparison(path, suffix, slug, titles, repo),
                })
        manifest = json.loads((root / "package.json").read_text(encoding="utf-8"))
        sibling_scripts: dict[str, dict[str, int]] = {}
        for title in titles:
            sibling = repo / "games" / f"{title}{suffix}" / "package.json"
            if sibling.is_file():
                for name, command in json.loads(sibling.read_text(encoding="utf-8")).get("scripts", {}).items():
                    counts = sibling_scripts.setdefault(name, {})
                    key = normalized_for_title(command, title)
                    counts[key] = counts.get(key, 0) + 1
        for name, command in manifest.get("scripts", {}).items():
            counts = sibling_scripts.get(name, {})
            normalized = normalized_for_title(command, slug)
            entry: dict[str, Any] = {
                "package": relative_root,
                "script": name,
                "command": command,
                "lifecycle_or_hook": name in LIFECYCLE_SCRIPTS
                or any(name.startswith(prefix) and name[len(prefix):] in manifest["scripts"] for prefix in ("pre", "post")),
                "titles_with_identical_script": counts.get(normalized, 0),
            }
            if counts and normalized not in counts:
                entry["most_common_sibling_command"] = max(counts, key=counts.get)
            scripts.append(entry)
            for token in re.findall(r"[\w./-]+\.(?:[cm]?[jt]s|sh|py)\b", command):
                target = (root / token).resolve()
                if target.is_relative_to(repo):
                    referenced.append({
                        "package": relative_root,
                        "script": name,
                        "file": target.relative_to(repo).as_posix(),
                        "inside_title": any(target.is_relative_to(own_root) for own_root, _ in roots),
                    })
        extra = sorted(set(manifest) - COMMON_PACKAGE_FIELDS)
        if extra:
            unusual_fields.append({"package": relative_root, "fields": {key: manifest[key] for key in extra}})
    return {
        "executed_files": configs,
        "package_scripts": scripts,
        "script_referenced_files": referenced,
        "unusual_package_fields": unusual_fields,
    }


def declared_dependencies(root: Path, merge_base: str, repo: Path) -> list[dict[str, Any]]:
    manifest = json.loads((root / "package.json").read_text(encoding="utf-8"))
    before = base_manifest(root, merge_base, repo)
    result: list[dict[str, Any]] = []
    for field in ("dependencies", "devDependencies", "peerDependencies", "optionalDependencies"):
        for name, spec in manifest.get(field, {}).items():
            if spec.startswith("workspace:"):
                source = "workspace"
            elif re.match(r"^(?:git|github:|https?:|file:|link:|npm:)|^[\w-]+/[\w.-]+(?:#.*)?$", spec):
                source = "non-registry"
            else:
                source = "registry"
            result.append({
                "package": root.relative_to(repo).as_posix(),
                "field": field,
                "name": name,
                "spec": spec,
                "source": source,
                "added_since_base": name not in before.get(field, {}),
                "changed_since_base": before.get(field, {}).get(name, spec) != spec,
            })
    return result


def text_hazards(path: Path, text: str, repo: Path) -> list[dict[str, Any]]:
    hazards: list[dict[str, Any]] = []
    for number, line in enumerate(text.splitlines(), 1):
        characters = sorted({
            f"U+{ord(character):04X} {unicodedata.name(character, 'UNNAMED')}"
            for index, character in enumerate(line)
            if unicodedata.category(character) == "Cf" and not (number == 1 and index == 0 and character == "﻿")
        })
        if characters:
            hazards.append({"path": path.relative_to(repo).as_posix(), "line": number, "characters": characters})
    return hazards


CONFIG_FILE_PACKAGES = {
    r"^\.prettierrc|^prettier\.config\.": "prettier",
    r"^eslint\.config\.": "eslint",
    r"^babel\.config\.|^\.babelrc": "@babel/core",
    r"^postcss\.config\.": "postcss",
    r"^tailwind\.config\.": "tailwindcss",
    r"^vite\.config\.": "vite",
    r"^vitest\.config\.": "vitest",
    r"^playwright\.config\.": "@playwright/test",
    r"^svelte\.config\.": "svelte",
    r"^tsconfig.*\.json$": "typescript",
}


def installed_manifest(root: Path, name: str) -> dict[str, Any]:
    path = root / "node_modules" / name / "package.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.is_file() else {}


def unused_dependencies(
    roots: list[Path], declared: dict[Path, list[dict[str, Any]]], used_packages: dict[Path, set[str]],
    files: list[Path], repo: Path,
) -> list[dict[str, Any]]:
    workspace = {}
    for package_json in [*repo.glob("libs/*/package.json"), *repo.glob("config/*/package.json"), *repo.glob("tools/*/package.json")]:
        manifest = json.loads(package_json.read_text(encoding="utf-8"))
        workspace[manifest.get("name")] = manifest
    unused: list[dict[str, Any]] = []
    for root in roots:
        own = [path for path in files if path.is_relative_to(root)]
        texts = "\n".join(
            path.read_text(encoding="utf-8", errors="ignore") for path in own
            if path.name != "package.json" and path.suffix.lower() not in IMAGE_SUFFIXES | set(EXPECTED_SIGNATURE)
        )
        manifest = json.loads((root / "package.json").read_text(encoding="utf-8"))
        script_words = set(re.findall(r"[\w@./:-]+", " ".join(manifest.get("scripts", {}).values())))
        external = [
            dependency["name"] for dependency in declared[root]
            if dependency["source"] != "workspace" and dependency["field"] != "peerDependencies"
        ]
        used: set[str] = set()
        for dependency in declared[root]:
            if dependency["source"] == "workspace" and dependency["name"] in workspace:
                used |= set(workspace[dependency["name"]].get("peerDependencies", {}))
        for pattern, package in CONFIG_FILE_PACKAGES.items():
            if any(path.parent == root and re.search(pattern, path.name) for path in own):
                used.add(package)
        for name in external:
            base = name.removeprefix("@types/")
            base = "@" + base.replace("__", "/") if name.startswith("@types/") and "__" in base else base
            bins = installed_manifest(root, name).get("bin", {})
            bin_names = {name.split("/")[-1]} if isinstance(bins, str) else set(bins)
            if (
                name in used_packages[root]
                or (name != base and base in used_packages[root])
                or re.search(r"['\"`]" + re.escape(name) + r"(?:/[^'\"`]*)?['\"`]|node_modules/" + re.escape(name) + r"\b", texts)
                or bin_names & script_words
            ):
                used.add(name)
        changed = True
        while changed:
            before = len(used)
            for name in list(used):
                used |= set(installed_manifest(root, name).get("peerDependencies", {}))
            changed = len(used) != before
        for dependency in declared[root]:
            if dependency["name"] in external and dependency["name"] not in used:
                unused.append({"package": root.relative_to(repo).as_posix(), "field": dependency["field"], "name": dependency["name"]})
    return unused


def untrusted_code(
    slug: str, logic_root: Path, ui_root: Path, merge_base: str, changes: list[str],
    lockfile: dict[str, Any] | None, repo: Path,
) -> dict[str, Any]:
    roots = [logic_root, ui_root]
    listed = title_files(roots, repo)
    files = [path for path in listed if not path.is_symlink()]
    scripts = [path for path in files if path.suffix.lower() in UNTRUSTED_SCRIPT_SUFFIXES]
    scan = subprocess.run(
        ["node", str(Path(__file__).with_name("scan_untrusted_code.mjs")), str(ui_root)],
        input=json.dumps([path.as_posix() for path in scripts]),
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    declared = {root: declared_dependencies(root, merge_base, repo) for root in roots}
    workspace_manifest = json.loads((repo / "package.json").read_text(encoding="utf-8"))
    root_names = set(workspace_manifest.get("dependencies", {})) | set(workspace_manifest.get("devDependencies", {}))
    capabilities: list[dict[str, Any]] = []
    imports: dict[str, list[dict[str, Any]]] = {"node_builtin": [], "url": [], "undeclared_package": [], "outside_title": []}
    logic_packages: set[str] = set()
    host_access: list[dict[str, Any]] = []
    developer_gates: list[dict[str, Any]] = []
    used_packages: dict[Path, set[str]] = {root: set() for root in roots}
    unparsed: list[dict[str, Any]] = []
    for entry in json.loads(scan.stdout):
        path = Path(entry["path"])
        relative = path.relative_to(repo).as_posix()
        package = logic_root if path.is_relative_to(logic_root) else ui_root
        if "error" in entry:
            unparsed.append({"path": relative, "error": entry["error"]})
            continue
        for finding in entry["findings"]:
            if finding["kind"] in ("timer", "browser_global") and package == ui_root:
                continue
            if finding["kind"] == "logging" and not (path.is_relative_to(logic_root / "src") and not is_test_file(path)):
                continue
            capabilities.append({
                "path": relative,
                "test": is_test_file(path),
                "harness_route": path.is_relative_to(ui_root / "src" / "routes"),
                **finding,
            })
        names = {dependency["name"] for dependency in declared[package]} | root_names
        for item in entry["imports"]:
            record = {"path": relative, "line": item["line"], "specifier": item["specifier"], "form": item["form"], "test": is_test_file(path)}
            used_packages[package].add(item["package"])
            if item["class"] == "node_builtin":
                used_packages[package].add("node")
            if item["class"] in ("node_builtin", "url"):
                imports[item["class"]].append(record)
            target = item["specifier"].split("?", 1)[0]
            if item["class"] == "local" and target.startswith((".", "/")):
                resolved = Path(target) if target.startswith("/") else (path.parent / target).resolve()
                if not any(resolved.is_relative_to(root) for root in roots):
                    imports["outside_title"].append(record)
            if path.is_relative_to(logic_root / "src") and item["class"] in ("external", "workspace") and not is_test_file(path):
                logic_packages.add(item["package"])
            if item["class"] in ("external", "workspace") and item["package"] not in names:
                imports["undeclared_package"].append(record)
    tool_configs: list[str] = []
    hazards: list[dict[str, Any]] = []
    agent_text: list[dict[str, Any]] = []
    svg: list[dict[str, Any]] = []
    binaries: list[dict[str, Any]] = []
    symlinks: list[dict[str, str]] = []
    generated: list[dict[str, str]] = []
    model_buffers = gltf_buffers(files)
    for path in listed:
        relative = path.relative_to(repo).as_posix()
        if path.is_symlink():
            symlinks.append({"path": relative, "target": str(path.readlink())})
            continue
        parts = set(path.relative_to(repo).parts)
        if path.name in TOOL_CONFIG_NAMES or parts & TOOL_CONFIG_DIRS or path.name.startswith(".env"):
            tool_configs.append(relative)
        data = path.read_bytes()
        suffix = path.suffix.lower()
        signature = file_signature(data)
        expected = EXPECTED_SIGNATURE.get(suffix)
        try:
            text = data.decode("utf-8")
        except UnicodeDecodeError:
            text = None
        if text is None or expected:
            if path.resolve() in model_buffers and signature is None:
                continue
            if signature != expected or (text is None and expected is None):
                binaries.append({"path": relative, "bytes": len(data), "detected": signature or "unknown", "expected": expected})
            continue
        hazards.extend(text_hazards(path, text, repo))
        reason = generated_reason(path, text)
        if reason:
            generated.append({"path": relative, "reason": reason})
        for number, line in enumerate(text.splitlines(), 1):
            if AGENT_DIRECTED.search(line):
                agent_text.append({"path": relative, "line": number, "text": line.strip()[:200]})
            finding = {"path": relative, "test": is_test_file(path), "harness_route": False, "line": number, "text": line.strip()[:200]}
            if suffix in STYLE_SUFFIXES and CSS_REMOTE.search(line):
                capabilities.append({**finding, "kind": "remote_url"})
            if suffix in OTHER_SCRIPT_SUFFIXES:
                for kind, pattern in OTHER_SCRIPT_CAPABILITIES.items():
                    if pattern.search(line):
                        capabilities.append({**finding, "kind": kind})
            if path.is_relative_to(ui_root) and suffix in UNTRUSTED_SCRIPT_SUFFIXES and not is_test_file(path):
                if HOST_ACCESS.search(line):
                    host_access.append({"path": relative, "line": number, "text": line.strip()[:200]})
                if DEVELOPER_GATES.search(line):
                    developer_gates.append({"path": relative, "line": number, "text": line.strip()[:200]})
        if suffix == ".svg":
            found = sorted(name for name, pattern in SVG_HAZARDS.items() if pattern.search(text))
            if found:
                svg.append({"path": relative, "hazards": found})
    dependencies = [dependency for root in roots for dependency in declared[root]]
    return {
        "files_scanned": len(listed),
        "unparsed_files": unparsed,
        "capabilities": capabilities,
        "imports": imports,
        "logic_packages": sorted(logic_packages),
        "host_access": host_access,
        "developer_gates": developer_gates,
        "unused_dependencies": unused_dependencies(roots, declared, used_packages, files, repo),
        "dependencies_to_review": [
            dependency for dependency in dependencies
            if dependency["source"] == "non-registry"
            or (dependency["source"] == "registry" and (dependency["added_since_base"] or dependency["changed_since_base"]))
        ],
        "added_lockfile_packages": (lockfile or {}).get("added_package_resolutions", []),
        "build_surface": build_surface(slug, [(logic_root, ""), (ui_root, "-ui")], files, changes, repo),
        "tool_config_files": tool_configs,
        "text_hazards": hazards,
        "agent_directed_text": agent_text,
        "svg_hazards": svg,
        "unexpected_binary_files": binaries,
        "symlinks": symlinks,
        "generated_files": generated,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("slug", help="game directory slug, such as indonesia")
    parser.add_argument("--base", required=True, help="PR base ref or fixed comparison commit")
    parser.add_argument("--output", help="write JSON evidence to this file instead of stdout")
    parser.add_argument(
        "--static",
        action="store_true",
        help="run nothing the change can alter, for the untrusted-code gate before the title is installed",
    )
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
    lockfile = lockfile_change(merge_base, args.slug, repo, args.static)
    exempt_paths = [CATALOGUE_PATH] if added_entry is not None else []
    if lockfile is not None and lockfile["exempt"]:
        exempt_paths.append(LOCKFILE_PATH)
    family_roots = family_library_roots([logic_root, ui_root], repo)
    family_sources = [path for path in source_files([root / "src" for root in family_roots]) if not is_test_file(path)]
    logic_family_roots = [root for root in family_roots if not root.name.endswith("-ui")]
    state_sources = logic_sources + [
        path for path in family_sources if any(path.is_relative_to(root) for root in logic_family_roots)
    ] + sorted(
        path for path in (logic_root / "src").rglob("*.json")
        if not is_test_file(path) and not (set(path.parts) & IGNORED_PARTS)
    )
    images = sorted(
        path for path in ui_root.rglob("*")
        if path.is_file() and path.suffix.lower() in IMAGE_SUFFIXES and not (set(path.parts) & IGNORED_PARTS)
    )
    base_blobs = blobs_at(merge_base, ui_root, repo)
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
        "action_patch_read": ACTION_PATCH_READ,
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
        "static": args.static,
        "merge_base": merge_base,
        "allowed_roots": list(allowed),
        "changed_paths": changes,
        "outside_allowed_roots": [
            path for path in changes if not path.startswith(allowed) and path not in exempt_paths
        ],
        "exempt_catalogue_addition": added_entry,
        "lockfile_change": lockfile,
        "images": [image_info(path, repo, base_blobs) for path in images],
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
        "family_libraries": [root.relative_to(repo).as_posix() for root in family_roots],
        "family_library_hits": find_hits(family_sources, {"action_patch_read": ACTION_PATCH_READ}),
        "versions": {
            "logic_package": package_version(logic_root),
            "ui_package": package_version(ui_root),
            "generated_game_version": generated_version(logic_root),
        },
        "release_owned_changes": release_owned_changes(merge_base, logic_root, ui_root, changes, new_title, repo),
        "state_shape": state_shape(state_sources, ui_root, repo),
        "dev_harness": dev_harness(ui_root),
        "css_encapsulation": css_encapsulation(ui_root, production_sources, repo, args.static),
        "competition_specs": sorted(
            path.relative_to(repo).as_posix()
            for path in logic_root.rglob("competition.*")
            if not (set(path.parts) & IGNORED_PARTS)
        ),
        "schema_diff": {} if new_title else schema_diff(merge_base, logic_root, repo),
        "untrusted_code": untrusted_code(args.slug, logic_root, ui_root, merge_base, changes, lockfile, repo),
    }
    serialized = json.dumps(evidence, indent=2) + "\n"
    if args.output:
        Path(args.output).write_text(serialized, encoding="utf-8")
    else:
        sys.stdout.write(serialized)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
