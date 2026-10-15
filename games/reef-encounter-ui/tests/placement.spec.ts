import { expect, test } from '@playwright/test'
import { actionPanel, openScenario } from './helpers'

test('with polyps in the supply and consumed, a popup by the square asks which to place', async ({
    page
}) => {
    await openScenario(page, 'Both polyp sources')
    const actions = actionPanel(page)
    const square = page.getByRole('button', {
        name: 'Place a white polyp on board 3, row 2, column 4'
    })
    const consumed = page.getByRole('button', { name: 'Place a consumed white polyp' })

    // One cube places at most four polyps from the supply, plus the consumed one.
    await actions
        .getByRole('button', { name: 'Play a white larva cube and 5 white polyps' })
        .click()
    await square.click()
    await expect(actions).toContainText('Which white polyp goes there?')
    await expect(consumed).toBeVisible()
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(consumed).toHaveCount(0)
    await expect(actions).toContainText('Place white polyps on the reefs')

    await square.click()
    await consumed.click()
    await expect(
        page.getByRole('img', { name: 'white polyp on board 3, row 2, column 4' })
    ).toBeVisible()
    await page
        .getByRole('button', { name: 'Place a white polyp on board 3, row 1, column 4' })
        .click()
    await expect(consumed).toHaveCount(0)
    await expect(
        page.getByRole('img', { name: 'white polyp on board 3, row 1, column 4' })
    ).toBeVisible()
})
