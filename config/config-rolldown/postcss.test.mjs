import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createGameUiPostcssConfig, gameUiId, scopeGameCss } from './postcss.js'

const gamesRoot = fileURLToPath(new URL('../../games/', import.meta.url))
const uiPackages = readdirSync(gamesRoot).filter((name) => name.endsWith('-ui'))

const info = (body) => `export const Info: GameInfo = {\n${body}\n}\n`

function scopedBy(plugins, file) {
    const rule = { selectors: ['.a'], source: { input: { file } } }
    plugins.at(-1).Rule(rule)
    return rule.selectors[0]
}

function withInfo(source, check) {
    const root = mkdtempSync(join(tmpdir(), 'game-ui-id-'))
    try {
        mkdirSync(join(root, 'title/src/definition'), { recursive: true })
        mkdirSync(join(root, 'title-ui'))
        if (source !== undefined) writeFileSync(join(root, 'title/src/definition/info.ts'), source)
        check(join(root, 'title-ui'))
    } finally {
        rmSync(root, { recursive: true, force: true })
    }
}

function scoped(selectors, file = '/x/src/app.css', parent) {
    const rule = { selectors, parent, source: { input: { file } } }
    scopeGameCss('[data-game-ui="t"]', (source) => source.endsWith('/src/app.css')).Rule(rule)
    return rule.selectors
}

test('every game UI package takes its config from the factory, naming no game id of its own', () => {
    assert.ok(uiPackages.length > 0)
    for (const name of uiPackages) {
        const config = readFileSync(join(gamesRoot, name, 'postcss.config.js'), 'utf8')
        assert.match(config, /createGameUiPostcssConfig/, name)
        assert.doesNotMatch(config, /data-game-ui/, name)
    }
})

test('every game UI package resolves the id its logic package declares', () => {
    for (const name of uiPackages) assert.ok(gameUiId(join(gamesRoot, name)), name)
    assert.equal(gameUiId(join(gamesRoot, 'fresh-fish-ui')), 'freshfish')
    assert.equal(gameUiId(join(gamesRoot, 'bridges-of-shangri-la-ui')), 'bridges')
})

test('a package with no readable game id stops the build', () => {
    withInfo(undefined, (root) => assert.throws(() => gameUiId(root), /ENOENT/))
    withInfo(info(''), (root) => assert.throws(() => gameUiId(root), /declares no game id/))
    withInfo(info("    id: 'Not Scoped',"), (root) =>
        assert.throws(() => gameUiId(root), /cannot scope CSS/)
    )
    assert.throws(() => gameUiId(join(gamesRoot, '1850')), /not a game UI package/)
})

test('only GameInfo\u2019s own id counts, not a comment or a nested id above it', () => {
    const source = `const other = { id: 'early' }\n${info(
        "    // id: 'commented',\n    metadata: {\n        id: 'nested'\n    },\n    id: 'title',"
    )}`
    withInfo(source, (root) => assert.equal(gameUiId(root), 'title'))
})

test('the new-game generator writes the shared config', () => {
    const template = readFileSync(
        new URL('../../turbo/generators/templates/game/ui/postcss.config.js.hbs', import.meta.url),
        'utf8'
    )
    assert.match(template, /createGameUiPostcssConfig/)
    assert.doesNotMatch(template, /data-game-ui/)
})

test('the factory scopes to the package it is given', () => {
    const { plugins } = createGameUiPostcssConfig({
        packageRootUrl: new URL('../../games/1850-ui/', import.meta.url),
        family18xx: true,
        additionalStylesheets: ['/src/lib/panels.css']
    })
    const run = (file) => scopedBy(plugins, file)
    const inScope = '[data-game-ui="1850"] .a'
    assert.equal(run('/x/games/1850-ui/src/lib/styles.css'), inScope)
    assert.equal(run('/x/games/1850-ui/src/lib/panels.css'), inScope)
    assert.equal(run('/x/libs/18xx-ui/dist/auctions/auctionLotTable.css'), inScope)
    assert.equal(run('/x/libs/18xx-ui/dist/table/Thing.svelte.css'), '.a')
    assert.equal(run('/x/games/1850-ui/src/app.css'), '.a')
})

test('a title outside the family scopes only its app stylesheet', () => {
    const { plugins } = createGameUiPostcssConfig({
        packageRootUrl: new URL('../../games/bus-ui/', import.meta.url)
    })
    assert.equal(scopedBy(plugins, '/x/games/bus-ui/src/app.css'), '[data-game-ui="bus"] .a')
    assert.equal(scopedBy(plugins, '/x/libs/18xx-ui/dist/auctions/auctionLotTable.css'), '.a')
})

test('selectors scope once, the page itself becomes the table, and keyframes are left alone', () => {
    assert.deepEqual(scoped(['.a', '[data-game-ui="t"] .b']), [
        '[data-game-ui="t"] .a',
        '[data-game-ui="t"] .b'
    ])
    assert.deepEqual(scoped([':root', 'html', 'body .x']), [
        '[data-game-ui="t"]',
        '[data-game-ui="t"]',
        '[data-game-ui="t"]'
    ])
    assert.deepEqual(scoped(['from'], undefined, { type: 'atrule', name: 'keyframes' }), ['from'])
    assert.deepEqual(scoped(['.a'], '/x/other.css'), ['.a'])
})
