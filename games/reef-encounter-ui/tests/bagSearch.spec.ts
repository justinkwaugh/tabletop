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

test('warns once before a trade or placement that would search the bag', async ({ page }) => {
    await openScenario(page, 'Bag searches')
    const actions = actionPanel(page)

    await expect(actions).toContainText(
        'No bonus pink or white polyp: trading for one searches the bag, with no Undo.'
    )
    await expect(
        actions.getByRole('button', {
            name: 'Exchange a grey larva cube for a grey polyp',
            exact: true
        })
    ).toBeAttached()
    await expect(
        actions.getByRole('button', {
            name: 'Exchange a pink larva cube for a pink polyp from the bag, which can’t be taken back'
        })
    ).toBeAttached()

    await actions.getByRole('button', { name: /^Play a white larva cube/ }).click()
    await expect(actions.locator('.warning')).toHaveText(
        'No bonus pink or white polyp: trading for one or placing on a ! square searches the bag, with no Undo.'
    )
    await expect(
        page.getByRole('button', {
            name: 'Place a white polyp on Board 1, row 3, column 3, growing a bonus polyp from the bag, which can’t be taken back'
        })
    ).toBeVisible()
})

test('refills the empty bonus spaces when the turn ends', async ({ page }) => {
    await openScenario(page, 'Bag searches')

    await page.getByRole('button', { name: /^Take the grey larva cube/ }).click()

    await expect(actionPanel(page)).not.toContainText('No bonus')
    await page.getByRole('tab', { name: 'History' }).click()
    await expect(page.getByText(/Bonus: pink polyp, white polyp\./)).toBeAttached()
})
