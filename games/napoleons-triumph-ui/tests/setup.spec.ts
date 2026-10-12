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
