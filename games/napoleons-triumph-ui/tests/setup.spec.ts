import { expect, test } from '@playwright/test'
import { createGame, failOnPageErrors, tap } from './table.js'

failOnPageErrors()

test('the French fixed battery turns to another approach of its locale without a detachment', async ({
    page
}) => {
    await createGame(page)
    const deploy = page.getByRole('button', { name: 'Deploy the army' })
    await deploy.click()
    const battery = page.locator('.nt-setup-units button', {
        has: page.getByText('fixed battery')
    })
    const hint = page.locator('.nt-setup-hint')
    const prompt = page.locator('.nt-setup-prompt')

    await battery.click()
    await expect(hint).toContainText('The fixed battery faces')
    const facedAtFirst = await hint.innerText()

    await tap(page, 'svg [aria-label="Block this approach"]')
    await expect(prompt).toContainText('0 of 6 detached')
    await battery.click()
    await expect(hint).toContainText('The fixed battery faces')
    await expect(hint).not.toHaveText(facedAtFirst)

    await deploy.click()
    await expect(page.locator('[data-commander="st-hilaire"]')).toBeVisible()
})

// With this deal of the blocks no corps near the Santon is dealt artillery unless the set-up gives it some.
const NO_ARTILLERY_NEAR_THE_SANTON = '0000000000000000000000009e3779b1'

test('with the Santon in use the French set-up opens ready to deploy, its fixed battery held on the Santon', async ({
    page
}) => {
    await createGame(page, { santon: true, seed: NO_ARTILLERY_NEAR_THE_SANTON })
    const deploy = page.getByRole('button', { name: 'Deploy the army' })
    await deploy.click()
    await expect(page.locator('.nt-setup-prompt')).toContainText('1 of 6 detached')
    await expect(page.locator('.nt-setup-problem')).toHaveCount(0)
    await expect(page.locator('[data-commander="st-hilaire"]')).toBeVisible()

    await page.locator('.nt-setup-units button', { has: page.getByText('fixed battery') }).click()
    await expect(page.locator('.nt-setup-hint')).toContainText('stays on the Santon')
    await expect(page.locator('svg [aria-label="Block this approach"]')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Return it to its corps' })).toHaveCount(0)

    await deploy.click()
    await expect(page.locator('.nt-setup-prompt')).toHaveCount(0)
    await expect(page.locator('[data-commander="st-hilaire"]')).toBeVisible()
})
