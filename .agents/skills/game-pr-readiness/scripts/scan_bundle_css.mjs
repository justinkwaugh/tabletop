#!/usr/bin/env node
// Classifies every CSS rule a built Game UI bundle injects as scoped to the title or leaking.
// Usage: node scan_bundle_css.mjs <UI package root>
import { createRequire } from 'node:module'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const uiRoot = resolve(process.argv[2])
const repoRequire = createRequire(join(uiRoot, '../../config/config-rollup/package.json'))
const pluginRequire = createRequire(repoRequire.resolve('rollup-plugin-postcss'))
const postcss = pluginRequire('postcss')
const { SourceMapConsumer } = pluginRequire('source-map')
const ts = createRequire(join(uiRoot, 'package.json'))('typescript')

const packageName = JSON.parse(readFileSync(join(uiRoot, 'package.json'), 'utf8')).name ?? ''
const packageSlug = packageName.replace(/^@/, '').replace(/\//g, '-').replace(/[^a-zA-Z0-9_-]/g, '-')
const gameId = packageName.replace(/^@[^/]+\//, '').replace(/-ui$/, '')
const bundleDir = join(uiRoot, 'bundle')

if (!existsSync(bundleDir)) {
    process.stdout.write(JSON.stringify({ error: 'no bundle directory; run the UI bundle script first' }))
    process.exit(0)
}

const stringLiterals = (path, source) => {
    const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, false, ts.ScriptKind.JS)
    const values = []
    const visit = (node) => {
        if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
            const { line, character } = file.getLineAndCharacterOfPosition(node.getStart(file))
            values.push({ text: node.text, line: line + 1, column: character })
        }
        ts.forEachChild(node, visit)
    }
    visit(file)
    return values
}
const svelteHash = `.svelte-${packageSlug}-`
const prefixPattern = /^\[data-game-ui=(["']?)([^\]"']+)\1\]/
const tailwindKeyframes = new Set(['spin', 'ping', 'pulse', 'bounce'])

const titleDependencies = new Set(
    Object.keys({ ...JSON.parse(readFileSync(join(uiRoot, 'package.json'), 'utf8')).dependencies })
)
const isPlatform = (origin) => {
    const match = origin.match(/^node_modules\/((?:@[^/]+\/)?[^/]+)/)
    if (!match) return false
    const name = match[1]
    if (name === '@tabletop/frontend-components') return true
    return !name.startsWith('@tabletop/') && name !== 'style-inject' && !titleDependencies.has(name)
}

const result = {
    gameId,
    packageSlug,
    stylesheets: 0,
    scopedRules: 0,
    prefixedRules: 0,
    leaks: [],
    platformLeaks: 0,
    globalAtRules: [],
    platformAtRules: 0,
    wrongPrefix: []
}

const recordAtRule = (entry) => {
    if (isPlatform(entry.source)) result.platformAtRules++
    else result.globalAtRules.push(entry)
}

for (const file of readdirSync(bundleDir).filter((name) => name.endsWith('.js'))) {
    const source = readFileSync(join(bundleDir, file), 'utf8')
    const mapPath = join(bundleDir, `${file}.map`)
    const map = existsSync(mapPath) ? new SourceMapConsumer(JSON.parse(readFileSync(mapPath, 'utf8'))) : undefined
    const origin = (line, column) => {
        const original = map?.originalPositionFor({ line, column })?.source
        return original ? original.replace(/^(\.\.\/)+/, '').replace(/^.*node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?/, 'node_modules/') : 'unknown'
    }
    for (const { text: css, line, column } of stringLiterals(file, source)) {
        if (css.length < 10 || !css.includes('{') || !css.includes(':')) continue
        let root
        try {
            root = postcss.parse(css)
        } catch {
            continue
        }
        let declarations = 0
        root.walkDecls(() => declarations++)
        if (declarations === 0 || root.nodes.some((node) => node.type === 'decl')) continue
        result.stylesheets++
        root.walkAtRules((rule) => {
            if (/keyframes$/.test(rule.name)) {
                if (!rule.params.startsWith('svelte-') && !tailwindKeyframes.has(rule.params))
                    recordAtRule({ file, source: origin(line, column), rule: `@${rule.name} ${rule.params}` })
            } else if (rule.name === 'font-face' || rule.name === 'counter-style') {
                recordAtRule({ file, source: origin(line, column), rule: `@${rule.name} ${rule.params}`.trim() })
            } else if (rule.name === 'property' && !rule.params.startsWith('--tw-')) {
                recordAtRule({ file, source: origin(line, column), rule: `@property ${rule.params}` })
            }
        })
        root.walkRules((rule) => {
            if (rule.parent?.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return
            for (const selector of rule.selectors) {
                const trimmed = selector.trim()
                const prefix = trimmed.match(prefixPattern)
                if (prefix && prefix[2] !== gameId)
                    result.wrongPrefix.push({ file, source: origin(line, column), selector: trimmed })
                else if (prefix || trimmed.includes(svelteHash)) {
                    result.scopedRules++
                    if (prefix) result.prefixedRules++
                }
                else if (isPlatform(origin(line, column))) result.platformLeaks++
                else result.leaks.push({ file, source: origin(line, column), selector: trimmed })
            }
        })
    }
}

process.stdout.write(JSON.stringify(result))
