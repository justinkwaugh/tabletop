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
    await call(page, 'open', name)
    await expect.poll(async () => (await call(page, 'tableFacts')).seatId).toBe('Dana')
}

const TIED = 'the most common suit is tied (discord, hearth); name one'

const panel = (page: Page) => page.locator('.panel')
const step = (page: Page, text: string) => panel(page).getByText(text, { exact: true })
const card = (page: Page, name: string) =>
    panel(page).locator(`button:not(.magnifier):has(img[alt="${name}"])`)
const button = (page: Page, name: string | RegExp) =>
    panel(page).getByRole('button', { name, exact: typeof name === 'string' })
// The facedown play draws its confirm twice, one for each width; the other is hidden.
const refusal = (page: Page) => panel(page).locator('p.text-oath-danger:visible')

const SIZES = [
    { name: 'desktop', viewport: { width: 1280, height: 900 }, phone: false },
    { name: 'phone', viewport: { width: 375, height: 812 }, phone: true }
]

async function shot(page: Page, name: string, phone: boolean) {
    await page.mouse.move(2, 2)
    const path = test.info().outputPath(`${name}-${phone ? 'phone' : 'desktop'}.png`)
    if (phone) await page.screenshot({ path })
    else await panel(page).screenshot({ path })
}

for (const { name, viewport, phone } of SIZES) {
    /**
     * Riots, When played: "if the People's Favor is on the Mob side, discard all other cards of the most common
     * suit on the map. If there is a tie, you choose among the tied suits." The People's Favor is on its Mob side,
     * and Discord and Hearth tie at the sites.
     */
    test.describe(`Riots with Discord and Hearth tied, on a ${name}`, () => {
        test.use({ viewport, hasTouch: phone })

        test('kept from a Search to the advisers: the tie line in Play’s place; Discord picked, the line goes and Play shows', async ({
            page
        }) => {
            await openTable(page, 'riotsTieSearch')
            await expect(step(page, 'Keep one.')).toBeVisible()
            await card(page, 'Riots').click()
            await expect(step(page, 'How do you play it?')).toBeVisible()
            await button(page, /^Adviser, faceup/).click()
            await expect(refusal(page)).toHaveText(TIED)
            await expect(button(page, 'Play')).toHaveCount(0)
            await shot(page, 'riots-search-refused', phone)

            await button(page, /^Discord/).click()
            await expect(refusal(page)).toHaveCount(0)
            await expect(button(page, 'Play')).toBeEnabled()
            if (phone)
                expect((await button(page, 'Play').boundingBox())?.height).toBeGreaterThanOrEqual(
                    44
                )
            await shot(page, 'riots-search-ready', phone)
        })

        test('facedown, played with "Turn faceup": the tie line in Play’s place; Discord picked, the line goes and Play shows', async ({
            page
        }) => {
            await openTable(page, 'riotsTieFacedown')
            await panel(page).getByRole('button', { name: 'Adviser', exact: true }).click()
            await button(page, /^Turn faceup: Riots/).click()
            await expect(refusal(page)).toHaveText(TIED)
            await expect(button(page, 'Play Riots')).toHaveCount(0)
            await shot(page, 'riots-facedown-refused', phone)

            await button(page, /^Discord/).click()
            await expect(refusal(page)).toHaveCount(0)
            await expect(button(page, 'Play Riots')).toBeEnabled()
            if (phone)
                expect(
                    (await button(page, 'Play Riots').boundingBox())?.height
                ).toBeGreaterThanOrEqual(44)
            await shot(page, 'riots-facedown-ready', phone)
        })
    })
}
