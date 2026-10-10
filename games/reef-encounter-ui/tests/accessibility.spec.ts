import { expect, test } from '@playwright/test'
import { actionPanel, createGame, playSetup } from './helpers'

test('the table names its pieces, coral tiles and choices for screen readers', async ({ page }) => {
    await createGame(page, 2)
    await playSetup(page, 2)

    const openSea = page.getByRole('group', { name: 'Open sea' })
    await expect(openSea.getByRole('img', { name: /^Coral tile \d+: \w+ beats \w+;/ })).toHaveCount(
        10
    )
    await expect(
        openSea.getByRole('img', { name: /^\w+ larva cube in the \w+ larva space$/ })
    ).toHaveCount(5)
    await expect(
        openSea.getByRole('button', { name: /^Take the \w+ larva cube/ }).first()
    ).toBeVisible()

    const reef = page.getByRole('group', { name: /^Reef board \d$/ }).first()
    await expect(
        reef.getByRole('img', { name: /^\w+ polyp on board \d, row \d, column \d$/ }).first()
    ).toBeVisible()

    // Setup left the acting player two larva cubes, named rather than drawn alone
    const panel = page.locator('article').first()
    await expect(panel.getByRole('img', { name: /^\d \w+ larva cubes?$/ }).first()).toBeVisible()
    await expect(
        actionPanel(page)
            .getByRole('button', { name: /^Play an? \w+ larva cube$/ })
            .first()
    ).toBeVisible()
})
