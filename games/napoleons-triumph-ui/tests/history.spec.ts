import { expect, test } from '@playwright/test'
import {
    createGame,
    deployBothArmies,
    failOnPageErrors,
    pickUp,
    tap,
    retreat,
    threatenWithoutTheGuard,
    ST_HILAIRE_LOCALE,
    LOCALE_94
} from './table.js'

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
    const replay = page.getByRole('dialog', { name: 'An action from the history' })
    const turn = page.locator('.nt-masthead-turn')
    await move.click()
    await expect(replay).toBeVisible()
    await expect(replay.getByRole('heading')).toHaveText(
        /^Langeron’s corps moves from Pratze Berg to the approach at Pratze Berg facing /
    )
    await expect(replay.locator('.nt-replay-left > g')).toHaveCount(5)
    await expect(replay.locator('.nt-way-arrow')).toBeVisible()
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

test('a history entry that moved nothing is pictured too, and the game stays where it stands', async ({
    page
}) => {
    await createGame(page)
    await deployBothArmies(page)
    await page.getByRole('tab', { name: 'History' }).click()
    await page.getByRole('button', { name: 'The French deploy their army.' }).click()
    const replay = page.getByRole('dialog', { name: 'An action from the history' })
    await expect(replay).toBeVisible()
    await expect(replay.locator('.nt-way-arrow')).toHaveCount(0)
    await expect(page.locator('.nt-masthead-turn')).toHaveText('Allies’ turn')
})

test('a feint curls the attack’s arrow back, on the map while it is answered and in its picture afterwards', async ({
    page
}) => {
    await createGame(page)
    await deployBothArmies(page)
    await pickUp(page, 'langeron')
    await tap(page, '[aria-label="Move to locale 94"]')
    await page.getByRole('button', { name: 'End turn' }).click()
    await pickUp(page, 'st-hilaire')
    await threatenWithoutTheGuard(page, ST_HILAIRE_LOCALE, LOCALE_94)
    const onTheMap = page.locator('svg[data-board] [data-attack-arrow]')
    await expect(onTheMap).toHaveAttribute('data-attack-arrow', 'threat')
    await tap(page, 'svg [aria-label="Choose this unit"]')
    await page.getByRole('button', { name: /^Defend/ }).click()
    await page.getByRole('button', { name: 'Call it a feint' }).click()
    await page.getByRole('button', { name: 'Feint, staying in reserve' }).click()
    await expect(onTheMap).toHaveAttribute('data-attack-arrow', 'feint')
    await page.getByRole('button', { name: 'Advance to the approach' }).click()
    await expect(onTheMap).toHaveCount(0)

    await page.getByRole('tab', { name: 'History' }).click()
    const replay = page.getByRole('dialog', { name: 'An action from the history' })
    const pictured = replay.locator('[data-attack-arrow]')
    await page.getByRole('button', { name: /is a feint, ending in reserve/ }).click()
    await expect(pictured).toHaveAttribute('data-attack-arrow', 'feint')
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: /^The French threaten an attack on locale 94/ }).click()
    await expect(pictured).toHaveAttribute('data-attack-arrow', 'threat')
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: /^The Allies stand with a unit/ }).click()
    await expect(pictured).toHaveAttribute('data-attack-arrow', 'threat')
    await expect(page.locator('.nt-masthead-turn')).toHaveText('French turn')
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
    await threatenWithoutTheGuard(page, ST_HILAIRE_LOCALE, LOCALE_94)
    await page.getByRole('button', { name: 'Retreat before combat' }).click()
    await retreat(page)
    await page.getByRole('button', { name: 'Move into the locale' }).click()

    await page.getByRole('tab', { name: 'History' }).click()
    await expect(
        page.getByRole('button', { name: /^The French threaten an attack on locale 94/ })
    ).toBeVisible()
    await expect(page.locator('.nt-history-step')).toHaveCount(2)

    const replay = page.getByRole('dialog', { name: 'An action from the history' })
    await page.getByRole('button', { name: /^The Allies retreat from locale 94/ }).click()
    await expect(replay).toBeVisible()
    await expect(replay.locator('.nt-replay-left > g').first()).toBeAttached()
    await expect(replay.locator('.nt-way-arrow').first()).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(replay).toBeHidden()

    await page.getByRole('button', { name: /^The French move into the abandoned locale/ }).click()
    await expect(replay).toBeVisible()
    await expect(replay.locator('.nt-way-arrow')).toHaveCount(1)
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: /^Langeron’s corps moves from/ }).dblclick()
    await expect(replay).toBeVisible()
    await expect(page.locator('.nt-masthead-turn')).toHaveText('French turn')
})

test('the picture of a history line steps to the line before and the line after', async ({
    page
}) => {
    await createGame(page)
    await deployBothArmies(page)
    await pickUp(page, 'langeron')
    await tap(page, '[aria-label="Move to locale 94"]')
    await page.getByRole('button', { name: 'End turn' }).click()
    await pickUp(page, 'st-hilaire')
    await threatenWithoutTheGuard(page, ST_HILAIRE_LOCALE, LOCALE_94)
    await page.getByRole('button', { name: 'Retreat before combat' }).click()
    await retreat(page)
    await page.getByRole('button', { name: 'Move into the locale' }).click()

    await page.getByRole('tab', { name: 'History' }).click()
    const replay = page.getByRole('dialog', { name: 'An action from the history' })
    const heading = replay.getByRole('heading')
    const before = replay.getByRole('button', { name: 'The action before' })
    const after = replay.getByRole('button', { name: 'The action after' })
    await page.getByRole('button', { name: /^Langeron’s corps moves from/ }).click()
    await expect(replay.locator('[data-attack-arrow]')).toHaveCount(0)

    await after.click()
    await expect(heading).toHaveText(/^The French threaten an attack on locale 94/)
    await expect(replay.locator('[data-attack-arrow]')).toHaveCount(1)
    await after.click()
    await expect(heading).toHaveText(/^The Allies retreat from locale 94/)
    await after.click()
    await expect(heading).toHaveText(/^The French move into the abandoned locale/)
    await expect(replay.locator('[data-attack-arrow]')).toHaveCount(0)
    await expect(after).toBeDisabled()

    await page.keyboard.press('ArrowLeft')
    await expect(heading).toHaveText(/^The Allies retreat from locale 94/)
    await page.keyboard.press('ArrowRight')
    await expect(heading).toHaveText(/^The French move into the abandoned locale/)

    for (const earlier of [
        /^The Allies retreat/,
        /^The French threaten/,
        /^Langeron’s corps moves/,
        /^The French deploy their army/,
        /^The Allies deploy their army/
    ]) {
        await before.click()
        await expect(heading).toHaveText(earlier)
    }
    await expect(before).toBeDisabled()
    await expect(page.locator('.nt-masthead-turn')).toHaveText('French turn')
})
