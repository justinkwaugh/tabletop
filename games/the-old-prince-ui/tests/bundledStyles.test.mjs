import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'

const bundle = new URL('../bundle/', import.meta.url)

// The minifier writes strings in any quote style, template literals without substitutions included.
const STRING_LITERAL = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\$]|\\.|\$(?!\{))*`/g

function stringLiteralValue(literal) {
    return new Function(`return ${literal}`)()
}

test('production runtime carries scoped tab, history, and chat styles', async () => {
    const files = await readdir(bundle)
    const styles = []
    for (const file of files.filter((name) => name.endsWith('.js'))) {
        const source = await readFile(new URL(file, bundle), 'utf8')
        for (const [literal] of source.matchAll(STRING_LITERAL)) {
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
        '.text-\\[var\\(--rail-muted\\,\\#887969\\)\\]',
        '.hover\\:bg-\\[var\\(--rail-surface-raised\\,\\#e7ded3\\)\\]:hover'
    ]) {
        assert.ok(
            css.includes(`[data-game-ui="the-old-prince"] ${selector}`),
            `Missing scoped style: ${selector}`
        )
    }
})
