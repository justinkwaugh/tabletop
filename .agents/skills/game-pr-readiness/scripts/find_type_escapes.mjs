#!/usr/bin/env node
// Reports type-assertion casts and `any` types in TypeScript, JavaScript, and Svelte files.
// Usage: node find_type_escapes.mjs <UI package root> < files.json
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const require = createRequire(join(process.argv[2], 'package.json'))
const ts = require('typescript')
const { parse } = require('svelte/compiler')

function scanScript(source, path) {
    const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    const findings = []
    const record = (kind, node) =>
        findings.push({
            kind,
            line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1,
            text: node.getText(file).replace(/\s+/g, ' ')
        })
    const isAssertion = (node) => node !== undefined && (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node))
    const visit = (node) => {
        if (
            isAssertion(node) &&
            !ts.isConstTypeReference(node.type) &&
            !(isAssertion(node.parent) && node.parent.expression === node)
        ) {
            record('cast', node)
        }
        if (node.kind === ts.SyntaxKind.AnyKeyword) record('any', node)
        ts.forEachChild(node, visit)
    }
    visit(file)
    return findings
}

function scanSvelte(source) {
    const findings = []
    const lineOf = (offset) => source.slice(0, offset).split('\n').length
    const record = (kind, node) =>
        findings.push({ kind, line: lineOf(node.start), text: source.slice(node.start, node.end).replace(/\s+/g, ' ') })
    const isConstAssertion = (node) =>
        node.typeAnnotation?.type === 'TSTypeReference' && node.typeAnnotation.typeName?.name === 'const'
    const isAssertion = (node) => node?.type === 'TSAsExpression' || node?.type === 'TSTypeAssertion'
    const walk = (node, parent) => {
        if (!node || typeof node !== 'object') return
        if (Array.isArray(node)) {
            for (const child of node) walk(child, parent)
            return
        }
        if (isAssertion(node) && !isConstAssertion(node) && !(isAssertion(parent) && parent.expression === node)) {
            record('cast', node)
        }
        if (node.type === 'TSAnyKeyword') record('any', node)
        for (const [key, child] of Object.entries(node)) {
            if (key !== 'parent' && key !== 'metadata') walk(child, node)
        }
    }
    walk(parse(source, { modern: true }), undefined)
    return findings
}

const results = []
for (const path of JSON.parse(readFileSync(0, 'utf8'))) {
    const source = readFileSync(path, 'utf8')
    try {
        const findings = path.endsWith('.svelte') ? scanSvelte(source) : scanScript(source, path)
        if (findings.length > 0) results.push({ path, findings })
    } catch (error) {
        results.push({ path, error: String(error.message ?? error) })
    }
}
process.stdout.write(JSON.stringify(results))
