import { expect, test, type Page } from '@playwright/test'
import type * as TableFixture from '../src/lib/testing/tableFixture.js'

type Fixture = typeof TableFixture

async function call<K extends keyof Fixture>(
    page: Page,
    name: K,
    ...args: Parameters<Fixture[K]>
): Promise<Awaited<ReturnType<Fixture[K]>>> {
    return page.evaluate(
        async ({ name, args }) => {
            const fixture = await import(
                new URL('/src/lib/testing/tableFixture.ts', location.href).href
            )
            return fixture[name](...args)
        },
        { name, args }
    )
}

async function openTable(page: Page, name: TableFixture.TableName) {
    await page.goto('/')
    return call(page, 'open', name)
}

const history = (page: Page) => page.locator('.history')

const SIZES = [
    { name: 'desktop', viewport: { width: 1280, height: 900 } },
    { name: 'phone', viewport: { width: 375, height: 812 } }
]

/**
 * R-5.5.8 — Second Wind's grant reads on the spoils row that recorded it, between the victory and
 * the free Travel: "free Travel and Campaign next (Second Wind)".
 */
for (const { name, viewport } of SIZES) {
    test.describe(`Second Wind’s grant in the History, on a ${name}`, () => {
        test.use({ viewport })

        test('the victory, the spoils ending "free Travel and Campaign next (Second Wind)", then the free Travel', async ({
            page
        }) => {
            await openTable(page, 'historySecondWind')
            const tab = page.getByRole('tab', { name: 'History' })
            await tab.scrollIntoViewIfNeeded()
            await tab.click()
            await expect(history(page)).toContainText('won the battle')
            await expect(history(page)).toContainText(
                /took the spoils: burned 2\s*from\s*rhys\s*; free Travel and Campaign next \(Second Wind\)/
            )
            await expect(history(page)).toContainText('traveled to Mine (free, Second Wind)')
            await expect(history(page)).not.toContainText('cost no Supply')
            // Newest first: the free Travel, then the spoils with the grant, then the victory.
            const text = (await history(page).innerText()).replace(/\s+/g, ' ')
            const travel = text.indexOf('traveled to Mine (free, Second Wind)')
            const spoils = text.indexOf('free Travel and Campaign next (Second Wind)')
            const won = text.indexOf('won the battle')
            expect(travel).toBeGreaterThanOrEqual(0)
            expect(spoils).toBeGreaterThan(travel)
            expect(won).toBeGreaterThan(spoils)
            await page.mouse.move(2, 2)
            await history(page).screenshot({
                path: test.info().outputPath(`second-wind-history-${name}.png`)
            })
            await page.screenshot({
                path: test.info().outputPath(`second-wind-history-page-${name}.png`)
            })
        })
    })
}
