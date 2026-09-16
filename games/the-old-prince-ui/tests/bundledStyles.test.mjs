import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'

const bundle = new URL('../bundle/', import.meta.url)

test('production runtime carries scoped tab, history, and chat styles', async () => {
    const files = await readdir(bundle)
    const styles = []
    for (const file of files.filter((name) => name.endsWith('.js'))) {
        const source = await readFile(new URL(file, bundle), 'utf8')
        for (const match of source.matchAll(/"(?:[^"\\]|\\.)*"/g)) {
            if (!match[0].includes('tailwindcss')) continue
            const value = JSON.parse(match[0])
            if (value.includes('[data-game-ui="the-old-prince"]')) styles.push(value)
        }
    }
    const css = styles.join('\n')
    assert.ok(css, 'No TOP-scoped Tailwind stylesheet in the production bundle')
    for (const selector of [
        '.text-\\[\\#695540\\]',
        '.text-\\[\\#b9ae9f\\]',
        '.hover\\:text-\\[\\#5e4937\\]:hover',
        '.text-\\[\\#887969\\]',
        '.hover\\:bg-\\[\\#e7ded3\\]:hover'
    ]) {
        assert.ok(css.includes(`[data-game-ui="the-old-prince"] ${selector}`), `Missing scoped style: ${selector}`)
    }
})
