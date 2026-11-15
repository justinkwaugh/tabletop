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

async function boxOf(locator: Locator) {
    const box = await locator.boundingBox()
    if (!box) throw Error('The element is not drawn')
    return box
}

/** Its size as laid out, before the panel is scaled to fit the screen. */
const layoutSizeOf = async (locator: Locator) => {
    const size = await locator.evaluate((element) =>
        element instanceof HTMLElement
            ? { width: element.offsetWidth, height: element.offsetHeight }
            : undefined
    )
    if (!size) throw Error('The element is not laid out')
    return size
}

const panel = (page: Page) => page.locator('.panel')
const stepCount = (page: Page) => panel(page).getByText(/^\d of \d$/)
const relicRow = (page: Page, name: string) =>
    panel(page)
        .getByRole('list', { name: 'Relics taken' })
        .getByRole('listitem')
        .filter({ hasText: name })
const option = (page: Page, relic: string, name: string) =>
    relicRow(page, relic).getByRole('button', { name, exact: true })
const question = (page: Page) =>
    panel(page).getByText(/^Obsidian Cage: where do its 2 purple warbands go\?$/)
const piece = (page: Page, count: number, seat: string) =>
    panel(page).getByRole('button', {
        name: `${count} of the warbands to ${seat}'s board`,
        exact: true
    })
const pieces = (page: Page) => panel(page).getByRole('button', { name: /of the warbands to/ })
const next = (page: Page) => panel(page).getByRole('button', { name: 'Next', exact: true })
const takeSpoils = (page: Page) =>
    panel(page).getByRole('button', { name: 'Take spoils', exact: true })
const undo = (page: Page) => page.getByRole('button', { name: 'Undo', exact: true })
const history = (page: Page) => page.locator('.history')

const SIZES = [
    { name: 'desktop', viewport: { width: 1280, height: 900 }, phone: false },
    { name: 'phone', viewport: { width: 375, height: 812 }, phone: true }
]

async function shot(page: Page, name: string, phone: boolean) {
    await page.mouse.move(2, 2)
    await panel(page).screenshot({
        path: test.info().outputPath(`${name}-${phone ? 'phone' : 'desktop'}.png`)
    })
}

/** The Steppe's warband as it comes, then the Cup kept and the Cage sent down. */
async function toRelics(page: Page) {
    await openTable(page, 'spoilsRelicHunterCage')
    await expect(stepCount(page)).toHaveText('1 of 2')
    await next(page).click()
    await expect(stepCount(page)).toHaveText('2 of 2')
    await option(page, 'Cup of Plenty', 'Keep it').click()
    await option(page, 'Obsidian Cage', 'Bottom of the relic deck').click()
}

