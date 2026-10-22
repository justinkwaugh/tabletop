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

const panel = (page: Page) => page.locator('.panel')
/** The losses' rows: a label, then its pieces, in one grid. */
const rowGrid = (page: Page) =>
    panel(page)
        .locator('div.grid')
        .filter({ has: page.getByRole('button', { name: /^1 of the / }) })
const labels = (page: Page) => rowGrid(page).locator(':scope > span:nth-child(odd)')
const HOSPITAL_LINE =
    "Ann's warbands chosen here are set aside at Hospital and go to its site at the Campaign's end."

const SIZES = [
    { name: 'desktop', viewport: { width: 1280, height: 900 } },
    { name: 'phone', viewport: { width: 375, height: 812 } }
]

/**
 * R-5.5.6.a — Dana beat Ann (the Chancellor) at the Plains; Ann chooses 3 of the defence: 2 at the
 * Plains, 2 on Ann's board, 2 on Rhys's board (a Citizen ally).
 */
for (const size of SIZES) {
    test.describe(`the defence's losses, ${size.name}`, () => {
        test.use({ viewport: size.viewport })

        test("every row starts with the player's chip, one row per place, never merged", async ({
            page
        }) => {
            expect((await openTable(page, 'battleLossRows')).seatId).toBe('Ann')
            await expect(panel(page)).toContainText('Pick 3 to kill.')
            await expect(labels(page)).toHaveText([
                /^\s*Ann\s+on your board\s*$/,
                /^\s*Ann\s+at Plains\s*$/,
                /^\s*Rhys\s+on Rhys's board\s*$/
            ])
            const chips = labels(page).locator(':scope > span.rounded')
            await expect(chips).toHaveText(['Ann', 'Ann', 'Rhys'])
            const background = (index: number) =>
                chips.nth(index).evaluate((chip) => getComputedStyle(chip).backgroundColor)
            // Ann's chip in Ann's colour, as the battle's own line draws Ann ("You" to Ann).
            const you = page.locator('.campaign-dice span.rounded').nth(1)
            await expect(you).toHaveText(/you/i)
            const annColour = await you.evaluate((chip) => getComputedStyle(chip).backgroundColor)
            expect(await background(0)).toBe(annColour)
            expect(await background(1)).toBe(annColour)
            expect(await background(2)).not.toBe(annColour)
            for (const where of ['on your board', 'at Plains', "on Rhys's board"]) {
                await expect(
                    rowGrid(page).getByRole('button', {
                        name: `2 of the warbands ${where}`,
                        exact: true
                    })
                ).toBeVisible()
            }
            await expect(panel(page)).not.toContainText('Hospital')
            expect(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
            ).toBe(true)
        })

        test("Ann's Hospital: one line under the rows, Hospital in bold, above the count", async ({
            page
        }) => {
            await openTable(page, 'battleLossHospital')
            const line = panel(page).getByText(HOSPITAL_LINE, { exact: true })
            await expect(line).toHaveCount(1)
            await expect(line).toBeVisible()
            const name = line.getByText('Hospital', { exact: true })
            expect(
                Number(await name.evaluate((b) => getComputedStyle(b).fontWeight))
            ).toBeGreaterThanOrEqual(600)
            const lastRow = await labels(page).last().boundingBox()
            const box = await line.boundingBox()
            const count = await panel(page)
                .getByText('Chosen 0 of 3', { exact: true })
                .boundingBox()
            if (!lastRow || !box || !count) throw Error('The step is not drawn')
            expect(box.y).toBeGreaterThan(lastRow.y + lastRow.height - 1)
            expect(count.y).toBeGreaterThan(box.y + box.height - 1)
            expect(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
            ).toBe(true)
        })
    })
}

test('a one-player defence keeps its chip on every row', async ({ page }) => {
    await openTable(page, 'exileDefeated')
    await expect(labels(page)).toHaveCount(2)
    for (const label of await labels(page).all()) {
        await expect(label.locator(':scope > span.rounded')).toHaveText('def')
    }
})
