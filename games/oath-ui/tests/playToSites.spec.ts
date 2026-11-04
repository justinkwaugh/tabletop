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

async function openTable(page: Page, name: TableFixture.TableName) {
    await page.goto('/')
    return call(page, 'open', name)
}

type Box = { x: number; y: number; width: number; height: number }

const boxesOf = (locator: Locator): Promise<Box[]> =>
    locator.evaluateAll((elements) =>
        elements.map((element) => {
            const box = element.getBoundingClientRect()
            return { x: box.x, y: box.y, width: box.width, height: box.height }
        })
    )

const inside = (inner: Box, outer: Box) =>
    inner.x >= outer.x - 0.5 &&
    inner.y >= outer.y - 0.5 &&
    inner.x + inner.width <= outer.x + outer.width + 0.5 &&
    inner.y + inner.height <= outer.y + outer.height + 0.5

const panel = (page: Page) => page.locator('.panel')
const playTo = (page: Page) => panel(page).locator('[data-play-to-sites]')
const rows = (page: Page) => playTo(page).getByRole('button')
const line = (page: Page) => playTo(page).locator('[data-play-to-line]')
const history = (page: Page) => page.locator('.history')
const HOME = 'slot.cradle.0'
const NEXT = 'slot.cradle.1'
const FAR = 'slot.hinterland.2'
const ALL_SITES = [
    'slot.cradle.0',
    'slot.cradle.1',
    'slot.provinces.0',
    'slot.provinces.1',
    'slot.provinces.2',
    'slot.hinterland.0',
    'slot.hinterland.1',
    'slot.hinterland.2'
]
const siteAt = (page: Page, slotId: string) => page.locator(`.site[data-slot="${slotId}"]`)
const siteCard = (page: Page, slotId: string) => siteAt(page, slotId).locator('.board-card')
const chipOf = (page: Page, slotId: string) => siteAt(page, slotId).locator('.travel-cost')
const WOLVES = 'denizen.beast.wolves'
const WAR_TORTOISE = 'denizen.beast.war-tortoise'

/** The kept card went to the other Cradle site, not the seat's own. */
async function expectWolvesAtNext(page: Page) {
    await expect
        .poll(async () => (await call(page, 'tableFacts')).denizensAt[NEXT])
        .toContain(WOLVES)
    expect((await call(page, 'tableFacts')).denizensAt[HOME]).not.toContain(WOLVES)
}
const litSlots = (page: Page) =>
    page
        .locator('.site')
        .filter({ has: page.locator('.board-card.offered') })
        .evaluateAll((sites) => sites.map((site) => site.getAttribute('data-slot') ?? '').sort())
const ringedSlots = (page: Page) =>
    page
        .locator('.site')
        .filter({ has: page.locator('.board-card.picked') })
        .evaluateAll((sites) => sites.map((site) => site.getAttribute('data-slot') ?? '').sort())
const regionChips = (page: Page) => page.getByRole('group', { name: 'Frame the map on a region' })
const regionChip = (page: Page, region: string) =>
    regionChips(page).getByRole('button', { name: new RegExp(`^${region}:`) })

const DESKTOP = { width: 1280, height: 900 }
const PHONE = { width: 375, height: 812 }

/** The site's name as the map's pick names it: "<name>, play here". */
async function mapName(page: Page, slotId: string): Promise<string> {
    const label =
        (await siteAt(page, slotId).getByRole('button').first().getAttribute('aria-label')) ?? ''
    expect(label).toMatch(/, play here$/)
    return label.replace(/, play here$/, '')
}

/**
 * The site rows on a desktop: one width; two a row, the second beside the first; every
 * row inside the panel.
 */
