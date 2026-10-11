import { expect, test } from '@playwright/test'
import { createGame, deployBothArmies, failOnPageErrors, pickUp, tap } from './table.js'

failOnPageErrors()

test('a move in the history is replayed beside the game, which stays where it stands', async ({
    page
}) => {
    await createGame(page)
    await deployBothArmies(page)
    await pickUp(page, 'langeron')
    const approach = page.locator('[aria-label="Block this approach"]')
    await expect(approach.first()).toBeAttached()
    await tap(page, '[aria-label="Block this approach"]')

    await page.getByRole('tab', { name: 'History' }).click()
    const move = page.getByRole('button', { name: /^Langeron’s corps moves from Pratze Berg to/ })
    const replay = page.getByRole('dialog', { name: 'A move from the history' })
    const turn = page.locator('.nt-masthead-turn')
    await move.click()
    await expect(replay).toBeVisible()
    await expect(replay.getByRole('heading')).toHaveText(
        /^Langeron’s corps moves from Pratze Berg to the approach at Pratze Berg facing /
    )
    await expect(replay.locator('.nt-replay-left > g')).toHaveCount(5)
    await expect(replay.locator('.nt-replay-way')).toBeVisible()
    await expect(replay.locator('.nt-replay-held rect').first()).toBeAttached()
    await expect(replay.locator('svg text', { hasText: 'Langeron' })).toHaveCount(1)
    await expect(turn).toHaveText('Allies’ turn')

    await replay.getByRole('button', { name: 'Close' }).click()
    await expect(replay).toBeHidden()
    await expect(turn).toHaveText('Allies’ turn')

    await move.click()
    await expect(replay).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(replay).toBeHidden()

    await move.click()
    await replay.getByRole('button', { name: 'See the whole game at this point' }).click()
    await expect(replay).toBeHidden()
    await expect(turn).toHaveText('History')
})

test('a history entry that is not a move is visited in History View', async ({ page }) => {
    await createGame(page)
    await deployBothArmies(page)
    await page.getByRole('tab', { name: 'History' }).click()
    await page.getByRole('button', { name: 'The French deploy their army.' }).click()
    await expect(page.locator('.nt-masthead-turn')).toHaveText('History')
    await expect(page.getByRole('dialog', { name: 'A move from the history' })).toBeHidden()
})

test('an attack is one history entry, and its retreat and the move in are replayed', async ({
    page
}) => {
    await createGame(page)
    await deployBothArmies(page)
    await pickUp(page, 'langeron')
    await tap(page, '[aria-label="Move to locale 94"]')
    await page.getByRole('button', { name: 'End turn' }).click()
    await pickUp(page, 'st-hilaire')
    await tap(page, '[aria-label="Threaten an attack across this approach"]')
    await page.getByRole('button', { name: 'Retreat before combat' }).click()
    await page.getByRole('button', { name: 'Retreat', exact: true }).click()
    await page.getByRole('button', { name: 'Move into the locale' }).click()

    await page.getByRole('tab', { name: 'History' }).click()
    await expect(
        page.getByRole('button', { name: /^The French threaten an attack on locale 94/ })
    ).toBeVisible()
    await expect(page.locator('.nt-history-step')).toHaveCount(2)

    const replay = page.getByRole('dialog', { name: 'A move from the history' })
    await page.getByRole('button', { name: /^The Allies retreat from locale 94/ }).click()
    await expect(replay).toBeVisible()
    await expect(replay.locator('.nt-replay-left > g').first()).toBeAttached()
    await expect(replay.locator('.nt-replay-way').first()).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(replay).toBeHidden()

    await page.getByRole('button', { name: /^The French move into the abandoned locale/ }).click()
    await expect(replay).toBeVisible()
    await expect(replay.locator('.nt-replay-way')).toHaveCount(1)
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: /^Langeron’s corps moves from/ }).dblclick()
    await expect(replay).toBeVisible()
    await expect(page.locator('.nt-masthead-turn')).toHaveText('French turn')
})
