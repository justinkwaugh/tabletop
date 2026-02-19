#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const BOARD_GEOMETRY_PATH = path.join(projectRoot, 'src/lib/definitions/boardGeometry.ts');
const PREVIEW_OUT_PATH = path.join(projectRoot, 'src/lib/images/northeast_tuned_preview.svg');
const PATHS_OUT_PATH = path.join(projectRoot, 'src/lib/images/northeast_tuned_paths.txt');

const MAP_WIDTH = 2646;
const MAP_HEIGHT = 1280;
const MAP_HREF = 'indo_map_sm.jpg';

function parseArgs(argv) {
    const out = {
        sx: 1,
        sy: 1,
        dx: 0,
        dy: 0,
        ox: null,
        oy: null,
        apply: false,
        previewOut: PREVIEW_OUT_PATH,
        pathsOut: PATHS_OUT_PATH
    };

    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];
        if (token === '--') continue;
        if (!token.startsWith('--')) continue;
        const key = token.slice(2);
        const next = argv[i + 1];
        const hasValue = next !== undefined && !next.startsWith('--');
        const value = hasValue ? next : 'true';
        if (hasValue) i += 1;

        switch (key) {
            case 'sx':
            case 'sy':
            case 'dx':
            case 'dy':
            case 'ox':
            case 'oy': {
                const n = Number(value);
                if (!Number.isFinite(n)) throw new Error(`Invalid numeric value for --${key}: ${value}`);
                out[key] = n;
                break;
            }
            case 'apply':
                out.apply = value !== 'false';
                break;
            case 'preview-out':
                out.previewOut = path.isAbsolute(value) ? value : path.resolve(projectRoot, value);
                break;
            case 'paths-out':
                out.pathsOut = path.isAbsolute(value) ? value : path.resolve(projectRoot, value);
                break;
            default:
                throw new Error(`Unknown argument: --${key}`);
        }
    }

    return out;
}

