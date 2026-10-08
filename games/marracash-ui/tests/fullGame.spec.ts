import { expect, test, type Locator, type Page } from '@playwright/test'
import { actionPanel, auctionableShops, board, createGame, destinationFountains } from './helpers'

function selectableFountains(page: Page): Locator {
    return page.locator('g[role=button][aria-label^="Fountain"]')
}

async function pick(page: Page, locator: Locator, step: number) {
    const count = await locator.count()
    expect(count, `nothing to choose: ${await actionPanel(page).innerText()}`).toBeGreaterThan(0)
    await locator.nth(step % count).click()
}

// Animations are short under reduced motion; each has its own focused test
const MoveAnimationTimeout = 5_000

// Takes one step of whatever the action panel offers, rotating choices so play varies
async function takeStep(page: Page, step: number) {
    const panel = actionPanel(page)
    const place = page.getByRole('button', { name: 'Place bid' })
    // A panel left over from the previous state keeps its buttons disabled while the board animates
    const front = page.getByRole('button', { name: 'Front of queue', disabled: false })
    const pass = page.getByRole('button', { name: 'Pass' })
    const gameOver = page.getByText('The game is over.')
    // Choices are withheld while the session is busy, such as while a move animates
    await expect(
        gameOver
            .or(place)
            .or(pass)
            .or(front)
            .or(selectableFountains(page))
            .or(auctionableShops(page))
            .first()
    ).toBeVisible({ timeout: MoveAnimationTimeout })
    if (await gameOver.count()) {
        return
    } else if (await place.count()) {
        await place.click()
    } else if (await pass.count()) {
        await pass.click()
    } else if (await front.count()) {
        await front.click()
        const counts = panel.getByRole('button', { name: /^\d+$/ })
        if (await counts.count()) await counts.first().click()
        await pick(page, selectableFountains(page), step)
    } else if (await selectableFountains(page).count()) {
        await pick(page, selectableFountains(page), step)
        await pick(page, destinationFountains(page), step)
    } else {
        await pick(page, auctionableShops(page), step)
    }
}

test.use({ reducedMotion: 'reduce' })

test('a hotseat game plays through to the end', async ({ page }) => {
    test.setTimeout(150_000)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await createGame(page)

    const gameOver = page.getByText('The game is over.')
    for (let step = 0; step < 1500 && !(await gameOver.count()); step++) {
        const snapshot = async () => [
            await actionPanel(page).innerText(),
            await page.getByRole('tabpanel').first().innerText(),
            await board(page).innerHTML()
        ]
        const before = await snapshot()
        if (step % 25 === 0) console.log(`step ${step}: ${before[0].split('\n')[0]}`)
        await takeStep(page, step)
        await expect.poll(snapshot).not.toEqual(before)
    }

    await expect(gameOver).toBeVisible()
    await expect(actionPanel(page)).toContainText(/wins|share the win/)
    await expect(actionPanel(page)).toContainText('End of game')
    // Every hand is shown once the game is over: each player's five antiques, held or completed
    const players = page.getByRole('tabpanel').first()
    await expect(players.getByText('hidden antiques')).toHaveCount(0)
    await expect(players.getByRole('img', { name: / worth \d+/ })).toHaveCount(4 * 5)
    expect(errors).toEqual([])
})
