import { expect, test, type Locator, type Page } from '@playwright/test'
import type * as TableFixture from '../src/lib/testing/tableFixture.js'

// R-9.4 — the fronts in a discard pile are private and every back is public, so each pile wears its
// count on a pill at its right, and while it holds a Vision whose place is known, a second pill above
// it shows a Vision back and the places from the top: never which Vision.

async function openTable(page: Page, name: TableFixture.TableName) {
    await page.goto('/')
    await page.evaluate(async (name) => {
        const fixture = await import(
            new URL('/src/lib/testing/tableFixture.ts', location.href).href
        )
        return fixture.open(name)
    }, name)
}

const REGIONS = ['cradle', 'provinces', 'hinterland'] as const

const pile = (page: Page, region: string) => page.locator(`.discard[data-region="${region}"]`)
const countPill = (page: Page, region: string) => pile(page, region).locator('.discard__count')
const placesPill = (page: Page, region: string) => pile(page, region).locator('.discard__places')

interface Rect {
    x: number
    y: number
    width: number
    height: number
}

/** An element's rectangle in board px, the map's own units, whatever the board's zoom or pan. */
function boardRect(element: Locator): Promise<Rect> {
    return element.evaluate((el) => {
        const map = el.closest<HTMLElement>('.board-map')
        if (!map) throw Error('The element is on the board')
        const frame = map.getBoundingClientRect()
        const scale = frame.width / map.offsetWidth
        const rect = el.getBoundingClientRect()
        return {
            x: (rect.left - frame.left) / scale,
            y: (rect.top - frame.top) / scale,
            width: rect.width / scale,
            height: rect.height / scale
        }
    })
}

const boardWidth = (page: Page) =>
    page.locator('.board-map').evaluate((map) => (map as HTMLElement).offsetWidth)

const overlaps = (a: Rect, b: Rect) =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

// The board's printed titles and Search markers along its top strip, in board px (read off the map's
// art): a pill above a pile keeps clear of them.
const PRINTED: Record<string, Rect> = {
    'the Cradle title': { x: 28, y: 30, width: 186, height: 96 },
    'the Provinces title': { x: 866, y: 30, width: 258, height: 96 },
    'the Hinterland title': { x: 1733, y: 30, width: 270, height: 100 },
    'the Cradle Search marker': { x: 345, y: 128, width: 84, height: 50 },
    'the Provinces Search marker': { x: 1196, y: 128, width: 86, height: 50 },
    'the Hinterland Search marker': { x: 2063, y: 128, width: 86, height: 50 }
}

/** The places pill lies on the board's top strip, over its pile and clear of everything else there. */
async function expectPlacesPillPlaced(page: Page, region: string) {
    const pill = await boardRect(placesPill(page, region))
    const box = await boardRect(pile(page, region))
    const width = await boardWidth(page)
    expect(pill.y).toBeGreaterThanOrEqual(0)
    expect(pill.x).toBeGreaterThanOrEqual(0)
    expect(pill.x + pill.width).toBeLessThanOrEqual(width)
    expect(pill.height).toBeCloseTo(36, 0)
    expect(pill.y).toBeCloseTo(box.y - 28, 0)
    // Its bottom no more than 8 board px into the pile, above the card back's art.
    expect(pill.y + pill.height).toBeLessThanOrEqual(box.y + 8.5)
    expect(pill.x + pill.width / 2).toBeCloseTo(box.x + box.width / 2, 0)
    for (const site of await page.locator('.site').all())
        expect(overlaps(pill, await boardRect(site)), 'a site row').toBe(false)
    for (const [name, printed] of Object.entries(PRINTED))
        expect(overlaps(pill, printed), name).toBe(false)
    for (const other of REGIONS) {
        expect(overlaps(pill, await boardRect(countPill(page, other))), `${other}'s count`).toBe(
            false
        )
        if (other !== region && (await placesPill(page, other).count()) > 0)
            expect(overlaps(pill, await boardRect(placesPill(page, other))), other).toBe(false)
    }
}

