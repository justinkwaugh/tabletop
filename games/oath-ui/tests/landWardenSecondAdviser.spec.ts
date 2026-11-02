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

const LAND_WARDEN = 'denizen.hearth.land-warden'
const RANGERS = 'denizen.beast.rangers'
const LONGBOWS = 'denizen.order.longbows'
const INN = 'denizen.hearth.wayside-inn'

const panel = (page: Page) => page.locator('.panel')
const step = (page: Page, text: string) => panel(page).getByText(text, { exact: true })
const card = (page: Page, name: string) =>
    panel(page).locator(`button:not(.magnifier):has(img[alt="${name}"])`)
const panelCardNames = (page: Page) =>
    panel(page)
        .locator('button:not(.magnifier) img')
        .evaluateAll((images) => images.map((image) => image.getAttribute('alt')))
const secondMode = (page: Page, mode: string) =>
    panel(page).getByRole('button', { name: mode, exact: true })
const toYourSite = (page: Page) => panel(page).getByRole('button', { name: /^To your site/ })

/**
 * The second card's buttons under "Also play:", in order: each one's label, its width and height in layout pixels
 * (the panel may be drawn scaled), its height on the screen, and the width its own label alone would give it, with
 * its padding and border.
 */
const secondModeBoxes = (page: Page) =>
    panel(page)
        .locator('div', { has: page.getByText('Also play:', { exact: true }) })
        .last()
        .locator('button:not(:has(img)):not(.magnifier)')
        .evaluateAll((buttons) =>
            buttons.map((button) => {
                const box = button as HTMLElement
                const scale = box.getBoundingClientRect().width / box.offsetWidth
                const words = document.createRange()
                words.selectNodeContents(box)
                const style = getComputedStyle(box)
                const around = [
                    style.paddingLeft,
                    style.paddingRight,
                    style.borderLeftWidth,
                    style.borderRightWidth
                ].reduce((sum, length) => sum + parseFloat(length), 0)
                const label = words.getBoundingClientRect().width / scale
                return {
                    label: (box.textContent ?? '').trim(),
                    width: box.offsetWidth,
                    height: box.offsetHeight,
                    drawnHeight: box.getBoundingClientRect().height,
                    fits: Math.ceil(Math.round((label + around) * 100) / 100)
                }
            })
        )
const undo = (page: Page) => page.getByRole('button', { name: 'Undo', exact: true })

