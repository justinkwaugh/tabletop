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
const line = (page: Page) => panel(page).locator('.question-line')
const cageCard = (page: Page) =>
    panel(page)
        .locator('button[aria-pressed]')
        .filter({ has: page.getByRole('img', { name: 'Obsidian Cage', exact: true }) })
const piece = (page: Page, count: number, seat: string) =>
    panel(page).getByRole('button', {
        name: `${count} of the warbands to ${seat}'s board`,
        exact: true
    })
const returnThem = (page: Page) =>
    panel(page).getByRole('button', { name: 'Return them', exact: true })
const history = (page: Page) => page.locator('.history')

const SIZES = [
    { name: 'desktop', viewport: { width: 1280, height: 900 }, phone: false },
    { name: 'phone', viewport: { width: 375, height: 812 }, phone: true }
]

/**
 * R-10.13-H1 — Fae Merchant sends the Obsidian Cage down: its 2 Imperial warbands go back to the
 * Imperial boards Dana picks, in the Cage Action's rows, then "Return them".
 */
for (const { name, viewport, phone } of SIZES) {
    test.describe(`Fae Merchant sends the Obsidian Cage down, on a ${name}`, () => {
        test.use({ viewport })

        test('the Cage opens the second step: a row per Imperial board, none placed, "Return them" disabled', async ({
            page
        }) => {
            await openTable(page, 'askFaeMerchantCage')
            await expect.poll(async () => (await call(page, 'tableFacts')).seatId).toBe('dana')
            await expect(line(page)).toHaveText('Which relic goes to the bottom?')
            await cageCard(page).click()
            await expect(line(page)).toHaveText('Obsidian Cage: where do its 2 purple warbands go?')
            await expect(panel(page)).toContainText(/to\s*ann's\s*board/i)
            await expect(panel(page)).toContainText(/to\s*rhys's\s*board/i)
            for (const seat of ['ann', 'rhys']) {
                for (const count of [1, 2]) {
                    await expect(piece(page, count, seat)).toHaveAttribute('aria-pressed', 'false')
                    await expect(piece(page, count, seat)).toBeEnabled()
                }
            }
            await expect(returnThem(page)).toBeDisabled()
            await expect(cageCard(page)).toHaveCount(0)
        })

        test('1 on Ann’s row fills Rhys’s with the other 1; "Return them" sends them to both boards', async ({
            page
        }) => {
            await openTable(page, 'askFaeMerchantCage')
            await cageCard(page).click()
            await piece(page, 1, 'ann').click()
            await expect(piece(page, 1, 'ann')).toHaveAttribute('aria-pressed', 'true')
            await expect(piece(page, 2, 'ann')).toHaveAttribute('aria-pressed', 'false')
            await expect(piece(page, 1, 'rhys')).toHaveAttribute('aria-pressed', 'true')
            await expect(piece(page, 2, 'rhys')).toHaveAttribute('aria-pressed', 'false')
            const button = returnThem(page)
            await expect(button).toBeEnabled()
            const [box, form] = [
                await boxOf(page, button),
                await boxOf(page, panel(page).locator('.question-form'))
            ]
            if (phone) expect(box.height).toBeGreaterThanOrEqual(44)
            // Label-sized: the button fits its words, at every width.
            expect(box.width).toBeLessThan(form.width / 2)
            await button.click()
            await expect
                .poll(async () => (await call(page, 'tableFacts')).boardOf.ann)
                .toEqual({ imperial: 3 })
            const facts = await call(page, 'tableFacts')
            expect(facts.boardOf.rhys).toEqual({ imperial: 1 })
            if (!phone) {
                await page.getByRole('tab', { name: 'History' }).click()
                await expect(history(page)).toContainText(
                    /put Obsidian Cage on the bottom of the relic deck; its warbands went back: 1 to\s*ann's\s*board, 1 to\s*rhys's\s*board/i
                )
            }
        })

        test('2 on either row puts both there', async ({ page }) => {
            await openTable(page, 'askFaeMerchantCage')
            await cageCard(page).click()
            await piece(page, 2, 'rhys').click()
            await expect(piece(page, 1, 'ann')).toHaveAttribute('aria-pressed', 'false')
            await expect(piece(page, 2, 'rhys')).toHaveAttribute('aria-pressed', 'true')
            await returnThem(page).click()
            await expect
                .poll(async () => (await call(page, 'tableFacts')).boardOf.rhys)
                .toEqual({ imperial: 2 })
            expect((await call(page, 'tableFacts')).boardOf.ann).toEqual({ imperial: 2 })
        })

        test('three Imperial boards: no row fills another, and "Return them" waits until both are placed', async ({
            page
        }) => {
            await openTable(page, 'askFaeMerchantCageThree')
            await cageCard(page).click()
            await expect(panel(page)).toContainText(/to\s*bea's\s*board/i)
            await piece(page, 1, 'ann').click()
            await expect(piece(page, 1, 'rhys')).toHaveAttribute('aria-pressed', 'false')
            await expect(piece(page, 1, 'bea')).toHaveAttribute('aria-pressed', 'false')
            await expect(piece(page, 2, 'bea')).toBeDisabled()
            await expect(returnThem(page)).toBeDisabled()
            await piece(page, 1, 'bea').click()
            await expect(returnThem(page)).toBeEnabled()
            await returnThem(page).click()
            await expect
                .poll(async () => (await call(page, 'tableFacts')).boardOf.bea)
                .toEqual({ imperial: 1 })
            expect((await call(page, 'tableFacts')).boardOf.ann).toEqual({ imperial: 3 })
        })
    })
}
