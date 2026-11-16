import { expect, test, type Locator, type Page } from '@playwright/test'
import type * as TableFixture from '../src/lib/testing/tableFixture.js'

// Rule 4 — the enlarged card pages through its group: the map's denizens, one seat's cards, or the
// cards a panel shows from a draw. A desktop shows the previous and next cards beside it at 60%,
// dimmed; a phone a 48 px strip each side with a gold chevron.

async function openTable(page: Page, name: TableFixture.TableName) {
    await page.goto('/')
    await page.evaluate(async (name) => {
        const fixture = await import(
            new URL('/src/lib/testing/tableFixture.ts', location.href).href
        )
        return fixture.open(name)
    }, name)
}

const preview = (page: Page) => page.locator('.card-preview')
const frame = (page: Page) => preview(page).locator('.card-preview__frame')
const enlarged = (page: Page) => frame(page).locator('img')
const previousCard = (page: Page) => preview(page).getByRole('button', { name: /^Previous card/ })
const nextCard = (page: Page) => preview(page).getByRole('button', { name: /^Next card/ })
const boardCard = (page: Page, name: string) =>
    page.locator('.board-card').filter({ has: page.locator(`img[alt="${name}"]`) })
const seat = (page: Page, playerId: string) => page.locator(`[data-seat="${playerId}"]`)
const seatCard = (page: Page, playerId: string, name: string) =>
    seat(page, playerId).locator(`img[alt="${name}"]`)
const tag = (page: Page) => page.locator('[data-seat-use-tag]')

async function box(locator: Locator) {
    const found = await locator.boundingBox()
    expect(found).not.toBeNull()
    return found ?? { x: 0, y: 0, width: 0, height: 0 }
}

/** Waits until the element stands still: the map glides to its frame. */
async function still(locator: Locator) {
    let last = ''
    await expect
        .poll(async () => {
            const now = JSON.stringify(await locator.boundingBox())
            const same = now === last
            last = now
            return same
        })
        .toBe(true)
}

/** On a phone the map is framed on the region named, as a pan would. */
async function showRegion(page: Page, region: string) {
    await page
        .locator('.chooser__view', { hasText: region })
        .evaluate((view) => view instanceof HTMLElement && view.click())
    await still(page.locator('.board-card').first())
}

async function expectEnlarged(page: Page, name: string) {
    await expect(enlarged(page)).toHaveAttribute('alt', name)
}

/** The names the side cards (or strips) read aloud, previous then next. */
async function sides(page: Page) {
    return [
        await previousCard(page).getAttribute('aria-label'),
        await nextCard(page).getAttribute('aria-label')
    ]
}

