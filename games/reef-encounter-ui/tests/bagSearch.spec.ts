import { expect, test } from '@playwright/test'
import { actionPanel, openScenario } from './helpers'

test('trading a cube with its bonus space empty searches the bag, past which Undo cannot go', async ({
    page
}) => {
    await openScenario(page, 'Bag searches')
    const actions = actionPanel(page)
    const undo = page.getByRole('button', { name: 'Undo' })

    await actions
        .getByRole('button', { name: 'Exchange a pink larva cube for a pink polyp' })
        .click()
    await expect(actions).toContainText('Choose your actions')
    await expect(undo).toHaveCount(0)
    await page.getByRole('tab', { name: 'History' }).click()
    await expect(page.getByText('The bag held a pink polyp.')).toBeAttached()
})

test('extra growth with its bonus space empty grows a polyp found in the bag', async ({ page }) => {
    await openScenario(page, 'Bag searches')
    const actions = actionPanel(page)

    await actions.getByRole('button', { name: /^Play a white larva cube/ }).click()
    await page
        .getByRole('button', { name: 'Place a white polyp on Board 1, row 3, column 3' })
        .click()
    await expect(
        page.getByRole('img', { name: 'white polyp on Board 1, row 4, column 3' })
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0)
})
