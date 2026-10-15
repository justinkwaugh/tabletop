import { expect, test } from '@playwright/test'
import { actionPanel, openScenario } from './helpers'

test('a consumed polyp buys an alga cylinder, and Undo steps back through its choices', async ({
    page
}) => {
    await openScenario(page, 'Consumed polyps to spend')
    const actions = actionPanel(page)
    const undo = page.getByRole('button', { name: 'Undo' })
    const acquire = actions.getByRole('button', {
        name: 'Acquire an alga cylinder, paying a consumed white polyp'
    })
    const firstColour = actions.getByRole('button', { name: /^A \w+ cylinder$/ }).first()

    await acquire.click()
    await expect(actions).toContainText("Choose the cylinder's colour")
    await firstColour.click()
    await expect(actions).toContainText(/Put the \w+ cylinder on the open sea/)
    const cylinderSpace = page.getByRole('button', { name: /on the open-sea cylinder space$/ })
    await expect(cylinderSpace).toBeVisible()
    await expect(page.getByRole('button', { name: /^Take the \w+ larva cube/ })).toHaveCount(0)

    await undo.click()
    await expect(actions).toContainText("Choose the cylinder's colour")
    await undo.click()
    await expect(actions).toContainText('Choose your actions')

    await acquire.click()
    await firstColour.click()
    await cylinderSpace.click()
    await expect(actions).toContainText('Choose your actions')
    await expect(cylinderSpace).toHaveCount(0)
    await expect(acquire).toHaveCount(0)
})