async function expectRowsLaidOut(page: Page) {
    const boxes = await boxesOf(rows(page))
    const outer = await boxesOf(panel(page))
    expect(boxes.length).toBeGreaterThan(1)
    for (const [i, box] of boxes.entries()) {
        const first = boxes[0] as Box
        expect(Math.abs(box.width - first.width), `row ${i}: one width`).toBeLessThanOrEqual(1)
        expect(inside(box, outer[0] as Box), `row ${i}: inside the panel`).toBe(true)
        const left = boxes[i - (i % 2)] as Box
        if (i % 2 === 1) {
            expect(Math.abs(box.y - left.y), `row ${i}: beside the one before`).toBeLessThanOrEqual(
                1
            )
            expect(box.x, `row ${i}: to its right`).toBeGreaterThan(left.x + left.width - 1)
        }
    }
}

/** The line in the rows' place: "To which site: tap a lit site.", then the site tapped. */
async function expectLine(page: Page, words: string) {
    await expect(rows(page)).toHaveCount(0)
    await expect(panel(page).getByRole('combobox')).toHaveCount(0)
    await expect(line(page)).toHaveText(new RegExp(`^To which site:\\s*${words}$`))
}

async function keepWolves(page: Page) {
    await openTable(page, 'searchPlayTo')
    await panel(page).getByRole('button', { name: 'Wolves', exact: true }).click()
}

async function chooseToYourSite(page: Page) {
    await openTable(page, 'facedownNewGrowth')
    await panel(page).getByRole('button', { name: 'Adviser', exact: true }).click()
    await panel(page)
        .getByRole('button', { name: /^To your site: War Tortoise(, .+)?$/ })
        .click()
}

test.describe('R-5.1.4.I — Search with the People’s Favor (2 sites)', () => {
    test.describe('on a desktop at 1280: the site rows', () => {
        test.use({ viewport: DESKTOP })

        test('the seat’s own site first and picked, the other beside it; the map is not lit; the site tapped is where the kept card goes', async ({
            page
        }) => {
            await keepWolves(page)
            await expect(playTo(page).getByRole('heading', { name: 'To which site' })).toBeVisible()
            await expect(panel(page).getByRole('combobox')).toHaveCount(0)
            await expect(rows(page)).toHaveCount(2)
            await expect(rows(page).nth(0)).toContainText('your site · 3 of 3, full')
            await expect(rows(page).nth(1)).toContainText('Cradle · 1 of 3')
            await expect(rows(page).nth(0)).toHaveAttribute('aria-pressed', 'true')
            await expect(rows(page).nth(1)).toHaveAttribute('aria-pressed', 'false')
            await expectRowsLaidOut(page)
            expect(await litSlots(page)).toEqual([])
            await expect(chipOf(page, NEXT)).toHaveCount(0)

            await rows(page).nth(1).click()
            await expect(rows(page).nth(1)).toHaveAttribute('aria-pressed', 'true')
            await expect(rows(page).nth(0)).toHaveAttribute('aria-pressed', 'false')
            await panel(page)
                .getByRole('button', { name: /^To your site/ })
                .click()
            await expectWolvesAtNext(page)
        })
    })

    test.describe('on a phone at 375: the lit map, whatever the number', () => {
        test.use({ viewport: PHONE, hasTouch: true })

        test('no rows: the line, both Cradle sites lit with "play here", the seat’s ringed; a tap on the other picks it, and the kept card goes there', async ({
            page
        }) => {
            await keepWolves(page)
            await expectLine(page, 'tap a lit site\\.')
            expect(await litSlots(page)).toEqual([HOME, NEXT])
            await expect(chipOf(page, HOME)).toHaveText('play here')
            await expect(chipOf(page, NEXT)).toHaveText('play here')
            expect(await ringedSlots(page)).toEqual([HOME])
            await expect(regionChip(page, 'Cradle')).toHaveAccessibleName('Cradle: 2 lit sites')
            await expect(regionChip(page, 'Cradle')).toHaveAttribute('aria-pressed', 'true')

            const name = await mapName(page, NEXT)
            await siteCard(page, NEXT).tap()
            await expectLine(page, name)
            expect(await ringedSlots(page)).toEqual([NEXT])
            await siteCard(page, HOME).tap()
            await expectLine(page, 'tap a lit site\\.')
            expect(await ringedSlots(page)).toEqual([HOME])

            await siteCard(page, NEXT).tap()
            await panel(page)
                .getByRole('button', { name: /^To your site/ })
                .click()
            await expectWolvesAtNext(page)
        })
    })
})