for (const { name, viewport, phone } of SIZES) {
    /**
     * R-10.13-H1 — Relic Hunter sends Bea's Obsidian Cage down holding 2 of the Empire's warbands,
     * with two Imperial boards (Ann, the Chancellor, and Rhys, a Citizen): Dana places them in a step
     * of its own after "Relics taken".
     */
    test.describe(`Relic Hunter sends the Obsidian Cage down, on a ${name}`, () => {
        test.use({ viewport, hasTouch: phone })

        test('"Bottom of the relic deck" adds a step: "Next", then the question alone, a row per Imperial board, none placed', async ({
            page
        }) => {
            await toRelics(page)
            await expect(stepCount(page)).toHaveText('2 of 3')
            await expect(takeSpoils(page)).toHaveCount(0)
            await next(page).click()
            await expect(stepCount(page)).toHaveText('3 of 3')
            await expect(question(page)).toBeVisible()
            await expect(panel(page).getByRole('list', { name: 'Relics taken' })).toHaveCount(0)
            await expect(panel(page)).toContainText(/to\s*ann's\s*board/i)
            await expect(panel(page)).toContainText(/to\s*rhys's\s*board/i)
            await expect(pieces(page)).toHaveCount(4)
            for (const seat of ['ann', 'rhys']) {
                for (const count of [1, 2])
                    await expect(piece(page, count, seat)).toHaveAttribute('aria-pressed', 'false')
            }
            await expect(takeSpoils(page)).toHaveCount(0)
            if (phone) {
                for (const box of await Promise.all((await pieces(page).all()).map(boxOf))) {
                    expect(box.height).toBeGreaterThanOrEqual(43.5)
                }
            }
            expect(
                await page.evaluate(() => document.documentElement.scrollWidth)
            ).toBeLessThanOrEqual(viewport.width)
            await shot(page, 'relic-hunter-cage-empty', phone)
        })

        test('1 on Ann’s row fills Rhys’s; "Take spoils" then shows, label-sized, and sends them to both boards', async ({
            page
        }) => {
            await toRelics(page)
            await next(page).click()
            await piece(page, 1, 'ann').click()
            await expect(piece(page, 1, 'ann')).toHaveAttribute('aria-pressed', 'true')
            await expect(piece(page, 2, 'ann')).toHaveAttribute('aria-pressed', 'false')
            await expect(piece(page, 1, 'rhys')).toHaveAttribute('aria-pressed', 'true')
            await expect(piece(page, 2, 'rhys')).toHaveAttribute('aria-pressed', 'false')
            await expect(takeSpoils(page)).toBeVisible()
            const button = await layoutSizeOf(takeSpoils(page))
            expect(button.width).toBeLessThan((await layoutSizeOf(panel(page))).width / 2)
            if (phone) expect((await boxOf(takeSpoils(page))).height).toBeGreaterThanOrEqual(43.5)
            await shot(page, 'relic-hunter-cage-placed', phone)
            await takeSpoils(page).click()
            await expect
                .poll(async () => (await call(page, 'tableFacts')).campaignUnderway)
                .toBe(false)
            const facts = await call(page, 'tableFacts')
            expect(facts.boardOf.ann).toEqual({ imperial: 4 })
            expect(facts.boardOf.rhys).toEqual({ imperial: 2 })
            expect(facts.relicsOf.bea).toEqual([])
            expect(facts.relicsOf.dana).toEqual(['relic.cup-of-plenty'])
            if (!phone) {
                await page.getByRole('tab', { name: 'History' }).click()
                await expect(history(page)).toContainText(
                    /put Obsidian Cage from\s*bea\s*on the bottom of the relic deck \(Relic Hunter\); its warbands went back: 1 to\s*ann's\s*board, 1 to\s*rhys's\s*board/i
                )
            }
        })

        test('Undo walks back through the step to "Relics taken"; "Keep it" there drops the step', async ({
            page
        }) => {
            await toRelics(page)
            await next(page).click()
            await piece(page, 2, 'rhys').click()
            await expect(takeSpoils(page)).toBeVisible()
            await undo(page).click()
            await expect(stepCount(page)).toHaveText('3 of 3')
            await expect(piece(page, 2, 'rhys')).toHaveAttribute('aria-pressed', 'false')
            await expect(takeSpoils(page)).toHaveCount(0)
            await undo(page).click()
            await expect(stepCount(page)).toHaveText('2 of 3')
            await expect(option(page, 'Obsidian Cage', 'Bottom of the relic deck')).toHaveAttribute(
                'aria-pressed',
                'true'
            )
            await option(page, 'Obsidian Cage', 'Keep it').click()
            await expect(stepCount(page)).toHaveText('2 of 2')
            await expect(next(page)).toHaveCount(0)
            await takeSpoils(page).click()
            await expect
                .poll(async () => (await call(page, 'tableFacts')).campaignUnderway)
                .toBe(false)
            const facts = await call(page, 'tableFacts')
            expect(facts.relicsOf.dana).toEqual(['relic.cup-of-plenty', 'relic.obsidian-cage'])
            expect(facts.boardOf.rhys).toEqual({ imperial: 1 })
        })
    })
}
