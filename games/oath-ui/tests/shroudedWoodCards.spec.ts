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

async function openTable(page: Page, name: TableFixture.TableName) {
    await page.goto('/')
    return call(page, 'open', name)
}

async function boxOf(page: Page, locator: ReturnType<Page['locator']>) {
    const box = await locator.boundingBox()
    if (!box) throw Error('The element is not drawn')
    return box
}

const panel = (page: Page) => page.locator('.panel')
const cardRow = (page: Page, name: string) => panel(page).locator('button[aria-pressed]').filter({ hasText: name })
const travelTile = (page: Page) => panel(page).locator('.majors button').filter({ hasText: 'Travel' })
const woodButton = (page: Page) => panel(page).getByRole('button', { name: /^Travel:\s*Bea\s*picks where$/ })
const priceCells = (page: Page) => panel(page).getByRole('list', { name: 'What you pay, by region' }).getByRole('listitem')
const siteAt = (page: Page, slotId: string) => page.locator(`.site[data-slot="${slotId}"]`)
const litSlots = (page: Page) =>
    page
        .locator('.site')
        .filter({ has: page.locator('.board-card.offered') })
        .evaluateAll((sites) => sites.map((site) => site.getAttribute('data-slot') ?? '').sort())

const SLOTS = {
    drownedCity: 'slot.cradle.0',
    plains: 'slot.cradle.1',
    wood: 'slot.provinces.0',
    greatSlum: 'slot.provinces.1',
    river: 'slot.provinces.2',
    mountain: 'slot.hinterland.0',
    hiddenPlace: 'slot.hinterland.1',
    wastes: 'slot.hinterland.2'
}

const SIZES = [
    { name: 'desktop', viewport: { width: 1280, height: 900 }, phone: false },
    { name: 'phone', viewport: { width: 375, height: 812 }, phone: true }
]

