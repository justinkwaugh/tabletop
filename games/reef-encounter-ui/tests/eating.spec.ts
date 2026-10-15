import { expect, test } from '@playwright/test'
import { actionPanel, openScenario } from './helpers'

test('a parrotfish eats a coral its shrimp guards, at the start of a turn', async ({ page }) => {
    await openScenario(page, 'Coral ready to eat')
    const actions = actionPanel(page)
    const eat = actions.getByRole('button', { name: 'Eat a coral and a shrimp' })
    const coralSquares = page.getByRole('button', { name: /^Feed the 5-polyp white coral/ })

    await eat.click()
    await expect(actions).toContainText('Choose a coral for your parrotfish')
    await expect(coralSquares).toHaveCount(5)
    await expect(page.getByRole('button', { name: /^Take the \w+ larva cube/ })).toHaveCount(0)
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(coralSquares).toHaveCount(0)

    await eat.click()
    await coralSquares.first().click()
    await expect(actions).toContainText('Choose your actions')
    await expect(eat).toHaveCount(0)
    await expect(page.locator('article').first()).toContainText('ate 1 shrimp')
})
