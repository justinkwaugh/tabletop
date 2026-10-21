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

const CAPTAINS = 'denizen.order.captains'
const SIEGE_ENGINES = 'denizen.order.siege-engines'
const grid = (page: Page) => page.locator('.panel')
const usePower = (page: Page) =>
    grid(page).getByRole('button', { name: 'Use a power', exact: true })
const powerRow = (page: Page, cardId: string) =>
    grid(page).locator(`[data-action-power="${cardId}"]`)

// A power with nothing it can pick is left out of the Use a power list, and with nothing left
// in it, Use a power is not offered.
for (const viewport of [
    { width: 1280, height: 900 },
    { width: 375, height: 812 }
]) {
    test.describe(`a power with nothing to pick, at ${viewport.width} × ${viewport.height}`, () => {
        test.use({ viewport })

        test('Captains with no defender at a site Dana rules is not listed; Siege Engines is', async ({
            page
        }) => {
            await openTable(page, 'pickerSitesNoDefender')
            await usePower(page).click()
            await expect(powerRow(page, SIEGE_ENGINES)).toBeVisible()
            await expect(powerRow(page, CAPTAINS)).toHaveCount(0)
        })

        test('with defenders at their sites, Captains is listed again', async ({ page }) => {
            await openTable(page, 'pickerSites')
            await usePower(page).click()
            await expect(powerRow(page, SIEGE_ENGINES)).toBeVisible()
            await expect(powerRow(page, CAPTAINS)).toBeVisible()
        })

        test('Captains their one card power, with nothing to pick: no Use a power', async ({
            page
        }) => {
            await openTable(page, 'pickerCaptainsNoDefender')
            // The Act Phase grid is drawn, its six majors there.
            await expect(grid(page).locator('.majors button')).toHaveCount(6)
            await expect(usePower(page)).toHaveCount(0)
        })
    })
}