test.describe('R-6.1, R-7.4 — the facedown play with New Growth (8 sites)', () => {
    test.describe('on a desktop at 1280: more than four, so the lit map', () => {
        test.use({ viewport: DESKTOP })

        test('no rows: the line, all eight lit with "play here", the seat’s ringed; Undo takes a pick back; the far site tapped is where War Tortoise goes', async ({
            page
        }) => {
            await chooseToYourSite(page)
            await expectLine(page, 'tap a lit site\\.')
            expect(await litSlots(page)).toEqual([...ALL_SITES].sort())
            for (const slotId of ALL_SITES)
                await expect(chipOf(page, slotId)).toHaveText('play here')
            expect(await ringedSlots(page)).toEqual([HOME])
            await expect(regionChips(page)).toHaveCount(0)

            // The far site is in the Hinterland, which the People's Favor does not reach and New Growth does.
            const name = await mapName(page, FAR)
            await siteCard(page, FAR).click()
            await expectLine(page, name)
            expect(await ringedSlots(page)).toEqual([FAR])

            // Undo takes the pick back: the seat's own site is ringed again.
            await page.getByRole('button', { name: 'Undo', exact: true }).click()
            await expectLine(page, 'tap a lit site\\.')
            expect(await ringedSlots(page)).toEqual([HOME])
            expect(await litSlots(page)).toEqual([...ALL_SITES].sort())

            await siteCard(page, FAR).click()
            await expectLine(page, name)
            await panel(page)
                .getByRole('button', { name: 'Play War Tortoise', exact: true })
                .click()
            await expect(page.locator('.board-card.offered')).toHaveCount(0)
            await page.getByRole('tab', { name: 'History' }).click()
            await expect(history(page)).toContainText(`played War Tortoise to ${name} (New Growth)`)
            expect((await call(page, 'tableFacts')).denizensAt[FAR]).toContain(WAR_TORTOISE)
        })
    })

    test.describe('on a phone at 375: the lit map, opening on the seat’s region', () => {
        test.use({ viewport: PHONE, hasTouch: true })

        test('no rows: the line; the Cradle framed with a chip per region; a Hinterland site picked after its chip', async ({
            page
        }) => {
            await chooseToYourSite(page)
            await expectLine(page, 'tap a lit site\\.')
            expect(await litSlots(page)).toEqual([...ALL_SITES].sort())
            expect(await ringedSlots(page)).toEqual([HOME])
            await expect(regionChip(page, 'Cradle')).toHaveAttribute('aria-pressed', 'true')
            await expect(regionChip(page, 'Cradle')).toHaveAccessibleName('Cradle: 2 lit sites')
            await expect(regionChip(page, 'Provinces')).toHaveAccessibleName(
                'Provinces: 3 lit sites'
            )
            await expect(regionChip(page, 'Hinterland')).toHaveAccessibleName(
                'Hinterland: 3 lit sites'
            )

            await regionChip(page, 'Hinterland').tap()
            await expect(regionChip(page, 'Hinterland')).toHaveAttribute('aria-pressed', 'true')
            const name = await mapName(page, FAR)
            await siteCard(page, FAR).tap()
            await expectLine(page, name)
            expect(await ringedSlots(page)).toEqual([FAR])
            await panel(page)
                .getByRole('button', { name: 'Play War Tortoise', exact: true })
                .click()
            await page.getByRole('tab', { name: 'History' }).click()
            await expect(history(page)).toContainText(`played War Tortoise to ${name} (New Growth)`)
        })
    })
})
