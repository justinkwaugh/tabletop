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

async function boxOf(page: Page, locator: ReturnType<Page['locator']>) {
    const box = await locator.boundingBox()
    if (!box) throw Error('The element is not drawn')
    return box
}

const panel = (page: Page) => page.locator('.panel')

const SIZES = [
    { name: 'desktop', viewport: { width: 1280, height: 900 }, phone: false },
    { name: 'phone', viewport: { width: 375, height: 812 }, phone: true }
]

/** R-11.7 — leaving a Shrouded Wood an enemy rules: the traveller's panel and the ruler's choice. */
for (const { name, viewport, phone } of SIZES) {
    test.describe(`leaving an enemy's Shrouded Wood, on a ${name}`, () => {
        test.use({ viewport })

        test('the traveller sees what each region the ruler can pick costs, and the Travel spends nothing', async ({ page }) => {
            await openTable(page, 'woodTraveller')
            await panel(page).locator('.majors button').filter({ hasText: 'Travel' }).click()
            await expect(panel(page).getByText('Leave the Shrouded Wood.', { exact: true })).toBeVisible()
            await expect(panel(page).getByText('Cole rules this Shrouded Wood: Cole picks where you go, and you pay when Cole picks.')).toBeVisible()

            const costs = panel(page).getByRole('list', { name: 'What you pay, by region' })
            await expect(costs.getByRole('listitem')).toHaveText(
                phone
                    ? [/^cradle\s*0 Supply\s*Decadent$/i, /^provinces\s*2 Supply\s*$/i]
                    : [/^cradle\s*0 Supply\s*Decadent: none into the Cradle$/i, /^provinces\s*2 Supply\s*the Wood's 2$/i],
                { useInnerText: true }
            )
            const button = panel(page).getByRole('button', { name: 'Travel: Cole picks where', exact: true })
            const [buttonBox, costsBox] = [await boxOf(page, button), await boxOf(page, costs)]
            if (phone) expect(Math.abs(buttonBox.width - costsBox.width)).toBeLessThan(2)
            else expect(buttonBox.width).toBeLessThan(costsBox.width)

            await button.click()
            await expect(panel(page).getByText('You rule the Shrouded Wood: choose where Jacob goes.', { exact: false })).toBeVisible()
            const facts = await call(page, 'tableFacts')
            expect(facts.seatId).toBe('Cole')
            expect(facts.siteOf.Jacob).toBe('slot.provinces.0')
        })

        test('the ruler is offered only the sites the traveller can pay for, by region with the cost', async ({ page }) => {
            await openTable(page, 'woodRuler')
            await expect(panel(page).getByText('You rule the Shrouded Wood: choose where Jacob goes. Jacob pays when you choose, and has 2 Supply.')).toBeVisible()

            const cradle = panel(page).getByRole('group', { name: 'Sites in the Cradle' })
            const provinces = panel(page).getByRole('group', { name: 'Sites in the Provinces' })
            await expect(cradle).toContainText(/0\s*Supply\s*Decadent/)
            await expect(provinces).toContainText(/2\s*Supply/)
            await expect(cradle.getByRole('button')).toHaveText(['Drowned City', 'Plains'])
            await expect(provinces.getByRole('button')).toHaveText(['Great Slum', 'River'])
            await expect(panel(page).getByRole('group', { name: 'Sites in the Hinterland' })).toHaveCount(0)
            await expect(panel(page).getByRole('button', { name: 'Mountain' })).toHaveCount(0)

            const [cradleBox, provincesBox] = [await boxOf(page, cradle), await boxOf(page, provinces)]
            const [drowned, plains] = [await boxOf(page, cradle.getByRole('button').first()), await boxOf(page, cradle.getByRole('button').last())]
            if (phone) {
                expect(provincesBox.y).toBeGreaterThanOrEqual(cradleBox.y + cradleBox.height - 1)
                expect(Math.abs(drowned.y - plains.y)).toBeLessThan(1)
            } else {
                expect(provincesBox.x).toBeGreaterThan(cradleBox.x + cradleBox.width - 1)
                expect(plains.y).toBeGreaterThan(drowned.y + drowned.height - 1)
                const slum = await boxOf(page, provinces.getByRole('button').first())
                expect(Math.abs(slum.width - drowned.width)).toBeLessThan(1)
            }

            await provinces.getByRole('button', { name: 'Great Slum' }).click()
            await expect.poll(async () => (await call(page, 'tableFacts')).siteOf.Jacob).toBe('slot.provinces.1')
        })
    })
}
