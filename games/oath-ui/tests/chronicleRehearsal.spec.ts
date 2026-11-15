import { expect, test, type Page } from '@playwright/test'
import type * as TableFixture from '../src/lib/testing/tableFixture.js'

// The chronicle rehearsal's real states on screen: "The long table" at Dana's win, game 2 as
// Continue opens it with Bea joining, Dana's first Search, and game 3 continued from a pinned
// finished game with an edifice and a ruin on its map.

async function openTable(page: Page, name: TableFixture.TableName) {
    await page.goto('/')
    await page.evaluate(async (name) => {
        const fixture = await import(
            new URL('/src/lib/testing/tableFixture.ts', location.href).href
        )
        return fixture.open(name)
    }, name)
}

const panel = (page: Page) => page.locator('.panel')
const history = (page: Page) => page.locator('.history')

async function openTab(page: Page, name: string) {
    await page.getByRole('tab', { name }).click()
}

async function noOverflow(page: Page, width: number) {
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width
    )
}

/** On a phone every shown button in the panel is 44 px tall. */
async function phoneButtons(page: Page) {
    const heights = await panel(page)
        .locator('button:visible:not(.magnifier)')
        .evaluateAll((buttons) => buttons.map((b) => Math.round(b.getBoundingClientRect().height)))
    for (const height of heights) expect(height).toBeGreaterThanOrEqual(44)
}

for (const viewport of [
    { width: 1280, height: 900 },
    { width: 375, height: 812 }
]) {
    const phone = viewport.width < 640
    const size = phone ? 'phone' : 'desktop'
    const shot = (page: Page, name: string) =>
        page.screenshot({ path: test.info().outputPath(`rehearsal-${name}-${size}.png`) })

    test.describe(`the rehearsal, at ${viewport.width} × ${viewport.height}`, () => {
        test.use({ viewport, hasTouch: phone })

        test('game 1 at its result: Dana’s win, and the story in the History', async ({ page }) => {
            await openTable(page, 'rehearsalResult')
            await expect(page.getByText('The game is over')).toBeVisible()
            await expect(page.getByText(/Dana\s+won/).first()).toBeVisible()
            await noOverflow(page, viewport.width)
            await shot(page, 'result')
            await openTab(page, 'History')
            await expect(history(page)).toContainText('wrote the story of Age I.')
            await noOverflow(page, viewport.width)
            await shot(page, 'result-history')
        })

        test('game 2 opens: the record row, the Chancellor, a kept or dealt row per seat, the seats in their colours', async ({
            page
        }) => {
            await openTable(page, 'rehearsalOpen')
            await openTab(page, 'History')
            const rows = history(page).locator('[data-opening-row]')
            // Newest first: the boards in reverse turn order, then the Chancellor. The seat on the
            // clock is Dana's, whose chip reads "You".
            await expect(rows).toHaveText([
                /Bea\s*was dealt the black board, Exile side up\.$/,
                /Rhys\s*kept the red board, Exile side up\.$/,
                /Ann\s*kept the white board, Exile side up\.$/,
                /you\s*are the Chancellor, as the winner of Age I\.$/i
            ])
            await expect(page.locator('[data-record-row]')).toHaveCount(1)
            await expect(rows.locator('button')).toHaveCount(0)
            await noOverflow(page, viewport.width)
            await shot(page, 'open-history')

            await openTab(page, 'Players')
            const seat = (name: string) =>
                page.locator('article.seat').filter({ has: page.getByText(name, { exact: true }) })
            for (const name of ['Ann', 'Rhys', 'Bea'])
                await expect(seat(name).locator('img.word')).toHaveAttribute('alt', 'exile')
            await noOverflow(page, viewport.width)
            await shot(page, 'open-players')
        })

        test('game 2’s Chronicle tab: game 1’s entry and its story', async ({ page }) => {
            await openTable(page, 'rehearsalOpen')
            await openTab(page, 'Chronicle')
            const entries = page.locator('.chronicle-tab article')
            await expect(entries).toHaveCount(1)
            await expect(entries.first()).toContainText('Age I · The long table')
            await expect(entries.first()).toContainText('Dana held the Cradle.')
            await expect(entries.first().locator('[data-record-chip="purple"]').first()).toHaveText(
                'Dana'
            )
            await noOverflow(page, viewport.width)
            await shot(page, 'open-chronicle')
        })

        test('game 2 at Dana’s Search: the panel shows the drawn card', async ({ page }) => {
            await openTable(page, 'rehearsalSearch')
            await expect(panel(page).locator('img[alt="Conspiracy"]').first()).toBeVisible()
            await noOverflow(page, viewport.width)
            if (phone) await phoneButtons(page)
            await shot(page, 'search')
        })

        test('game 3 from the pinned game: Dana the Chancellor; Bea dealt white; Ann and Rhys keep theirs', async ({
            page
        }) => {
            await openTable(page, 'rehearsalPinnedOpen')
            await openTab(page, 'History')
            await expect(history(page).locator('[data-opening-row]')).toHaveText([
                /Rhys\s*kept the red board, Exile side up\.$/,
                /Ann\s*kept the yellow board, Exile side up\.$/,
                /Bea\s*was dealt the white board, Exile side up\.$/,
                /you\s*are the Chancellor, as the winner of Age I\.$/i
            ])
            await noOverflow(page, viewport.width)
            await shot(page, 'pinned-history')
            await expect(page.getByText('Keep one.', { exact: true })).toBeVisible()
            if (phone) await phoneButtons(page)
            await shot(page, 'pinned-setup')
        })
    })
}