/** R-11.7-H2 — a Travel out of an enemy's Shrouded Wood takes the traveller's cards, as any Travel does. */
for (const { name, viewport, phone } of SIZES) {
    test.describe(`the traveller’s cards at an enemy’s Shrouded Wood, on a ${name}`, () => {
        test.use({ viewport })

        test('the Cards rows list the Travel cards; in use, the price row has one cell per region, price and card', async ({ page }) => {
            await openTable(page, 'woodCards')
            await travelTile(page).click()
            await expect(panel(page).locator('button[aria-pressed]')).toHaveText([/Tents/, /Forest Paths/, /Portal/])
            await expect(panel(page).locator('button[aria-pressed="true"]')).toHaveCount(0)
            await expect(priceCells(page)).toHaveCount(0)
            await expect(panel(page)).toContainText('2 Supply.')

            await cardRow(page, 'Tents').click()
            await cardRow(page, 'Forest Paths').click()
            await expect(panel(page).locator('button[aria-pressed="true"]')).toHaveCount(2)
            await expect(priceCells(page)).toHaveText(
                [
                    /^cradle\s*0 Supply\s*Forest Paths$/i,
                    /^cradle\s*2 Supply\s*$/i,
                    /^provinces\s*0 Supply\s*Tents$/i,
                    /^hinterland\s*0 Supply\s*Forest Paths$/i,
                    /^hinterland\s*2 Supply\s*$/i
                ],
                { useInnerText: true }
            )
            const panelBox = await boxOf(page, panel(page))
            const cells = await Promise.all([0, 1, 2, 3, 4].map((i) => boxOf(page, priceCells(page).nth(i))))
            for (const cell of cells) expect(cell.x + cell.width).toBeLessThanOrEqual(panelBox.x + panelBox.width)
            if (phone) {
                // Two to a row: the five cells wrap onto three lines.
                expect(Math.abs(cells[0].y - cells[1].y)).toBeLessThan(1)
                expect(cells[2].y).toBeGreaterThan(cells[0].y + cells[0].height - 1)
                expect(Math.abs(cells[2].y - cells[3].y)).toBeLessThan(1)
                expect(cells[4].y).toBeGreaterThan(cells[2].y + cells[2].height - 1)
                expect(Math.abs(cells[0].width - cells[1].width)).toBeLessThan(1)
            } else {
                for (const cell of cells) expect(Math.abs(cell.y - cells[0].y)).toBeLessThan(1)
            }

            // Sent: the cards' favor is placed with the Travel, and Bea picks.
            await woodButton(page).click()
            await expect(panel(page).getByText(/^Pick where\s*Dana\s*goes\.$/)).toBeVisible()
            const facts = await call(page, 'tableFacts')
            expect(facts.seatId).toBe('Bea')
            expect(facts.siteOf.Dana).toBe(SLOTS.wood)
            expect(facts.favorOf.Dana).toBe(0)
        })

        test('Portal in use at its own Wood: the ordinary Travel, every site lit at 0 Supply; put down, the Wood’s panel is back', async ({ page }) => {
            await openTable(page, 'woodCards')
            await travelTile(page).click()
            await cardRow(page, 'Portal').click()
            await expect(cardRow(page, 'Portal')).toHaveAttribute('aria-pressed', 'true')
            await expect(woodButton(page)).toHaveCount(0)
            await expect(panel(page).getByText('Tap a lit site.')).toBeVisible()
            // Tapped again, Portal goes down and the Wood's panel is back; once more, the ordinary Travel.
            await cardRow(page, 'Portal').click()
            await expect(cardRow(page, 'Portal')).toHaveAttribute('aria-pressed', 'false')
            await expect(woodButton(page)).toBeVisible()
            await cardRow(page, 'Portal').click()
            await expect(panel(page).getByText('Tap a lit site.')).toBeVisible()
            if (phone) return
            const sites = Object.values(SLOTS).filter((slotId) => slotId !== SLOTS.wood).sort()
            expect(await litSlots(page)).toEqual(sites)
            // Way Station's Great Slum also offers its favor way, as on any Travel there ("0 or 0+").
            for (const slotId of sites.filter((slotId) => slotId !== SLOTS.greatSlum)) {
                await expect(siteAt(page, slotId).locator('.travel-cost')).toHaveText('0 Supply')
            }
            await siteAt(page, SLOTS.mountain).locator('.board-card').click()
            await expect.poll(async () => (await call(page, 'tableFacts')).siteOf.Dana).toBe(SLOTS.mountain)
            expect((await call(page, 'tableFacts')).favorOf.Dana).toBe(2)
        })

        test('with 1 Supply the Travel tile opens on Forest Paths; the button waits for the card', async ({ page }) => {
            await openTable(page, 'woodCardsLow')
            await expect(travelTile(page)).toBeEnabled()
            await travelTile(page).click()
            await expect(panel(page).getByText('Needs 2 Supply; you have 1.')).toBeVisible()
            await expect(woodButton(page)).toBeDisabled()
            await cardRow(page, 'Forest Paths').click()
            await expect(panel(page).getByText('Needs 2 Supply; you have 1.')).toHaveCount(0)
            await expect(panel(page)).toContainText('0 Supply.')
            await expect(woodButton(page)).toBeEnabled()
            await woodButton(page).click()
            await expect.poll(async () => (await call(page, 'tableFacts')).seatId).toBe('Bea')
        })

        test('"Dana stays": under the line, sized to its label; it keeps Dana at the Wood', async ({ page }) => {
            await openTable(page, 'woodStays')
            await expect(panel(page).getByText(/^Pick where\s*Dana\s*goes\.$/)).toBeVisible()
            const stays = panel(page).getByRole('button', { name: /^Dana\s*stays$/ })
            await expect(stays).toBeVisible()
            const [line, button, panelBox] = [await boxOf(page, panel(page).getByText(/^Pick where\s*Dana\s*goes\.$/)), await boxOf(page, stays), await boxOf(page, panel(page))]
            expect(button.y).toBeGreaterThan(line.y + line.height - 1)
            expect(button.width).toBeLessThan(panelBox.width * 0.5)
            if (phone) expect(button.height).toBeGreaterThanOrEqual(44)
            await expect(stays.locator('.text-oath-accent')).toHaveCount(0)

            await stays.click()
            await expect(stays).toHaveCount(0)
            const facts = await call(page, 'tableFacts')
            expect(facts.siteOf.Dana).toBe(SLOTS.wood)
            expect(facts.favorOf.Dana).toBe(0)
            if (!phone) {
                await page.getByRole('tab', { name: 'History' }).click()
                // The table has passed back to Dana, whose own view says "you".
                expect((await call(page, 'tableFacts')).seatId).toBe('Dana')
                await expect(page.locator('.history')).toContainText(/you\s*set out from Shrouded Wood \(Forest Paths\);\s*Bea\s*picks where/)
                await expect(page.locator('.history')).toContainText(/you\s*stayed at Shrouded Wood \(Bea's pick\)/)
            }
        })

        test('control: while Dana could pay for a site without the cards, no "Dana stays"', async ({ page }) => {
            await openTable(page, 'woodCardsRuler')
            await expect(panel(page).getByText(/^Pick where\s*Dana\s*goes\.$/)).toBeVisible()
            await expect(panel(page).getByRole('button', { name: /stays$/ })).toHaveCount(0)
        })
    })
}

/** R-11.7-H2 — the ruler's pick with the traveller's cards counted, and its History. */
test.describe('the Shrouded Wood ruler’s pick with the traveller’s cards, on a desktop at 1280', () => {
    test('each lit site’s chip is what Dana pays there with the cards; the History names the cards', async ({ page }) => {
        await openTable(page, 'woodCardsRuler')
        await expect(panel(page).getByText(/^Pick where\s*Dana\s*goes\.$/)).toBeVisible()
        const free = [SLOTS.plains, SLOTS.greatSlum, SLOTS.river, SLOTS.hiddenPlace]
        const paid = [SLOTS.drownedCity, SLOTS.mountain, SLOTS.wastes]
        expect(await litSlots(page)).toEqual([...free, ...paid].sort())
        for (const slotId of free) await expect(siteAt(page, slotId).locator('.travel-cost')).toHaveText('0 Supply')
        for (const slotId of paid) await expect(siteAt(page, slotId).locator('.travel-cost')).toHaveText('2 Supply')
        await expect(siteAt(page, SLOTS.river).getByRole('button', { name: /, 0 Supply \(Tents\)$/ })).toHaveCount(1)
        await expect(siteAt(page, SLOTS.plains).getByRole('button', { name: /, 0 Supply \(Forest Paths\)$/ })).toHaveCount(1)

        await page.getByRole('tab', { name: 'History' }).click()
        await expect(page.locator('.history')).toContainText(/Dana\s*set out from Shrouded Wood \(Tents, Forest Paths\);\s*you\s*pick where/)
        await siteAt(page, SLOTS.river).locator('.board-card').click()
        await expect.poll(async () => (await call(page, 'tableFacts')).siteOf.Dana).toBe(SLOTS.river)
        await expect(page.locator('.history')).toContainText(/traveled from Shrouded Wood to River \((your|Bea's) pick\), spending 0 Supply \(Tents\)/)
    })
})

/** R-11.7-H2 — on a phone the ruler picks from the panel's rows, one per region, price and card. */
test.describe('the Shrouded Wood ruler’s pick with the traveller’s cards, on a phone at 375', () => {
    test.use({ viewport: { width: 375, height: 812 } })

    test('the rows name the card that set each price, and every row fits the screen', async ({ page }) => {
        await openTable(page, 'woodCardsRuler')
        const rows = panel(page).getByRole('group', { name: /^Sites in the / })
        await expect(rows).toHaveText(
            [/^cradle\s*0\s*Supply\s*Forest Paths\s*Plains$/i, /^cradle\s*2\s*Supply\s*Drowned City$/i, /^provinces\s*0\s*Supply\s*Tents\s*Great Slum\s*River$/i, /^hinterland\s*0\s*Supply\s*Forest Paths\s*The Hidden Place$/i, /^hinterland\s*2\s*Supply\s*Mountain\s*Wastes$/i],
            { useInnerText: true }
        )
        const panelBox = await boxOf(page, panel(page))
        for (let i = 0; i < 5; i++) {
            const box = await boxOf(page, rows.nth(i))
            expect(box.x + box.width).toBeLessThanOrEqual(panelBox.x + panelBox.width)
        }
        await rows.nth(2).getByRole('button', { name: 'River' }).click()
        await expect.poll(async () => (await call(page, 'tableFacts')).siteOf.Dana).toBe(SLOTS.river)
    })
})
