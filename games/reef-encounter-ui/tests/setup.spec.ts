import { expect, test } from '@playwright/test'
import { actionPanel, createGame } from './helpers'

test('every player feeds their parrotfish, then takes two larva cubes', async ({ page }) => {
    await createGame(page, 3)
    const actions = actionPanel(page)

    for (let seat = 0; seat < 3; seat++) {
        await expect(actions).toContainText('Feed one of your polyps')
        await actions
            .getByRole('button', { name: /^Feed an? / })
            .first()
            .click()
    }

    for (let seat = 0; seat < 3; seat++) {
        await expect(actions).toContainText('Take two larva cubes')
        await actions.getByRole('button', { name: 'Take a pink larva cube' }).click()
        await expect(actions).toContainText('Take a second larva cube')
        await actions.getByRole('button', { name: 'Take a grey larva cube' }).click()
    }

    await expect(actions).toContainText('Grow your reefs')
})

test('Undo takes back the first larva cube without undoing the feeding', async ({ page }) => {
    await createGame(page, 2)
    const actions = actionPanel(page)
    for (let seat = 0; seat < 2; seat++) {
        await actions
            .getByRole('button', { name: /^Feed an? / })
            .first()
            .click()
    }

    await actions.getByRole('button', { name: 'Take a white larva cube' }).click()
    await expect(actions).toContainText('Take a second larva cube')
    await expect(actions.getByRole('button', { name: 'Take a white larva cube' })).toHaveAttribute(
        'aria-pressed',
        'true'
    )

    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(actions).toContainText('Take two larva cubes')
    await expect(actions.getByRole('button', { name: 'Take a white larva cube' })).toHaveAttribute(
        'aria-pressed',
        'false'
    )
})
