import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { publishCssAssets } from './css-assets.js'

const PUBLIC_PATH = '/games/a/ui/1.0.0/assets/'
const FONT_BYTES = 'wOF2 font bytes'
const FONT_FILE_NAME = 'lato-latin-700-normal-971484658fce913c.woff2'

function packageWithFontStylesheet() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'css-assets-'))
    const stylesheet = path.join(root, 'node_modules/font/latin-700.css')
    fs.mkdirSync(path.join(path.dirname(stylesheet), 'files'), { recursive: true })
    fs.writeFileSync(
        path.join(path.dirname(stylesheet), 'files/lato-latin-700-normal.woff2'),
        FONT_BYTES
    )
    return { stylesheet, destDir: path.join(root, 'bundle/assets') }
}

function publishedValue(value, { stylesheet, destDir }) {
    const declaration = { value, source: { input: { file: stylesheet } } }
    publishCssAssets({ destDir, publicPath: PUBLIC_PATH }).Declaration(declaration)
    return declaration.value
}

test('a file named relative to its stylesheet is published and addressed from the artifact', () => {
    const fixture = packageWithFontStylesheet()

    const value = publishedValue(
        "url(./files/lato-latin-700-normal.woff2) format('woff2')",
        fixture
    )

    assert.equal(value, `url(${PUBLIC_PATH}${FONT_FILE_NAME}) format('woff2')`)
    assert.equal(fs.readFileSync(path.join(fixture.destDir, FONT_FILE_NAME), 'utf8'), FONT_BYTES)
})

test('a quoted reference keeps its fragment', () => {
    const fixture = packageWithFontStylesheet()

    const value = publishedValue('url("files/lato-latin-700-normal.woff2#lato")', fixture)

    assert.equal(value, `url(${PUBLIC_PATH}${FONT_FILE_NAME}#lato)`)
})

test('references that do not depend on the stylesheet address are left alone', () => {
    const fixture = packageWithFontStylesheet()
    const value =
        'url(data:image/png;base64,AAAA), url(/fonts/a.woff2), url(https://example.com/a.woff2), url(#mask)'

    assert.equal(publishedValue(value, fixture), value)
    assert.equal(fs.existsSync(fixture.destDir), false)
})

test('a reference to a missing file fails the build', () => {
    const fixture = packageWithFontStylesheet()

    assert.throws(() => publishedValue('url(./files/missing.woff2)', fixture), /missing\.woff2/)
})

test('a quoted data address is left alone even when it holds a url() of its own', () => {
    const fixture = packageWithFontStylesheet()
    const value = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Crect filter='url(%23n)'/%3E%3C/svg%3E")`

    assert.equal(publishedValue(value, fixture), value)
    assert.equal(fs.existsSync(fixture.destDir), false)
})
