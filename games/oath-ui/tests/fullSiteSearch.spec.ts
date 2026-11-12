import { expect, test, type Locator, type Page } from '@playwright/test'
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

const BLOOD_PACT = 'denizen.arcane.blood-pact'
const CONSPIRACY = 'vision.conspiracy'
const WRESTLERS = 'denizen.order.wrestlers'

const panel = (page: Page) => page.locator('.panel')
const step = (page: Page, text: string) => panel(page).getByText(text, { exact: true })
const card = (page: Page, name: string) =>
    panel(page).locator(`button:not(.magnifier):has(img[alt="${name}"])`)
const play = (page: Page, label: string) =>
    panel(page).getByRole('button', { name: new RegExp(`^${label}`) })
const panelCardNames = (page: Page) =>
    panel(page)
        .locator('button:not(.magnifier) img')
        .evaluateAll((images) => images.map((image) => image.getAttribute('alt')))

async function searched(page: Page) {
    await page.goto('/')
    await call(page, 'open', 'fullSiteSearch')
    await expect.poll(async () => (await call(page, 'tableFacts')).seatId).toBe('Dana')
    await expect(step(page, 'Keep one.')).toBeVisible()
}

/**
 * A tap, and the step it leads to shown within the expect timeout: before each read was worked out once per
 * draft, the last taps here took the panel most of a minute. The time each took is noted on the test.
 */
async function tap(page: Page, label: string, target: Locator, shown: Locator) {
    const start = Date.now()
    await target.click()
    await expect(shown).toBeVisible()
    test.info().annotations.push({ type: 'tap', description: `${label}: ${Date.now() - start} ms` })
}

async function shot(page: Page, name: string, phone: boolean) {
    await page.mouse.move(2, 2)
    const path = test.info().outputPath(`${name}-${phone ? 'phone' : 'desktop'}.png`)
    if (phone) await page.screenshot({ path })
    else await panel(page).screenshot({ path })
}

const SIZES = [
    { name: 'desktop', viewport: { width: 1280, height: 900 }, phone: false },
    { name: 'phone', viewport: { width: 375, height: 812 }, phone: true }
]

for (const { name, viewport, phone } of SIZES) {
    /**
     * R-5.1.4.II, R-11.10 — Dana holds Blood Pact and the Vision of Conspiracy facedown and Gleaming Armor faceup,
     * at the full Great Slum, and searched, drawing Wrestlers, Twin Brother and the Relic Breaker.
     */
    test.describe(`Dana's Search at the full Great Slum, on a ${name}`, () => {
        test.use({ viewport, hasTouch: phone })

        test("each tap is answered at once, and Wrestlers joins the advisers faceup in Gleaming Armor's place", async ({
            page
        }) => {
            await searched(page)
            await shot(page, 'full-site-1-drawn', phone)
            await tap(
                page,
                'keep Wrestlers',
                card(page, 'Wrestlers'),
                step(page, 'How do you play it?')
            )
            // The play to Dana's own full site waits for a Slum card picked to discard first.
            await expect(play(page, 'Adviser, faceup')).toBeVisible()
            await expect(play(page, 'To your site')).toHaveCount(0)
            await shot(page, 'full-site-2-kept', phone)
            await tap(
                page,
                'adviser, faceup',
                play(page, 'Adviser, faceup'),
                step(page, 'Discard 1 adviser.')
            )
            await shot(page, 'full-site-3-room', phone)
            await tap(
                page,
                'discard Gleaming Armor',
                card(page, 'Gleaming Armor'),
                step(page, 'Tap to discard; the last goes on top.')
            )
            await shot(page, 'full-site-4-order', phone)
            await tap(
                page,
                'discard Twin Brother',
                card(page, 'Twin Brother'),
                page.locator('body')
            )
            await expect
                .poll(async () => call(page, 'myAdvisers'))
                .toEqual([
                    { cardId: BLOOD_PACT, faceUp: false },
                    { cardId: CONSPIRACY, faceUp: false },
                    { cardId: WRESTLERS, faceUp: true }
                ])
            await expect(step(page, 'Tap to discard; the last goes on top.')).toHaveCount(0)
            await shot(page, 'full-site-5-done', phone)
        })

        test('in hotseat, viewing as another seat and back leaves the draft where it was', async ({
            page
        }) => {
            await searched(page)
            await card(page, 'Wrestlers').click()
            await play(page, 'Adviser, faceup').click()
            await expect(step(page, 'Discard 1 adviser.')).toBeVisible()
            const offered = await panelCardNames(page)

            expect(await call(page, 'viewOffTheClock')).not.toBe('Dana')
            await expect(step(page, 'Discard 1 adviser.')).toHaveCount(0)
            expect(await call(page, 'viewOnTheClock')).toBe('Dana')
            await expect(step(page, 'Discard 1 adviser.')).toBeVisible()
            expect(await panelCardNames(page)).toEqual(offered)

            await card(page, 'Gleaming Armor').click()
            await expect(step(page, 'Tap to discard; the last goes on top.')).toBeVisible()
        })
    })
}