function fmt(n) {
    const v = Math.round(n * 100) / 100;
    if (Math.abs(v) < 1e-9) return '0';
    return v.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

function readNortheastPaths(boardText) {
    const constMap = new Map();
    const constRe = /const\s+(NE_E\d{2}_PATH)\s*=\s*`([\s\S]*?)`;/g;
    for (const m of boardText.matchAll(constRe)) {
        constMap.set(m[1], m[2]);
    }

    const blockMatch = boardText.match(
        /export const NORTHEAST_ISLAND_AREAS: BoardAreaGeometry\[] = \[([\s\S]*?)\n\]/
    );
    if (!blockMatch) throw new Error('Could not find NORTHEAST_ISLAND_AREAS block');

    const areaOrder = [];
    const areaRe = /\{\s*id:\s*'(E\d{2})'\s*,\s*path:\s*(NE_E\d{2}_PATH)\s*\}/g;
    for (const m of blockMatch[1].matchAll(areaRe)) {
        areaOrder.push({ id: m[1], constName: m[2] });
    }

    if (areaOrder.length === 0) {
        throw new Error('NORTHEAST_ISLAND_AREAS does not use NE_E##_PATH constants');
    }

    const items = areaOrder.map(({ id, constName }) => {
        const pathValue = constMap.get(constName);
        if (!pathValue) throw new Error(`Missing const for ${constName}`);
        return { id, constName, path: pathValue };
    });

    return items;
}

function parsePoints(pathStr) {
    const nums = (pathStr.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || []).map(Number);
    const points = [];
    for (let i = 0; i + 1 < nums.length; i += 2) {
        points.push({ x: nums[i], y: nums[i + 1] });
    }
    return points;
}

function boundsFromItems(items) {
    const pts = items.flatMap((it) => parsePoints(it.path));
    if (pts.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0, cx: 0, cy: 0 };
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
    }
    return { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

function transformPath(pathStr, params) {
    let idx = 0;
    return pathStr.replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi, (m) => {
        const n = Number(m);
        const isX = idx % 2 === 0;
        idx += 1;
        if (isX) return fmt(params.ox + params.sx * (n - params.ox) + params.dx);
        return fmt(params.oy + params.sy * (n - params.oy) + params.dy);
    });
}

function labelPos(pathStr) {
    const pts = parsePoints(pathStr);
    if (pts.length === 0) return { x: 0, y: 0 };
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
    }
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

function buildPreviewSvg(items) {
    const colors = [
        '#f94144', '#f3722c', '#f8961e', '#f9844a', '#f9c74f', '#90be6d',
        '#43aa8b', '#4d908e', '#577590', '#277da1', '#ff006e'
    ];
    const lines = [];
    lines.push(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${MAP_WIDTH}" height="${MAP_HEIGHT}" viewBox="0 0 ${MAP_WIDTH} ${MAP_HEIGHT}">`
    );
    lines.push(`<image href="${MAP_HREF}" x="0" y="0" width="${MAP_WIDTH}" height="${MAP_HEIGHT}"/>`);
    items.forEach((it, i) => {
        const c = colors[i % colors.length];
        const pos = labelPos(it.path);
        lines.push(`<path d="${it.path}" fill="${c}22" stroke="${c}" stroke-width="1.6"/>`);
        lines.push(
            `<text x="${fmt(pos.x)}" y="${fmt(pos.y)}" font-size="8" font-family="Arial" font-weight="700" text-anchor="middle" dominant-baseline="middle" fill="#fff" stroke="#fff" stroke-width="0.8" paint-order="stroke">${it.id}</text>`
        );
        lines.push(
            `<text x="${fmt(pos.x)}" y="${fmt(pos.y)}" font-size="8" font-family="Arial" font-weight="700" text-anchor="middle" dominant-baseline="middle" fill="#111">${it.id}</text>`
        );
    });
    lines.push('</svg>');
    return lines.join('\n');
}

function buildPathsText(items, params) {
    const lines = [];
    lines.push('// Generated by scripts/tune-northeast.mjs');
    lines.push(
        `// args: --sx ${fmt(params.sx)} --sy ${fmt(params.sy)} --dx ${fmt(params.dx)} --dy ${fmt(params.dy)} --ox ${fmt(params.ox)} --oy ${fmt(params.oy)}`
    );
    lines.push('');
    for (const it of items) {
        lines.push(`const ${it.constName} = \`${it.path}\`;`);
    }
    lines.push('');
    lines.push('export const NORTHEAST_ISLAND_AREAS: BoardAreaGeometry[] = [');
    for (const it of items) {
        lines.push(`    { id: '${it.id}', path: ${it.constName} },`);
    }
    lines.push(']');
    return lines.join('\n');
}

function applyToBoardGeometry(boardText, items) {
    let out = boardText;
    for (const it of items) {
        const pattern = new RegExp(`const\\s+${it.constName}\\s*=\\s*` + '`[\\s\\S]*?`;', 'm');
        const replacement = `const ${it.constName} = \`${it.path}\`;`;
        if (!pattern.test(out)) throw new Error(`Could not find ${it.constName} in boardGeometry.ts`);
        out = out.replace(pattern, replacement);
    }
    return out;
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const boardText = fs.readFileSync(BOARD_GEOMETRY_PATH, 'utf8');
    const neItems = readNortheastPaths(boardText);

    const bounds = boundsFromItems(neItems);
    const ox = args.ox ?? bounds.cx;
    const oy = args.oy ?? bounds.cy;
    const params = { sx: args.sx, sy: args.sy, dx: args.dx, dy: args.dy, ox, oy };

    const transformed = neItems.map((it) => ({
        ...it,
        path: transformPath(it.path, params)
    }));

    fs.writeFileSync(args.previewOut, buildPreviewSvg(transformed));
    fs.writeFileSync(args.pathsOut, buildPathsText(transformed, params));

    if (args.apply) {
        const updated = applyToBoardGeometry(boardText, transformed);
        fs.writeFileSync(BOARD_GEOMETRY_PATH, updated);
    }

    console.log(`Preview: ${path.relative(projectRoot, args.previewOut)}`);
    console.log(`Paths:   ${path.relative(projectRoot, args.pathsOut)}`);
    console.log(
        `Params:  --sx ${fmt(params.sx)} --sy ${fmt(params.sy)} --dx ${fmt(params.dx)} --dy ${fmt(params.dy)} --ox ${fmt(params.ox)} --oy ${fmt(params.oy)}`
    );
    console.log(args.apply ? 'Applied: boardGeometry.ts updated' : 'Applied: no (use --apply to write boardGeometry.ts)');
}

main();