test.describe('paging the enlarged card on a desktop, 1280 × 800', () => {
    test.use({ viewport: { width: 1280, height: 800 } })

    test('the map: Blood Pact stands between Sacred Ground and A Round of Ale, at 60% and dimmed, and a click on the next zooms it', async ({
        page
    }) => {
        await openTable(page, 'useOnEveryCard')
        await boardCard(page, 'Blood Pact').click()
        await expectEnlarged(page, 'Blood Pact')
        expect(await sides(page)).toEqual([
            'Previous card: Sacred Ground',
            'Next card: A Round of Ale'
        ])
        const card = await box(frame(page))
        expect(Math.round(card.width)).toBe(420)
        for (const side of [previousCard(page), nextCard(page)]) {
            const at = await box(side)
            expect(Math.round(at.width)).toBe(252)
            expect(Math.abs(at.y + at.height / 2 - (card.y + card.height / 2))).toBeLessThan(1.5)
            await expect(side.locator('img')).toHaveCSS('filter', 'brightness(0.55)')
        }
        const before = await box(previousCard(page))
        const after = await box(nextCard(page))
        expect(Math.round(card.x - (before.x + before.width))).toBe(16)
        expect(Math.round(after.x - (card.x + card.width))).toBe(16)

        await nextCard(page).click()
        await expectEnlarged(page, 'A Round of Ale')
        expect(await sides(page)).toEqual(['Previous card: Blood Pact', 'Next card: Keep'])
        await previousCard(page).click()
        await expectEnlarged(page, 'Blood Pact')

        // A fast double press pages twice, one card each, and leaves the card open.
        await nextCard(page).dblclick()
        await expectEnlarged(page, 'Keep')
        await expect(preview(page)).toBeVisible()
    })

    test('the map ends at the Wolves: only two cards show, and a click on the empty side closes', async ({
        page
    }) => {
        await openTable(page, 'useOnEveryCard')
        await boardCard(page, 'Keep').click()
        await nextCard(page).click()
        await expectEnlarged(page, 'Wolves')
        await expect(previousCard(page)).toHaveAttribute('aria-label', 'Previous card: Keep')
        await expect(nextCard(page)).toHaveCount(0)
        await expect(preview(page).locator('.card-preview__side')).toHaveCount(1)
        const card = await box(frame(page))
        await page.mouse.click(card.x + card.width + 16 + 126, card.y + card.height / 2)
        await expect(preview(page)).toHaveCount(0)
    })

    test('← and → page and Escape closes; nothing pages while typing in the chat', async ({
        page
    }) => {
        await openTable(page, 'useOnEveryCard')
        await boardCard(page, 'Blood Pact').click()
        await page.keyboard.press('ArrowRight')
        await expectEnlarged(page, 'A Round of Ale')
        await page.keyboard.press('ArrowLeft')
        await page.keyboard.press('ArrowLeft')
        await expectEnlarged(page, 'Sacred Ground')
        // At an end the key does nothing.
        await page.keyboard.press('ArrowLeft')
        await expectEnlarged(page, 'Sacred Ground')
        await page.keyboard.press('Escape')
        await expect(preview(page)).toHaveCount(0)

        await page.getByRole('tab', { name: 'Chat' }).click()
        await boardCard(page, 'Blood Pact').click()
        await page.locator('textarea').focus()
        await page.keyboard.press('ArrowRight')
        await expectEnlarged(page, 'Blood Pact')
    })

    test("a seat: Rhys's advisers, then their relic, passing over their facedown adviser", async ({
        page
    }) => {
        await openTable(page, 'zoomPaging')
        await seatCard(page, 'Rhys', 'Garrison').click()
        await expectEnlarged(page, 'Garrison')
        await expect(previousCard(page)).toHaveCount(0)
        await expect(nextCard(page)).toHaveAttribute('aria-label', 'Next card: Tyrant')
        await nextCard(page).click()
        await expectEnlarged(page, 'Tyrant')
        expect(await sides(page)).toEqual([
            'Previous card: Garrison',
            'Next card: The Grand Scepter'
        ])
        const card = await box(frame(page))
        const scepter = await box(nextCard(page))
        expect(Math.round(card.width)).toBe(420)
        expect(Math.round(scepter.width)).toBe(276)
        await nextCard(page).click()
        await expectEnlarged(page, 'The Grand Scepter')
        await expect(nextCard(page)).toHaveCount(0)
        // Hidden information: the Tutor, facedown on Rhys's seat, never shows in Dana's view.
        await expect(page.locator('img[alt="Tutor"]')).toHaveCount(0)
    })

    test("your own seat: Dana's facedown Relic Thief stays in their group", async ({ page }) => {
        await openTable(page, 'zoomPaging')
        await seatCard(page, 'Dana', 'Special Envoy').click()
        await expect(nextCard(page)).toHaveAttribute('aria-label', 'Next card: Animal Playmates')
        await nextCard(page).click()
        await expect(nextCard(page)).toHaveAttribute(
            'aria-label',
            'Next card: Relic Thief — facedown; only you see it'
        )
        await nextCard(page).click()
        await expectEnlarged(page, 'Relic Thief — facedown; only you see it')
        await expect(nextCard(page)).toHaveCount(0)
    })

    test('the drawn cards page in draw order, the Vision last and drawn at 79%', async ({
        page
    }) => {
        await openTable(page, 'zoomPagingSearch')
        await page.getByRole('button', { name: 'Enlarge Longbows' }).click()
        await expectEnlarged(page, 'Longbows')
        await expect(previousCard(page)).toHaveCount(0)
        await expect(nextCard(page)).toHaveAttribute('aria-label', 'Next card: Tavern Songs')
        await nextCard(page).click()
        await nextCard(page).click()
        await expectEnlarged(page, 'Vision of Conquest')
        await expect(nextCard(page)).toHaveCount(0)
        const card = await box(frame(page))
        expect(Math.abs(card.width - 802)).toBeLessThanOrEqual(1)
        expect(Math.abs((await box(previousCard(page))).width - 199)).toBeLessThanOrEqual(1)
    })

    test("Setup's dealt hand pages in the order it was dealt", async ({ page }) => {
        await openTable(page, 'setup')
        const magnifiers = page.locator('.panel').getByRole('button', { name: /^Enlarge / })
        const names = (await magnifiers.evaluateAll((all) =>
            all.map((b) => b.getAttribute('aria-label')?.replace(/^Enlarge /, ''))
        )) as string[]
        expect(names.length).toBeGreaterThan(1)
        await magnifiers.first().click()
        await expectEnlarged(page, names[0])
        await expect(previousCard(page)).toHaveCount(0)
        await expect(nextCard(page)).toHaveAttribute('aria-label', `Next card: ${names[1]}`)
        await nextCard(page).click()
        await expectEnlarged(page, names[1])
    })

    test("an edifice's other side stays beside it, and the next card stands past it", async ({
        page
    }) => {
        await openTable(page, 'edificeMap')
        await boardCard(page, 'Hall of Debate').click()
        await expectEnlarged(page, 'Hall of Debate')
        const other = await box(preview(page).locator('[data-other-side] img'))
        const next = await box(nextCard(page))
        const card = await box(frame(page))
        expect(Math.round(card.width)).toBe(420)
        expect(Math.round(other.width)).toBe(150)
        expect(Math.round(next.x - (other.x + other.width))).toBe(16)
        // The card and its other side are centred together.
        expect(Math.abs((card.x + other.x + other.width) / 2 - 640)).toBeLessThan(2)
    })

    test('a card zoomed from anywhere else has no side cards, as today', async ({ page }) => {
        await openTable(page, 'useOnEveryCard')
        await page
            .locator('.site')
            .filter({ has: page.locator('img[alt="Standing Stones"]') })
            .locator('.board-card')
            .first()
            .click()
        await expect(preview(page)).toBeVisible()
        await expect(preview(page).locator('.card-preview__side')).toHaveCount(0)
        await page.keyboard.press('ArrowRight')
        await expect(preview(page)).toBeVisible()
        await expect(preview(page).locator('.card-preview__side')).toHaveCount(0)
    })
})

