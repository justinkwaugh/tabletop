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
            .getByRole('button', { name: /^Play an? \w+ larva cube/ })
            .first()
    ).toBeVisible()
})

test('the player aid opens from the header and closes with Escape or a click outside', async ({
    page
}) => {
    await createGame(page, 2)
    const aidButton = page.getByRole('button', { name: 'Player aid' })
    await aidButton.click()
    const aid = page.getByRole('dialog', { name: 'Player aid' })
    await expect(aid.getByRole('img', { name: /^Reference card\./ })).toBeVisible()
    await expect(aidButton).toHaveAttribute('aria-expanded', 'true')
    await page.keyboard.press('Escape')
    await expect(aid).toHaveCount(0)

    await aidButton.click()
    await page.mouse.click(5, (page.viewportSize()?.height ?? 1000) - 5)
    await expect(aid).toBeVisible()
    const box = (await aid.boundingBox())!
    await page.mouse.click(box.x - 20, box.y + box.height / 2)
    await expect(aid).toHaveCount(0)
})
