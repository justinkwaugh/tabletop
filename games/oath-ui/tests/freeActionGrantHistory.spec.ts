import { expect, test, type Page } from '@playwright/test'
import type * as TableFixture from '../src/lib/testing/tableFixture.js'

async function openTable(page: Page, name: TableFixture.TableName) {
    await page.goto('/')
    await page.evaluate(async (name) => {
        const fixture = await import(new URL('/src/lib/testing/tableFixture.ts', location.href).href)
        return fixture.open(name)
    }, name)
}

const history = (page: Page) => page.locator('.history')

const SIZES = [
    { name: 'desktop', viewport: { width: 1280, height: 900 } },
    { name: 'phone', viewport: { width: 375, height: 812 } }
]

for (const { name, viewport } of SIZES) {
    /**
     * R-10.2 — Dana uses the Brass Horse, no site holds the revealed suit, and the next Travel is
     * free: its row names the card, as Second Wind's does. A Sneak Attack says so after its plans.
     */
    test.describe(`a free action's card in the History, on a ${name}`, () => {
        test.use({ viewport })

        test('the free Travel reads "traveled to Plains (free, Brass Horse)"', async ({ page }) => {
            await openTable(page, 'historyFreeGranted')
            const tab = page.getByRole('tab', { name: 'History' })
            await tab.scrollIntoViewIfNeeded()
            await tab.click()
            await expect(history(page)).toContainText(/dana\s*traveled to Plains \(free, Brass Horse\)/i)
            await expect(history(page)).not.toContainText('spending')
            await page.mouse.move(2, 2)
            await history(page).screenshot({
                path: test.info().outputPath(`free-granted-history-${name}.png`)
            })
        })

        test('a Sneak Attack reads "using Second Wind (Sneak Attack, free)"', async ({ page }) => {
            await openTable(page, 'historySecondWind')
            const tab = page.getByRole('tab', { name: 'History' })
            await tab.scrollIntoViewIfNeeded()
            await tab.click()
            await expect(history(page)).toContainText(
                // "favor" is drawn as its token.
                /campaigned against\s*rhys\s*for their pawn and\s*, using Second Wind \(Sneak Attack, free\)/i
            )
            await history(page).getByText(/Sneak Attack, free/).scrollIntoViewIfNeeded()
            await page.mouse.move(2, 2)
            await history(page).screenshot({
                path: test.info().outputPath(`sneak-attack-history-${name}.png`)
            })
        })
    })
}
