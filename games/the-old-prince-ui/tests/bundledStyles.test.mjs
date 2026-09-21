import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'

const bundle = new URL('../bundle/', import.meta.url)

function stringLiteralValue(literal) {
    const body = literal.slice(1, -1)
    return JSON.parse(`"${literal[0] === '"' ? body : body.replace(/\\'/g, "'").replace(/"/g, '\\"')}"`)
}

test('production runtime carries scoped tab, history, and chat styles', async () => {
    const files = await readdir(bundle)
    const styles = []
    for (const file of files.filter((name) => name.endsWith('.js'))) {
        const source = await readFile(new URL(file, bundle), 'utf8')
        for (const [literal] of source.matchAll(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g)) {
            if (!literal.includes('tailwindcss')) continue
            const value = stringLiteralValue(literal)
            if (value.includes('[data-game-ui="the-old-prince"]')) styles.push(value)
        }
    }
    const css = styles.join('\n')
    assert.ok(css, 'No TOP-scoped Tailwind stylesheet in the production bundle')
    for (const selector of [
        '.text-\\[var\\(--rail-text\\,\\#695540\\)\\]',
        '.text-\\[var\\(--rail-inactive\\,\\#b9ae9f\\)\\]',
        '.hover\\:text-\\[var\\(--rail-text\\,\\#5e4937\\)\\]:hover',
        '.text-\\[var\\(--rail-muted\\,\\#887969\\)\\]',
        '.hover\\:bg-\\[var\\(--rail-surface-raised\\,\\#e7ded3\\)\\]:hover'
    ]) {
        assert.ok(css.includes(`[data-game-ui="the-old-prince"] ${selector}`), `Missing scoped style: ${selector}`)
    }
})
