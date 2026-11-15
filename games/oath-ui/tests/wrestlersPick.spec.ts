import { expect, test, type Locator, type Page } from '@playwright/test'
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
    await expect.poll(async () => (await call(page, 'tableFacts')).seatId).toBe('Ann')
}

async function layoutSize(locator: Locator) {
    return locator.evaluate((element) =>
        element instanceof HTMLElement
            ? { width: element.offsetWidth, height: element.offsetHeight }
            : { width: 0, height: 0 }
    )
}

const WRESTLERS = 'denizen.order.wrestlers'
const panel = (page: Page) => page.locator('.panel')
const card = (page: Page) =>
    panel(page).locator(`[data-card-row="${WRESTLERS}"] button[aria-pressed]`)
const picks = (page: Page) => panel(page).locator(`[data-plan-picks="${WRESTLERS}"]`)
const places = (page: Page) =>
    picks(page).getByRole('group', { name: 'the warband you sacrifice:' }).getByRole('button')
const place = (page: Page, name: string) => picks(page).getByRole('button', { name, exact: true })
const usePlans = (page: Page) => panel(page).getByRole('button', { name: 'Use plans', exact: true })
const undo = (page: Page) => page.getByRole('button', { name: 'Undo', exact: true })
const history = (page: Page) => page.locator('.history')
const imperialOn = async (page: Page, playerId: string) =>
    (await call(page, 'tableFacts')).boardOf[playerId]?.imperial ?? 0

const PLACES = ['at Plains', 'on your board', "on Rhys's board"]

const SIZES = [
    { name: 'desktop', viewport: { width: 1280, height: 900 }, phone: false },
    { name: 'phone', viewport: { width: 375, height: 812 }, phone: true }
]

async function shot(page: Page, name: string, phone: boolean) {
    await page.mouse.move(2, 2)
    await panel(page).screenshot({
        path: test.info().outputPath(`${name}-${phone ? 'phone' : 'desktop'}.png`)
    })
}

for (const { name, viewport, phone } of SIZES) {
    /**
     * R-10.22 — Dana (an Exile) campaigns against Ann (the Chancellor) at the Plains: the Empire's
     * two there, three on Ann's board, and two on the board of Rhys, a Citizen Ally at the Plains.
     */
    test.describe(`Wrestlers' sacrifice, on a ${name}`, () => {
        test.use({ viewport, hasTouch: phone })

        test('turning it on asks "the warband you sacrifice:" with one label-sized button per place, none picked', async ({
            page
        }) => {
            await openTable(page, 'wrestlersPick')
            await expect(picks(page)).toHaveCount(0)
            await card(page).click()
            await expect(card(page)).toHaveAttribute('aria-pressed', 'true')
            await expect(picks(page)).toContainText('Wrestlers:')
            await expect(picks(page)).toContainText('the warband you sacrifice:')
            await expect(places(page)).toHaveCount(PLACES.length)
            expect(
                await places(page).evaluateAll((buttons) =>
                    buttons.map((button) => button.getAttribute('aria-label'))
                )
            ).toEqual(PLACES)
            await expect(place(page, "on Rhys's board")).toContainText('Rhys')
            for (const label of PLACES)
                await expect(place(page, label)).toHaveAttribute('aria-pressed', 'false')
            await expect(usePlans(page)).toHaveCount(0)

            // Read from the layout: a tall step's panel is scaled to fit a phone.
            const sizes = []
            for (const label of PLACES) {
                const button = place(page, label)
                const overflow = await button.evaluate(
                    (element) => element.scrollWidth - element.clientWidth
                )
                expect(overflow).toBeLessThanOrEqual(0)
                sizes.push(await layoutSize(button))
            }
            const panelWidth = (await layoutSize(panel(page))).width
            for (const size of sizes) {
                expect(Math.abs(size.width - sizes[0].width)).toBeLessThanOrEqual(1)
                // Label-sized: never stretched across the panel.
                expect(size.width).toBeLessThan(panelWidth / 2)
                if (phone) expect(size.height).toBeGreaterThanOrEqual(44)
            }
            const pageOverflow = await page.evaluate(
                () => document.documentElement.scrollWidth - document.documentElement.clientWidth
            )
            expect(pageOverflow).toBeLessThanOrEqual(0)

            await place(page, 'on your board').click()
            await expect(place(page, 'on your board')).toHaveAttribute('aria-pressed', 'true')
            await expect(usePlans(page)).toBeVisible()
            await shot(page, 'wrestlers-pick', phone)
        })

        test('a second tap on another place moves the pick; "Use plans" sacrifices the one picked', async ({
            page
        }) => {
            await openTable(page, 'wrestlersPick')
            await card(page).click()
            await place(page, 'on your board').click()
            await place(page, "on Rhys's board").click()
            await expect(place(page, 'on your board')).toHaveAttribute('aria-pressed', 'false')
            await expect(place(page, "on Rhys's board")).toHaveAttribute('aria-pressed', 'true')
            expect(await imperialOn(page, 'Rhys')).toBe(2)
            await usePlans(page).click()
            await expect.poll(async () => imperialOn(page, 'Rhys')).toBe(1)
            expect(await imperialOn(page, 'Ann')).toBe(3)
        })

        test('a single place is picked already, and "Use plans" shows at once', async ({
            page
        }) => {
            await openTable(page, 'wrestlersOnePlace')
            await card(page).click()
            await expect(places(page)).toHaveCount(1)
            await expect(place(page, 'at Plains')).toHaveAttribute('aria-pressed', 'true')
            await expect(usePlans(page)).toBeVisible()
            await shot(page, 'wrestlers-one-place', phone)
        })

        test('Undo takes back the pick, then the plan', async ({ page }) => {
            await openTable(page, 'wrestlersPick')
            await card(page).click()
            await place(page, 'at Plains').click()
            await expect(usePlans(page)).toBeVisible()
            await undo(page).click()
            await expect(place(page, 'at Plains')).toHaveAttribute('aria-pressed', 'false')
            await expect(usePlans(page)).toHaveCount(0)
            await undo(page).click()
            await expect(card(page)).toHaveAttribute('aria-pressed', 'false')
            await expect(picks(page)).toHaveCount(0)
        })
    })
}

test.describe('the History of a Wrestlers sacrifice, on a desktop at 1280', () => {
    test("the defender's row names the place", async ({ page }) => {
        await openTable(page, 'wrestlersPick')
        await card(page).click()
        await place(page, "on Rhys's board").click()
        await usePlans(page).click()
        await expect.poll(async () => imperialOn(page, 'Rhys')).toBe(1)
        await page.getByRole('tab', { name: 'History' }).click()
        // The History draws "a warband" as one piece, as every row does: the skulls' loss and the sacrifice.
        const row = history(page).getByRole('listitem').filter({ hasText: 'used Wrestlers' })
        await expect(row).toContainText(
            /used Wrestlers; 5 swords against 7 defense;\s*you\s*lost 1\s*to skulls; sacrificed 1\s*on\s*Rhys's\s*board\s*\(Wrestlers\)/
        )
        await expect(row.getByRole('img', { name: 'warband' })).toHaveCount(2)
    })
})
