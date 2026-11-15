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

const panel = (page: Page) => page.locator('.panel')
const cardRow = (page: Page, name: string) =>
    panel(page).locator('button[aria-pressed]').filter({ hasText: name })
const travelTile = (page: Page) =>
    panel(page).locator('.majors button').filter({ hasText: 'Travel' })
const siteAt = (page: Page, slotId: string) => page.locator(`.site[data-slot="${slotId}"]`)
const siteCard = (page: Page, slotId: string) => siteAt(page, slotId).locator('.board-card')
const chipOf = (page: Page, slotId: string) => siteAt(page, slotId).locator('.travel-cost')
const wayButtons = (page: Page) => panel(page).locator('.ways__buttons button')

const GREAT_SLUM = 'slot.provinces.1'
const RIVER = 'slot.provinces.2'

const SIZES = [
    { name: 'desktop at 1280', viewport: { width: 1280, height: 900 }, phone: false },
    { name: 'phone at 375', viewport: { width: 375, height: 812 }, phone: true }
]

/** Dana at Bea's Wood puts the Portal there in use: the ordinary Travel, every site 0 Supply. */
async function throughThePortal(page: Page, name: TableFixture.TableName) {
    await openTable(page, name)
    await travelTile(page).click()
    await cardRow(page, 'Portal').click()
    await expect(cardRow(page, 'Portal')).toHaveAttribute('aria-pressed', 'true')
    await expect(panel(page).getByText('Tap a lit site.')).toBeVisible()
}

/** A tap on a phone, a click on a desktop. */
async function press(page: Page, slotId: string, phone: boolean) {
    if (phone) await siteCard(page, slotId).tap()
    else await siteCard(page, slotId).click()
}

/** R-7.1.4, R-11.12 — a site Travel reaches for nothing shows that way alone; its dearer ways are hidden. */
for (const { name, viewport, phone } of SIZES) {
    test.describe(`a free way to a site hides its dearer ways, on a ${name}`, () => {
        test.use({ viewport, hasTouch: phone })

        test('the Portal beside Way Station: the Great Slum’s chip reads "0 Supply", as the River’s does, and a tap travels for nothing', async ({
            page
        }) => {
            await throughThePortal(page, 'woodCards')
            await expect(chipOf(page, GREAT_SLUM)).toHaveText(/^\s*0 Supply\s*$/)
            await expect(chipOf(page, GREAT_SLUM).getByRole('img', { name: 'favor' })).toHaveCount(
                0
            )
            await expect(chipOf(page, RIVER)).toHaveText(/^\s*0 Supply\s*$/)
            await expect(
                siteAt(page, GREAT_SLUM).getByRole('button', {
                    name: 'Great Slum, 0 Supply',
                    exact: true
                })
            ).toHaveCount(1)

            // One way and no toll: the tap travels at once, by the free way (no favor to Ann).
            await press(page, GREAT_SLUM, phone)
            await expect
                .poll(async () => (await call(page, 'tableFacts')).siteOf.Dana)
                .toBe(GREAT_SLUM)
            expect((await call(page, 'tableFacts')).favorOf.Dana).toBe(2)
        })

        test('Hospitality’s two banks stay with the free way: the chip reads the free way and keeps the gain', async ({
            page
        }) => {
            await throughThePortal(page, 'woodPortalBanks')
            await expect(chipOf(page, GREAT_SLUM).locator('.travel-cost__way')).toHaveText(['0'])
            await expect(
                chipOf(page, GREAT_SLUM).locator('.travel-cost__gain').getByRole('img')
            ).toHaveCount(3)
            await expect(
                siteAt(page, GREAT_SLUM).getByRole('button', {
                    name: 'Great Slum, 0 Supply, gain 1 favor from the Order or Nomad bank',
                    exact: true
                })
            ).toHaveCount(1)
        })

        test('Hospitality’s two banks: the Travel row holds the free way once per bank, and the one picked travels for nothing', async ({
            page
        }) => {
            await throughThePortal(page, 'woodPortalBanks')
            await press(page, GREAT_SLUM, phone)
            await expect(wayButtons(page)).toHaveCount(2)
            for (const button of await wayButtons(page).all()) {
                await expect(button).toContainText('0 Supply')
                await expect(button).not.toContainText(' to ')
            }
            await wayButtons(page).nth(1).click()
            await expect
                .poll(async () => (await call(page, 'tableFacts')).siteOf.Dana)
                .toBe(GREAT_SLUM)
            // No favor paid; one gained from the bank picked.
            expect((await call(page, 'tableFacts')).favorOf.Dana).toBe(3)
        })
    })
}
