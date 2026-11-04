import { expect, test, type Page } from '@playwright/test'
import type * as TableFixture from '../src/lib/testing/tableFixture.js'

async function openTable(page: Page, name: TableFixture.TableName) {
    await page.goto('/')
    await page.evaluate(async (name) => {
        const fixture = await import(
            new URL('/src/lib/testing/tableFixture.ts', location.href).href
        )
        return fixture.open(name)
    }, name)
}

const WARNING = 'denizen.nomad.warning-signals'
const panel = (page: Page) => page.locator('.panel')

// Warning Signals: "Move any warbands …": with no warband it can move, it is still a plan the
// defender may declare, moving nothing.
for (const viewport of [
    { width: 1280, height: 900 },
    { width: 375, height: 812 }
]) {
    test.describe(`Warning Signals with nothing to move, at ${viewport.width} × ${viewport.height}`, () => {
        test.use({ viewport })

        test('it is listed, opens nothing to pick, and Use plans declares it', async ({ page }) => {
            await openTable(page, 'warningSignalsNothingToMove')
            const row = panel(page).locator(`[data-card-row="${WARNING}"]`)
            const toggle = row.locator('button[aria-pressed]')
            await expect(toggle).toBeVisible()
            await toggle.click()
            await expect(toggle).toHaveAttribute('aria-pressed', 'true')
            await expect(panel(page).locator(`[data-plan-picks="${WARNING}"]`)).toHaveCount(0)
            const use = panel(page).getByRole('button', { name: 'Use plans', exact: true })
            await expect(use).toBeVisible()
            await expect(panel(page).locator('p.text-oath-danger')).toHaveCount(0)
            await use.click()
            await expect(toggle).toHaveCount(0)
        })
    })
}
