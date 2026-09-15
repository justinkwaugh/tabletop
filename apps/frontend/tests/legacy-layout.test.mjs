import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import postcss from 'postcss'
import tailwind from '@tailwindcss/postcss'
import { chromium } from '@playwright/test'

let browser
let css
before(async () => {
    const file = fileURLToPath(new URL('../src/app.css', import.meta.url))
    css = (await postcss([tailwind()]).process(await readFile(file, 'utf8'), { from: file })).css
    browser = await chromium.launch({ headless: true, args: ['--disable-gpu'] })
})
after(async () => { await browser?.close() })

for (const width of [1280, 390]) {
    for (const banner of [0, 48]) {
        test(`published layout keeps the board visible at width ${width}, banner ${banner}`, async () => {
            const page = await browser.newPage({ viewport: { width, height: 900 } })
            // Assemble legacy utilities so Tailwind's test-file scan cannot accidentally supply them.
            const desktop = ['sm', 'h-[calc(100dvh-16px-var(--app-shell-height))]'].join(':')
            const mobile = ['max-sm', 'h-[calc(100dvh-16px-44px-var(--app-shell-height))]'].join(':')
            try {
                await page.setContent(`<style>${css}</style>
                    <div class="flex flex-col overflow-auto ${desktop} ${mobile}"
                        style="--app-shell-height:${60 + banner}px;width:100%">
                        <div style="height:180px;flex-shrink:0">Hut scoring</div>
                        <div id="board" style="flex:1;overflow:hidden">
                            <div style="position:relative;height:100%">
                                <svg style="position:absolute;width:100%;height:100%">
                                    <rect width="100%" height="100%" fill="blue"/>
                                </svg>
                            </div>
                        </div>
                    </div>`)
                const height = await page.locator('#board').evaluate((element) => element.getBoundingClientRect().height)
                assert.equal(height, 900 - 16 - 60 - banner - 180 - (width < 640 ? 44 : 0))
            } finally { await page.close() }
        })
    }
}
