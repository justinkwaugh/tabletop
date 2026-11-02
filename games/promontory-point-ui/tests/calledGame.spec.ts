import { expect, test, type Page } from '@playwright/test'
import { WIDTHS, failOnPageErrors, history, openTable, settled } from './support/table.js'

// docs/player-votes.md, "Called games and UI Artifacts": a called or conceded game shows the
// shared ending in place of the score, and history shows the call; the dev harness's Scenarios
// menu copies the open game ended by a call.
test.describe.configure({ mode: 'parallel' })
failOnPageErrors()

const ending = (page: Page) => page.locator('[data-called-ending]')
const score = (page: Page) => page.locator('[data-score]')
const turnTab = (page: Page) => page.locator('[data-turn-tab]')
const turnInfo = (page: Page) => page.locator('[data-turn-info]')

// Picks a Scenarios entry that copies the open game ended by a call, and waits for the copy.
async function endByCall(page: Page, entry: string | RegExp): Promise<void> {
    await page.evaluate(() => {
        Object.assign(window, { promontoryPointEarlierSession: window.promontoryPointTableSession })
    })
    await page.getByRole('button', { name: 'Scenarios', exact: true }).click()
    await page.getByRole('button', { name: entry }).click()
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    window.promontoryPointTableSession !==
                    Reflect.get(window, 'promontoryPointEarlierSession')
            )
        )
        .toBe(true)
    await expect(page.locator('svg.board')).toBeVisible()
    await settled(page)
}

// A fresh two-seat game from the harness's New game form, with the session in reach of specs.
async function openTwoSeatGame(page: Page): Promise<void> {
    await page.route('**/model/sessionContext.svelte.ts*', async (route) => {
        const response = await route.fetch()
        const body = await response.text()
        await route.fulfill({
            response,
            body: body.replace(
                'return getContext();',
                'return window.promontoryPointTableSession = getContext();'
            )
        })
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'New game', exact: true }).click()
    await page.getByPlaceholder('choose a name for your game').fill('Concession')
    await page.getByText('2', { exact: true }).click()
    const names = page.getByPlaceholder('player name')
    await expect(names).toHaveCount(2)
    // The first seat is the harness's host, Developer.
    await names.nth(1).fill('Royce')
    await page.getByRole('button', { name: 'Create Game', exact: true }).click()
    await expect(page.locator('svg.board')).toBeVisible()
    await expect.poll(() => page.evaluate(() => !!window.promontoryPointTableSession)).toBe(true)
    await settled(page)
}

for (const width of WIDTHS) {
    test.describe(width.name, () => {
        test.use(width.use)

        test('a call with a declared winner: the shared ending names the winner, no final score, and history shows the call', async ({
            page
        }) => {
            await openTable(page, 'Pieces placed')
            await endByCall(page, 'Copy called, Mara wins')

            await expect(turnTab(page)).toHaveText('End of game')
            await expect(turnInfo(page)).toHaveText('The game was called; Mara wins')
            await expect(ending(page)).toContainText('The game was called.')
            await expect(ending(page)).toContainText('Mara wins.')
            await expect(score(page)).toHaveCount(0)

            const log = await history(page)
            await expect(log.locator('[data-history-call]')).toHaveText(
                'The game was called; Mara wins.'
            )
            await expect(log.locator('[aria-label="Final totals"]')).toHaveCount(0)
            await expect(log.locator('.in-progress')).toHaveCount(0)
        })

        test('a call with no winner: abandoned, no final score, and history shows the call', async ({
            page
        }) => {
            await openTable(page, 'Pieces placed')
            await endByCall(page, 'Copy called, no winner')

            await expect(turnTab(page)).toHaveText('End of game')
            await expect(ending(page)).toContainText('The game was called with no winner.')
            await expect(ending(page)).not.toContainText('wins')
            await expect(score(page)).toHaveCount(0)

            const log = await history(page)
            await expect(log.locator('[data-history-call]')).toHaveText(
                'The game was called with no winner.'
            )
            await expect(log.locator('[aria-label="Final totals"]')).toHaveCount(0)
        })

        test('a two-seat concession: the other seat wins, with no final score', async ({
            page
        }) => {
            await openTwoSeatGame(page)
            await endByCall(page, 'Copy with Royce conceding')

            await expect(turnTab(page)).toHaveText('End of game')
            await expect(turnInfo(page)).toHaveText('Royce conceded; Developer wins')
            await expect(ending(page)).toContainText('Royce conceded.')
            await expect(ending(page)).toContainText('Developer wins.')
            await expect(score(page)).toHaveCount(0)

            const log = await history(page)
            await expect(log.locator('[data-history-call]')).toHaveText(
                'Royce conceded; Developer wins.'
            )
        })
    })
}