/** The count pill sits on the pile's right side, vertically centred, inside the pile. */
async function expectCountPillPlaced(page: Page, region: string) {
    const pill = await boardRect(countPill(page, region))
    const box = await boardRect(pile(page, region))
    expect(pill.x).toBeGreaterThan(box.x + box.width / 2)
    expect(pill.x + pill.width).toBeLessThanOrEqual(box.x + box.width + 0.5)
    expect(pill.y).toBeGreaterThanOrEqual(box.y - 0.5)
    expect(pill.y + pill.height).toBeLessThanOrEqual(box.y + box.height + 0.5)
    expect(pill.y + pill.height / 2).toBeCloseTo(box.y + box.height / 2, 0)
    expect(pill.height).toBeCloseTo(62, 0)
}

/** The places pill holds a whole Vision back, 16 board px wide, and its places, nothing cut off. */
async function expectPlaces(page: Page, region: string, places: string) {
    const pill = placesPill(page, region)
    await expect(pill).toHaveText(places)
    await expect(pill.locator('img')).toHaveCount(1)
    const frame = await boardRect(pill)
    const back = await boardRect(pill.locator('img'))
    expect(back.width).toBeCloseTo(16, 0)
    expect(back.x).toBeGreaterThanOrEqual(frame.x)
    expect(back.y).toBeGreaterThanOrEqual(frame.y)
    expect(back.y + back.height).toBeLessThanOrEqual(frame.y + frame.height)
    expect(await pill.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
}

async function expectCountOnly(page: Page, region: string, count: string) {
    await expect(countPill(page, region)).toHaveText(count)
    await expect(placesPill(page, region)).toHaveCount(0)
}

for (const viewport of [
    { width: 1280, height: 800 },
    { width: 375, height: 812 }
]) {
    test.describe(`at ${viewport.width} × ${viewport.height}`, () => {
        test.use({ viewport })

        test('three Visions and two: the places pills read "3 · 8 · 11" and "6 · 14", the counts 16 and 26, the Cradle’s 4 alone', async ({
            page
        }) => {
            await openTable(page, 'discardVisionsThreeAndTwo')
            await expect(countPill(page, 'provinces')).toHaveText('16')
            await expectPlaces(page, 'provinces', '3 · 8 · 11')
            await expect(countPill(page, 'hinterland')).toHaveText('26')
            await expectPlaces(page, 'hinterland', '6 · 14')
            await expectCountOnly(page, 'cradle', '4')
            // One description per pile for a screen reader; the ordinals are the label's alone.
            await expect(
                pile(page, 'provinces').getByRole('img', {
                    name: 'Provinces discard pile: 16 cards; Visions 3rd, 8th and 11th from the top',
                    exact: true
                })
            ).toHaveCount(1)
            await expect(
                pile(page, 'cradle').getByRole('img', {
                    name: 'Cradle discard pile: 4 cards',
                    exact: true
                })
            ).toHaveCount(1)
            await expect(placesPill(page, 'provinces')).toHaveAttribute('aria-hidden', 'true')
        })

        test('the box beside each pile is gone', async ({ page }) => {
            await openTable(page, 'discardVisionsThreeAndTwo')
            await expect(page.locator('.discard__box')).toHaveCount(0)
            for (const region of REGIONS) {
                const box = await boardRect(pile(page, region))
                for (const child of await pile(page, region).locator(':scope > *').all()) {
                    const rect = await boardRect(child)
                    // Nothing lies right of the pile: the old box stood 10 px beyond its edge.
                    expect(rect.x + rect.width).toBeLessThanOrEqual(box.x + box.width + 0.5)
                }
            }
        })

        for (const [scene, regions] of [
            ['discardVisionsThreeAndTwo', ['provinces', 'hinterland']],
            ['discardVisionsFiveInOne', ['hinterland']],
            ['discardVisionsOne', ['provinces']],
            ['discardVisions', ['provinces', 'hinterland']]
        ] as const) {
            test(`${scene}: each places pill lies above its pile on the board, clear of the card back, the site rows, the titles and the Search markers; each count pill on its pile’s right`, async ({
                page
            }) => {
                await openTable(page, scene)
                for (const region of regions) await expectPlacesPillPlaced(page, region)
                for (const region of REGIONS) await expectCountPillPlaced(page, region)
            })
        }

        test('all five Visions in the Hinterland’s pile: "12 · 15 · 18 · 21 · 24" on one line, wider than the pile and inside the board; the Provinces’ 12 alone', async ({
            page
        }) => {
            await openTable(page, 'discardVisionsFiveInOne')
            await expectPlaces(page, 'hinterland', '12 · 15 · 18 · 21 · 24')
            await expect(countPill(page, 'hinterland')).toHaveText('26')
            await expectCountOnly(page, 'provinces', '12')
            await expectCountOnly(page, 'cradle', '4')
            const pill = await boardRect(placesPill(page, 'hinterland'))
            const box = await boardRect(pile(page, 'hinterland'))
            expect(pill.width).toBeGreaterThan(box.width)
            expect(pill.height).toBeCloseTo(36, 0)
            await expect(
                pile(page, 'hinterland').getByRole('img', {
                    name: 'Hinterland discard pile: 26 cards; Visions 12th, 15th, 18th, 21st and 24th from the top',
                    exact: true
                })
            ).toHaveCount(1)
        })

        test('one Vision: "5" over the Provinces’ 7; a Vision on top is "1"', async ({ page }) => {
            await openTable(page, 'discardVisionsOne')
            await expect(countPill(page, 'provinces')).toHaveText('7')
            await expectPlaces(page, 'provinces', '5')
            await expectCountOnly(page, 'hinterland', '9')
            await openTable(page, 'discardVisions')
            await expectPlaces(page, 'hinterland', '1')
            await expectPlaces(page, 'provinces', '3 · 8')
        })

        test('a game created before the table kept every back: each pile wears its count alone, 0 on the empty pile', async ({
            page
        }) => {
            await openTable(page, 'discardVisionsOlderGame')
            await expectCountOnly(page, 'cradle', '0')
            await expectCountOnly(page, 'provinces', '12')
            await expectCountOnly(page, 'hinterland', '7')
            await expect(pile(page, 'cradle')).toHaveClass(/empty/)
            for (const region of REGIONS) await expectCountPillPlaced(page, region)
        })

        test('a Search lights the Provinces’ pile with both pills on it: the price under it, pointing at its row, and its row searches it', async ({
            page
        }) => {
            await openTable(page, 'discardVisionsThreeAndTwo')
            const panel = page.locator('.panel')
            await panel.locator('.majors button').filter({ hasText: 'Search' }).click()
            const provinces = pile(page, 'provinces')
            await expect(provinces).toHaveClass(/pickable/)
            await expect(provinces.locator('.pick-cost--discard')).toBeVisible()
            await expectPlaces(page, 'provinces', '3 · 8 · 11')
            await expect(countPill(page, 'provinces')).toHaveText('16')
            // Neither pill takes a pointer from the pile.
            for (const pill of [countPill(page, 'provinces'), placesPill(page, 'provinces')])
                expect(await pill.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none')
            const cost = await boardRect(provinces.locator('.pick-cost--discard'))
            expect(overlaps(cost, await boardRect(placesPill(page, 'provinces')))).toBe(false)
            const row = panel.getByRole('button', { name: /^Search the Provinces discard pile/ })
            await row.focus()
            await expect(provinces).toHaveClass(/pointed/)
            await row.click()
            await expect(page.getByText('Keep one.', { exact: true })).toBeVisible()
        })
    })
}
