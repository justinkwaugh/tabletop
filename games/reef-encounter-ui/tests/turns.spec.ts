import { expect, test } from '@playwright/test'
import { actionPanel, createGame, playSetup } from './helpers'

test('a turn plays a larva cube, places its polyps and ends by taking an open-sea space', async ({
    page
}) => {
    await createGame(page, 2)
    await playSetup(page, 2)
    const actions = actionPanel(page)

    await actions
        .getByRole('button', { name: /^Play an? \w+ larva cube/ })
        .first()
        .click()
    await expect(actions).toContainText(/Place \w+ polyps on the reefs/)
    const targets = page.getByRole('button', { name: /^(Place|Attack with) an? / })
    await expect(targets.first()).toBeVisible()

    const remaining = async () =>
        Number((await actions.innerText()).match(/(\d+) more from behind your screen/)?.[1])
    const before = await remaining()
    await targets.first().click()
    await expect.poll(remaining).toBe(before - 1)
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect.poll(remaining).toBe(before)

    // The harness banner names whose turn it is in hotseat play
    const banner = page.getByText(/It.s your turn/)
    const turnBanner = await banner.innerText()
    await page
        .getByRole('button', { name: /^Take the \w+ larva cube/ })
        .first()
        .click()
    await expect(banner).not.toHaveText(turnBanner)
    await expect(actions).toContainText('Choose your actions')
})

test('a larva cube is traded for a polyp of its colour', async ({ page }) => {
    await createGame(page, 2)
    await playSetup(page, 2)
    const actions = actionPanel(page)
    const trade = actions.getByRole('button', {
        name: /^Exchange an? \w+ larva cube for an? \w+ polyp$/
    })
    // The acting player is first in turn order, so theirs is the first panel; setup gave them
    // two cubes of one colour
    const cubes = page.locator('article').first().locator('.row', { hasText: 'Larva cubes' })
    await expect(cubes).toContainText('2')

    await trade.first().click()
    await expect(cubes).not.toContainText('2')
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(cubes).toContainText('2')
})
