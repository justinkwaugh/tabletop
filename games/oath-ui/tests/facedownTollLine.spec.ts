import { expect, test, type Locator, type Page } from '@playwright/test'
import type * as TableFixture from '../src/lib/testing/tableFixture.js'

async function openTable(page: Page, name: TableFixture.TableName) {
    await page.goto('/')
    const opened = await page.evaluate(async (name) => {
        const fixture = await import(
            new URL('/src/lib/testing/tableFixture.ts', location.href).href
        )
        return fixture.open(name)
    }, name)
    expect(opened.seatId).toBe('mara')
}

const grid = (page: Page) => page.locator('.panel')
const chips = (page: Page) => grid(page).locator('.minors button')
const adviserChip = (page: Page) => chips(page).filter({ hasText: /^\s*Adviser\s*$/ })
const tollLine = (page: Page) => grid(page).locator('[data-toll-line]')
const tile = (page: Page, label: string) =>
    grid(page).locator('.majors button').filter({ hasText: label })

const WORDS = 'Needs 1 favor for Forced Labor'

async function box(locator: Locator) {
    const found = await locator.boundingBox()
    if (!found) throw Error('The element is drawn')
    return found
}

async function lineLook(locator: Locator) {
    return locator.evaluate((element) => {
        const style = getComputedStyle(element)
        const lineHeight = parseFloat(style.lineHeight)
        return {
            tag: element.tagName,
            fontSize: style.fontSize,
            borderWidth: style.borderTopWidth,
            muted: element.classList.contains('text-oath-text-muted'),
            danger: element.classList.contains('text-oath-danger'),
            lines: Math.round(element.getBoundingClientRect().height / lineHeight)
        }
    })
}

test.describe('the reason a facedown play is hidden, where the Adviser chip would stand', () => {
    test('at 0 favor at a Forced Labor site the line names the toll and the Adviser chip is left out', async ({
        page
    }) => {
        await openTable(page, 'facedownToll')
        await expect(tollLine(page)).toHaveText(WORDS)
        await expect(adviserChip(page)).toHaveCount(0)
        await expect(chips(page)).toHaveText(['Show'])

        // Muted grid text, not a chip: no button, no border, 11 px on a desktop, on one line.
        expect(await lineLook(tollLine(page))).toEqual({
            tag: 'P',
            fontSize: '11px',
            borderWidth: '0px',
            muted: true,
            danger: false,
            lines: 1
        })
        // First in the minors row, before Show.
        const line = await box(tollLine(page))
        const show = await box(chips(page).first())
        expect(line.x + line.width).toBeLessThanOrEqual(show.x)
        expect(Math.abs(line.y + line.height / 2 - (show.y + show.height / 2))).toBeLessThan(2)
    })

    test('at 1 favor the Adviser chip is offered and no line shows', async ({ page }) => {
        await openTable(page, 'facedownTollPaid')
        await expect(adviserChip(page)).toHaveCount(1)
        await expect(chips(page)).toHaveText(['Adviser', 'Show'])
        await expect(tollLine(page)).toHaveCount(0)
    })

    test('after a Trade with Forced Labor gains the favor, the line goes and the chip comes back', async ({
        page
    }) => {
        await openTable(page, 'facedownTollTraded')
        await expect(adviserChip(page)).toHaveCount(1)
        await expect(tollLine(page)).toHaveCount(0)
    })

    test('a facedown card hidden for another cause, a free Travel due first, shows no line', async ({
        page
    }) => {
        await openTable(page, 'facedownTollFreeTravel')
        await expect(grid(page).locator('.due')).toContainText('Free Travel next.')
        await expect(adviserChip(page)).toHaveCount(0)
        await expect(tollLine(page)).toHaveCount(0)
    })

    test('a Citizen at the site is no enemy of its ruler: no toll, so the chip and no line', async ({
        page
    }) => {
        await openTable(page, 'facedownTollCitizen')
        await expect(adviserChip(page)).toHaveCount(1)
        await expect(tollLine(page)).toHaveCount(0)
    })

    test('the line is not a pointer target: Search keeps its own tapped reason, in the danger line', async ({
        page
    }) => {
        await openTable(page, 'facedownToll')
        await tollLine(page).hover()
        await expect(grid(page).locator('.strip')).toHaveText('')
        // A dimmed tile is aria-disabled, so the tap is forced, as a player's tap lands.
        await tile(page, 'Search').click({ force: true })
        await expect(grid(page).locator('.strip .text-oath-danger')).toContainText(
            /Forced Labor: you cannot search from here unless you give 1 .*to its ruler/
        )
        await expect(tollLine(page)).toHaveText(WORDS)
    })
})

test.describe('on a phone held upright', () => {
    test.use({ viewport: { width: 375, height: 812 } })

    test('the line stands in the minors column above Show, 12 px, wrapping in the column; Show keeps its size', async ({
        page
    }) => {
        await openTable(page, 'facedownToll')
        await expect(tollLine(page)).toHaveText(WORDS)
        await expect(adviserChip(page)).toHaveCount(0)
        const look = await lineLook(tollLine(page))
        expect(look).toMatchObject({ tag: 'P', fontSize: '12px', borderWidth: '0px', muted: true })
        // The column beside the majors is about 93 px wide at 375 px: the words wrap to short lines.
        expect(look.lines).toBeGreaterThanOrEqual(2)

        const majors = await box(grid(page).locator('.majors'))
        const line = await box(tollLine(page))
        const show = await box(chips(page).first())
        const panel = await box(grid(page))
        expect(line.x).toBeGreaterThan(majors.x + majors.width)
        expect(line.x).toBeCloseTo(show.x, 0)
        expect(line.y + line.height).toBeLessThanOrEqual(show.y)
        expect(line.x + line.width).toBeLessThanOrEqual(panel.x + panel.width)
        expect(show.height).toBeGreaterThanOrEqual(44)
        // The column stays shorter than the majors, so the panel is no taller than without the line.
        expect(show.y + show.height).toBeLessThanOrEqual(majors.y + majors.height)
    })
})

test.describe('on a phone held sideways', () => {
    test.use({ viewport: { width: 812, height: 375 } })

    test('the line shows inside the panel and the Adviser chip is left out', async ({ page }) => {
        await openTable(page, 'facedownToll')
        await expect(tollLine(page)).toHaveText(WORDS)
        await expect(adviserChip(page)).toHaveCount(0)
        const line = await box(tollLine(page))
        const panel = await box(grid(page))
        expect(line.x).toBeGreaterThanOrEqual(panel.x)
        expect(line.x + line.width).toBeLessThanOrEqual(panel.x + panel.width)
    })
})
