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

const history = (page: Page) => page.locator('.history')
const ledger = (page: Page) => history(page).locator('[data-campaign-ledger]')
const rows = (page: Page) => history(page).locator('ol > div')
const WENT = /went to Hospital's site \(Hospital\)/

const SIZES = [
    { name: 'desktop', viewport: { width: 1280, height: 900 }, phone: false },
    { name: 'phone', viewport: { width: 375, height: 812 }, phone: true }
]

for (const { name, viewport, phone } of SIZES) {
    /**
     * Hospital — Ann (the Chancellor) used it, and picked 2 of the defence at the Plains and 1 on
     * Rhys's board to die: Hospital set Ann's 2 aside, and placed them on its site when Dana took the
     * spoils.
     */
    test.describe(`History says where Hospital's saved warbands went, on a ${name}`, () => {
        test.use({ viewport, hasTouch: phone })

        test("the spoils row: 2 of Ann's warbands went to Hospital's site (Hospital)", async ({
            page
        }) => {
            await openTable(page, 'battleLossHospitalPlaced')
            await page.getByRole('tab', { name: 'History' }).click()
            const spoils = rows(page).filter({ hasText: 'took the spoils' })
            await expect(spoils).toHaveCount(1)
            await expect(spoils).toContainText(
                /took the spoils; 2\s*went to Hospital's site \(Hospital\)/
            )
            await expect(history(page).getByText(WENT)).toHaveCount(1)
            expect(
                await page.evaluate(() => document.documentElement.scrollWidth)
            ).toBeLessThanOrEqual(viewport.width)
            await history(page).screenshot({
                path: test.info().outputPath(`hospital-history-row-${name}.png`)
            })
        })

        test("the Campaign's ledger: Rhys's warband Hospital saved is not lost; the Lost line says where it went", async ({
            page
        }) => {
            await openTable(page, 'campaignLedgerHospital')
            await page.getByRole('tab', { name: 'History' }).click()
            await expect(ledger(page)).toContainText(
                /Plains, Cup of Plenty, 2\s*; 1\s*went to Hospital's site \(Hospital\); banished to River/
            )
            await expect(ledger(page)).not.toContainText('killed at Plains')
            await expect(rows(page).filter({ hasText: 'took the spoils' })).toContainText(WENT)
            expect(
                await page.evaluate(() => document.documentElement.scrollWidth)
            ).toBeLessThanOrEqual(viewport.width)
            await history(page).screenshot({
                path: test.info().outputPath(`hospital-ledger-${name}.png`)
            })
        })
    })
}
