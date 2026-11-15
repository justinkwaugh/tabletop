import { expect, test, type Page } from '@playwright/test'
import type * as TableFixture from '../src/lib/testing/tableFixture.js'

// R-1.7-H1, R-1.9-H1 — game 3 as Continue opens it: game 2's winner the Chancellor, the others
// dealt their boards, said in the History after its start, above the record it carried in.

async function openTable(page: Page, name: TableFixture.TableName) {
    await page.goto('/')
    await page.evaluate(async (name) => {
        const fixture = await import(
            new URL('/src/lib/testing/tableFixture.ts', location.href).href
        )
        return fixture.open(name)
    }, name)
}

const history = (page: Page) => page.locator('.history')

async function noOverflow(page: Page, width: number) {
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width
    )
}

for (const viewport of [
    { width: 1280, height: 900 },
    { width: 375, height: 812 }
]) {
    const phone = viewport.width < 640
    const size = phone ? 'phone' : 'desktop'
    const shot = (page: Page, name: string) =>
        page.screenshot({ path: test.info().outputPath(`chronicle-open-${name}-${size}.png`) })

    test.describe(`a continued game opens, at ${viewport.width} × ${viewport.height}`, () => {
        test.use({ viewport, hasTouch: phone })

        test('the History: the start, then the Chancellor and each board, above the record rows', async ({
            page
        }) => {
            await openTable(page, 'chronicleOpen')
            await page.getByRole('tab', { name: 'History' }).click()
            const rows = history(page).locator('[data-opening-row]')
            // Newest first: the boards in reverse turn order, then the Chancellor. The seat on the
            // clock is Ann's, whose chip reads "You".
            await expect(rows).toHaveText([
                /bea\s*was dealt the yellow board, Exile side up\.$/i,
                /dana\s*was dealt the blue board, Citizen side up\.$/i,
                /you\s*are the Chancellor, as the winner of Age II\.$/i
            ])
            const text = await history(page).innerText()
            const at = (words: string) => text.indexOf(words)
            expect(at('the Chancellor, as the winner')).toBeGreaterThan(-1)
            expect(at('the Chancellor, as the winner')).toBeLessThan(at('The game was started'))
            await expect(page.locator('[data-record-row]')).toHaveCount(2)
            // The rows are system rows: no action, nothing to undo.
            await expect(rows.locator('button')).toHaveCount(0)
            await noOverflow(page, viewport.width)
            await shot(page, 'history')
        })

        test('the Players panel: Dana sits blue as a Citizen, Bea yellow as an Exile', async ({
            page
        }) => {
            await openTable(page, 'chronicleOpen')
            await page.getByRole('tab', { name: 'Players' }).click()
            const seat = (name: string) =>
                page.locator('article.seat').filter({ has: page.getByText(name, { exact: true }) })
            await expect(seat('dana').locator('img.word')).toHaveAttribute('alt', 'citizen')
            await expect(seat('bea').locator('img.word')).toHaveAttribute('alt', 'exile')
            await expect(seat('ann').locator('img.word')).toHaveAttribute('alt', 'chancellor')
            await noOverflow(page, viewport.width)
            await shot(page, 'players')
        })

        test('the setup panel waits on the Chancellor, as in a first game', async ({ page }) => {
            await openTable(page, 'chronicleOpen')
            await expect(page.getByText('Keep one.', { exact: true })).toBeVisible()
            await noOverflow(page, viewport.width)
            await shot(page, 'setup')
        })
    })
}
