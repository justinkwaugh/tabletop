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
/** R-6.2 — a card's "Use", on the board or in a seat. */
const useBadge = (page: Page, cardId: string) => page.locator(`[data-use-badge="${cardId}"]`)
const powerRow = (page: Page, cardId: string) =>
    grid(page).locator(`[data-action-power="${cardId}"]`)

// A power with nothing it can pick wears no Use.
for (const viewport of [
    { width: 1280, height: 900 },
    { width: 375, height: 812 }
]) {
    test.describe(`a power with nothing to pick, at ${viewport.width} × ${viewport.height}`, () => {
        test.use({ viewport })

        test('Captains with no defender at a site Dana rules wears no Use; Siege Engines does, and it opens', async ({
            page
        }) => {
            await openTable(page, 'pickerSitesNoDefender')
            await expect(useBadge(page, CAPTAINS)).toHaveCount(0)
            await expect(useBadge(page, SIEGE_ENGINES)).toHaveCount(1)
            await useBadge(page, SIEGE_ENGINES).dispatchEvent('click')
            await expect(powerRow(page, SIEGE_ENGINES)).toBeVisible()
        })

        test('with defenders at their sites, Captains wears its Use again', async ({ page }) => {
            await openTable(page, 'pickerSites')
            await expect(useBadge(page, SIEGE_ENGINES)).toHaveCount(1)
            await expect(useBadge(page, CAPTAINS)).toHaveCount(1)
            await useBadge(page, CAPTAINS).dispatchEvent('click')
            await expect(powerRow(page, CAPTAINS)).toBeVisible()
        })

        test('Captains their one card power, with nothing to pick: no Use anywhere', async ({
            page
        }) => {
            await openTable(page, 'pickerCaptainsNoDefender')
            // The Act Phase grid is drawn, its six majors there.
            await expect(grid(page).locator('.majors button')).toHaveCount(6)
            await expect(page.locator('[data-use-badge]')).toHaveCount(0)
        })
    })
}
