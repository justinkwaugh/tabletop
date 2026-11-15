import { expect, test, type Page } from '@playwright/test'
import type * as TableFixture from '../src/lib/testing/tableFixture.js'

type Fixture = typeof TableFixture

async function call<K extends keyof Fixture>(
    page: Page,
    name: K,
    ...args: Parameters<Fixture[K]>
): Promise<Awaited<ReturnType<Fixture[K]>>> {
    return page.evaluate(
        async ({ name, args }) => {
            const fixture = await import(
                new URL('/src/lib/testing/tableFixture.ts', location.href).href
            )
            return fixture[name](...args)
        },
        { name, args }
    )
}

const panel = (page: Page) => page.locator('.panel')
const step = (page: Page, text: string) => panel(page).getByText(text, { exact: true })
const card = (page: Page, name: string) =>
    panel(page).locator(`button:not(.magnifier):has(img[alt="${name}"])`)
const discardFirst = (page: Page, name: string) =>
    panel(page)
        .locator('div', { has: page.getByText('Discard first:', { exact: true }) })
        .last()
        .locator(`button:not(.magnifier):has(img[alt="${name}"])`)
const plays = (page: Page) =>
    panel(page).getByRole('button', {
        name: /^(To your site(, .+)?|Adviser, faceup|Adviser, facedown|Discard)$/
    })
const toYourSite = (page: Page) => panel(page).getByRole('button', { name: /^To your site/ })

async function keptAlchemist(page: Page, scene: 'searchFullSite' | 'searchFullSiteRoom') {
    await page.goto('/')
    await call(page, 'open', scene)
    await expect.poll(async () => (await call(page, 'tableFacts')).seatId).toBe('Dana')
    await expect(step(page, 'Keep one.')).toBeVisible()
    await card(page, 'Alchemist').click()
    await expect(step(page, 'How do you play it?')).toBeVisible()
}

/**
 * R-5.1.4.I, Crop Rotation — Dana, holding the People's Favor, searched with Crop Rotation at the full Plains and kept
 * Alchemist: "To your site" waits for a Plains card picked to discard first, as a choice that cannot be picked is
 * hidden; a River card frees no room at the Plains.
 */
for (const [label, viewport] of [
    ['on a desktop at 1280', { width: 1280, height: 900 }],
    ['on a phone at 375', { width: 375, height: 812 }]
] as const) {
    test.describe(`At a full site, "To your site" waits for a card there to discard first, ${label}`, () => {
        test.use({ viewport })

        test('hidden with nothing picked and with a River card; shown with Tents, in view; hidden again when Tents is taken back', async ({
            page
        }) => {
            await keptAlchemist(page, 'searchFullSite')
            await expect(plays(page)).toHaveText([
                'Adviser, faceup',
                'Adviser, facedown',
                'Discard'
            ])
            await expect(toYourSite(page)).toHaveCount(0)

            await discardFirst(page, 'Rowdy Pub').click()
            await expect(discardFirst(page, 'Rowdy Pub')).toHaveAttribute('aria-pressed', 'true')
            await expect(toYourSite(page)).toHaveCount(0)
            await discardFirst(page, 'Rowdy Pub').click()

            await discardFirst(page, 'Tents').click()
            await expect(discardFirst(page, 'Tents')).toHaveAttribute('aria-pressed', 'true')
            await expect(plays(page)).toHaveText([
                /^To your site/,
                'Adviser, faceup',
                'Adviser, facedown',
                'Discard'
            ])
            await expect(toYourSite(page)).toBeInViewport()
            await expect(panel(page).getByText(/capacity/)).toHaveCount(0)

            await discardFirst(page, 'Tents').click()
            await expect(discardFirst(page, 'Tents')).toHaveAttribute('aria-pressed', 'false')
            await expect(toYourSite(page)).toHaveCount(0)
        })

        test('the Plains with room: "To your site" shows at once', async ({ page }) => {
            await keptAlchemist(page, 'searchFullSiteRoom')
            await expect(plays(page)).toHaveText([
                /^To your site/,
                'Adviser, faceup',
                'Adviser, facedown',
                'Discard'
            ])
        })
    })
}
