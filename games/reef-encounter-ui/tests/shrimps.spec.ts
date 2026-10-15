import { expect, test } from '@playwright/test'
import { actionPanel, createGame, playSetup } from './helpers'

test('a shrimp is introduced onto a polyp, moved, and sent back to the supply', async ({
    page
}) => {
    await createGame(page, 2)
    await playSetup(page, 2)
    const actions = actionPanel(page)
    const takeSpace = page.getByRole('button', { name: /^Take the \w+ larva cube/ })

    await actions.getByRole('button', { name: 'Introduce a shrimp' }).click()
    await expect(actions).toContainText('Choose a polyp for your shrimp')
    await expect(takeSpace).toHaveCount(0)
    await page
        .getByRole('button', { name: /^Put your shrimp on / })
        .first()
        .click()
    await expect(actions).not.toContainText('Introduce')

    const pickUp = page.getByRole('button', { name: /^Pick up your shrimp on / })
    await pickUp.click()
    await expect(actions).toContainText('Move your shrimp')
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(actions).not.toContainText('Move your shrimp')

    await pickUp.click()
    await expect(actions).toContainText('Move your shrimp')
    await page.getByRole('button', { name: /^Leave your shrimp on / }).click()
    await expect(actions).not.toContainText('Move your shrimp')
    await expect(pickUp).toBeVisible()

    await pickUp.click()
    await page
        .getByRole('button', { name: /^Put your shrimp on / })
        .first()
        .click()
    await expect(actions).toContainText(
        /Your shrimp on Board \d, row \d, column \d is on bare rock./
    )
    await expect(takeSpace).toHaveCount(0)

    await pickUp.click()
    await page.getByRole('button', { name: 'Put the shrimp back in your supply' }).click()
    await expect(pickUp).toHaveCount(0)
    await expect(takeSpace.first()).toBeVisible()
})
