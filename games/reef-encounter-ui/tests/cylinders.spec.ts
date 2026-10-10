import { expect, test } from '@playwright/test'
import { actionPanel, createGame, playSetup, playUntilConsumedPolyp } from './helpers'

test('a consumed polyp buys an alga cylinder, and Undo steps back through its choices', async ({
    page
}) => {
    test.setTimeout(120_000)
    await createGame(page, 2)
    await playSetup(page, 2)
    await playUntilConsumedPolyp(page)
    const actions = actionPanel(page)
    const undo = page.getByRole('button', { name: 'Undo' })

    await actions
        .getByRole('button', { name: /^Pay a consumed/ })
        .first()
        .click()
    await expect(actions).toContainText("Choose the cylinder's colour")
    await actions
        .getByRole('button', { name: /^A \w+ cylinder$/ })
        .first()
        .click()
    await expect(actions).toContainText(/Put the \w+ cylinder on the open sea/)
    const cylinderSpace = page.getByRole('button', { name: /on the open-sea cylinder space$/ })
    await expect(cylinderSpace).toBeVisible()
    await expect(page.getByRole('button', { name: /^Take the \w+ larva cube/ })).toHaveCount(0)

    await undo.click()
    await expect(actions).toContainText("Choose the cylinder's colour")
    await undo.click()
    await expect(actions).toContainText('Grow your reefs')

    await actions
        .getByRole('button', { name: /^Pay a consumed/ })
        .first()
        .click()
    await actions
        .getByRole('button', { name: /^A \w+ cylinder$/ })
        .first()
        .click()
    await cylinderSpace.click()
    await expect(actions).toContainText('Grow your reefs')
    await expect(cylinderSpace).toHaveCount(0)
})
