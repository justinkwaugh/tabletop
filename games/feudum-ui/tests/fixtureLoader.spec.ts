import { expect, test } from './errorWatch.js'
import { openFixture } from './scenarioTable.js'

/** Named fixtures, on the dev server: what the scenarios stand on. */

test('a fixture opens by name, its real table on its seat', async ({ page }) => {
    await openFixture(page, 'hands-second-sulfur')
    await expect(page.locator('[data-action-panel] [data-hand-count]')).toHaveText('0 of 4')
    await expect(page.locator('[data-finalise-seat="Ana"]')).toBeVisible()
    await expect(page.locator('[data-finalise-seat="Bram"]')).toBeVisible()
})

test('a name that is no fixture fails loudly, naming those that are', async ({ page }) => {
    await expect(openFixture(page, 'setup-gods')).rejects.toThrow(
        /^No fixture named "setup-gods"\. There are: setup-goods, /
    )
    await expect(page.locator('[data-action-panel]')).toHaveCount(0)
})