test.describe('paging the enlarged card on a phone, 375 × 812', () => {
    test.use({ viewport: { width: 375, height: 812 } })

    test('a 48 px strip each side with a 44 px gold chevron, the card 279 wide; a tap on a strip or a swipe pages, a tap elsewhere closes', async ({
        page
    }) => {
        await openTable(page, 'useOnEveryCard')
        await showRegion(page, 'Cradle')
        await expect(tag(page)).toBeVisible()
        await boardCard(page, 'Blood Pact').click()
        await expectEnlarged(page, 'Blood Pact')
        await expect(tag(page)).toHaveCount(0)
        expect(await sides(page)).toEqual(['Previous card', 'Next card'])
        const card = await box(frame(page))
        expect(Math.round(card.width)).toBe(279)
        const left = await box(previousCard(page))
        const right = await box(nextCard(page))
        expect([left.x, left.width, left.height].map(Math.round)).toEqual([0, 48, 812])
        expect([right.x, right.width, right.height].map(Math.round)).toEqual([327, 48, 812])
        expect(left.x + left.width).toBeLessThanOrEqual(card.x + 0.5)
        expect(right.x).toBeGreaterThanOrEqual(card.x + card.width - 0.5)
        for (const strip of [previousCard(page), nextCard(page)]) {
            const mark = await box(strip.locator('.card-preview__mark'))
            expect([mark.width, mark.height].map(Math.round)).toEqual([44, 44])
        }

        await nextCard(page).click()
        await expectEnlarged(page, 'A Round of Ale')
        // A sideways swipe: right to left shows the next card, left to right the previous.
        await page.mouse.move(300, 400)
        await page.mouse.down()
        await page.mouse.move(200, 405, { steps: 4 })
        await page.mouse.move(90, 410, { steps: 4 })
        await page.mouse.up()
        await expectEnlarged(page, 'Keep')
        await page.mouse.move(90, 400)
        await page.mouse.down()
        await page.mouse.move(300, 400, { steps: 6 })
        await page.mouse.up()
        await expectEnlarged(page, 'A Round of Ale')

        await frame(page).click()
        await expect(preview(page)).toHaveCount(0)
        await expect(tag(page)).toBeVisible()
    })

    test('the first card has no left strip, and a tap there closes', async ({ page }) => {
        await openTable(page, 'useOnEveryCard')
        await showRegion(page, 'Cradle')
        await boardCard(page, 'Sacred Ground').click()
        await expectEnlarged(page, 'Sacred Ground')
        await expect(previousCard(page)).toHaveCount(0)
        await expect(nextCard(page)).toHaveCount(1)
        expect(Math.round((await box(frame(page))).width)).toBe(279)
        await page.mouse.click(20, 400)
        await expect(preview(page)).toHaveCount(0)
    })

    test('a card with no group keeps its size and has no strips', async ({ page }) => {
        await openTable(page, 'useOnEveryCard')
        await showRegion(page, 'Cradle')
        await page
            .locator('.site')
            .filter({ has: page.locator('img[alt="Standing Stones"]') })
            .locator('.board-card')
            .first()
            .click()
        await expect(preview(page)).toBeVisible()
        await expect(preview(page).locator('.card-preview__strip')).toHaveCount(0)
    })
})