async function searched(page: Page) {
    await page.goto('/')
    await call(page, 'open', 'landWardenSecondAdviser')
    await expect.poll(async () => (await call(page, 'tableFacts')).seatId).toBe('Dana')
    await expect(step(page, 'Keep one.')).toBeVisible()
    await card(page, 'Wayside Inn').click()
    await expect(step(page, 'How do you play it?')).toBeVisible()
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
     * R-5.1.4.II, Land Warden — Dana holds Land Warden, Wolves and Rangers (3 of 3) and searched with Land Warden,
     * drawing the Wayside Inn, Longbows and Wrestlers. The Inn is kept to the Plains.
     */
    test.describe(`Land Warden's second card as an adviser at the limit, on a ${name}`, () => {
        test.use({ viewport, hasTouch: phone })

        test('Longbows and Wrestlers each offer "to your site", "adviser, faceup" and "adviser, facedown"', async ({
            page
        }) => {
            await searched(page)
            await expect(secondMode(page, 'to your site')).toHaveCount(2)
            await expect(secondMode(page, 'adviser, faceup')).toHaveCount(2)
            await expect(secondMode(page, 'adviser, facedown')).toHaveCount(2)
            await shot(page, 'warden-1-offered', phone)
        })

        test(`the second card's buttons are as wide as the widest label${phone ? ' and 44 px tall' : ''}`, async ({
            page
        }) => {
            await searched(page)
            await expect(secondMode(page, 'adviser, facedown')).toHaveCount(2)
            const boxes = await secondModeBoxes(page)
            expect(boxes.map((box) => box.label)).toEqual([
                'to your site',
                'adviser, faceup',
                'adviser, facedown',
                'to your site',
                'adviser, faceup',
                'adviser, facedown'
            ])
            if (phone) {
                expect(boxes.map((box) => box.height)).toEqual(boxes.map(() => 44))
                for (const box of boxes) expect(box.drawnHeight).toBeGreaterThanOrEqual(43.5)
            }
            // One width, the widest label's (to a pixel's rounding): no button narrower, none stretched wider.
            const widest = Math.max(...boxes.map((box) => box.fits))
            expect(new Set(boxes.map((box) => box.width)).size).toBe(1)
            expect(Math.abs(boxes[0].width - widest)).toBeLessThanOrEqual(1)
        })

        for (const faceUp of [true, false]) {
            const mode = faceUp ? 'adviser, faceup' : 'adviser, facedown'

            test(`"${mode}", then "To your site": "Discard 1 adviser." offers Wolves and Rangers at 72 by 112; one tap ends the Search`, async ({
                page
            }) => {
                await searched(page)
                await secondMode(page, mode).first().click()
                await expect(secondMode(page, mode).first()).toHaveAttribute('aria-pressed', 'true')
                // The second card is an adviser, so the kept card goes to a site.
                await expect(
                    panel(page).getByRole('button', { name: 'Discard', exact: true })
                ).toHaveCount(0)
                await shot(page, `warden-2-${faceUp ? 'faceup' : 'facedown'}-picked`, phone)
                const favor = (await call(page, 'tableFacts')).favorOf.Dana
                await toYourSite(page).click()

                await expect(step(page, 'Discard 1 adviser.')).toBeVisible()
                expect(await panelCardNames(page)).toEqual(['Wolves', 'Rangers'])
                for (const adviser of ['Wolves', 'Rangers']) {
                    const size = await card(page, adviser).evaluate((button) =>
                        button instanceof HTMLElement
                            ? { width: button.offsetWidth, height: button.offsetHeight }
                            : { width: 0, height: 0 }
                    )
                    expect(size).toEqual({ width: 72, height: 112 })
                }
                await shot(page, `warden-3-${faceUp ? 'faceup' : 'facedown'}-picker`, phone)
                expect(
                    await page.evaluate(
                        () => document.documentElement.scrollWidth - window.innerWidth
                    )
                ).toBe(0)

                await card(page, 'Wolves').click()
                await expect(step(page, 'Discard 1 adviser.')).toHaveCount(0)
                await expect
                    .poll(async () => call(page, 'myAdvisers'))
                    .toEqual([
                        { cardId: LAND_WARDEN, faceUp: true },
                        { cardId: RANGERS, faceUp: true },
                        { cardId: LONGBOWS, faceUp }
                    ])
                const facts = await call(page, 'tableFacts')
                expect(Object.values(facts.denizensAt).flat()).toContain(INN)
                expect(facts.favorOf.Dana).toBe(favor + 1)
                await shot(page, `warden-4-${faceUp ? 'faceup' : 'facedown'}-done`, phone)
            })
        }

        test('Undo from "Discard 1 adviser." returns to "How do you play it?" with "adviser, faceup" still picked', async ({
            page
        }) => {
            await searched(page)
            await secondMode(page, 'adviser, faceup').first().click()
            await toYourSite(page).click()
            await expect(step(page, 'Discard 1 adviser.')).toBeVisible()
            await undo(page).click()
            await expect(step(page, 'How do you play it?')).toBeVisible()
            await expect(secondMode(page, 'adviser, faceup').first()).toHaveAttribute(
                'aria-pressed',
                'true'
            )
            expect((await call(page, 'myAdvisers')).map((adviser) => adviser.cardId)).toEqual([
                LAND_WARDEN,
                'denizen.beast.wolves',
                RANGERS
            ])
        })
    })
}
