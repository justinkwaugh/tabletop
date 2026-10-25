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

const grid = (page: Page) => page.locator('.panel')
const history = (page: Page) => page.locator('.history')
const play = (page: Page) =>
    grid(page).getByRole('button', { name: 'Play Conspiracy', exact: true })
const rhys = (page: Page) => grid(page).getByRole('button', { name: /^rhys$/i })

/** R-6.1 — the seat's one facedown adviser, the Conspiracy, opened for its take. */
async function openTake(page: Page) {
    await page.goto('/')
    await call(page, 'open', 'flipConspiracy')
    await grid(page).getByRole('button', { name: 'Adviser', exact: true }).click()
    // The one facedown adviser opens at once, large beside its plays.
    await grid(page).getByRole('button', { name: 'Play it: Conspiracy', exact: true }).click()
    await expect(grid(page).getByText('From:', { exact: true })).toBeVisible()
}

async function shot(page: Page, name: string, size: string) {
    await page.mouse.move(2, 2)
    await page.waitForTimeout(300)
    await page.screenshot({ path: test.info().outputPath(`${name}-${size}.png`) })
}

/** The History tab opened, newest row first; its words with the chips' spacing closed up. */
async function historyText(page: Page) {
    const tab = page.getByRole('tab', { name: 'History' })
    await tab.scrollIntoViewIfNeeded()
    await tab.click()
    await expect(history(page)).toContainText('played the Conspiracy')
    return (await history(page).innerText()).replace(/\s+/g, ' ')
}

const SIZES = [
    { name: 'desktop', viewport: { width: 1280, height: 900 } },
    { name: 'phone', viewport: { width: 375, height: 812 } }
]

for (const { name, viewport } of SIZES) {
    test.describe(`the facedown Conspiracy's take, on a ${name}`, () => {
        test.use({ viewport })

        test('"Play" shows with nobody picked, hides with a player alone, and shows with a prize; History names the relic and the seat', async ({
            page
        }) => {
            await openTake(page)
            await expect(rhys(page)).toHaveAttribute('aria-pressed', 'false')
            await expect(play(page)).toBeVisible()

            await rhys(page).click()
            await expect(rhys(page)).toHaveAttribute('aria-pressed', 'true')
            await expect(play(page)).toHaveCount(0)
            await expect(grid(page).locator('.text-oath-danger')).toHaveCount(0)
            await shot(page, 'conspiracy-target-no-prize', name)

            await grid(page).getByRole('button', { name: 'Cup of Plenty', exact: true }).click()
            await expect(play(page)).toBeVisible()
            await shot(page, 'conspiracy-target-and-prize', name)

            await play(page).click()
            await expect(play(page)).toHaveCount(0)
            expect(await historyText(page)).toMatch(
                /played the Conspiracy; took Cup of Plenty from rhys/i
            )
            await page.mouse.move(2, 2)
            await history(page).screenshot({
                path: test.info().outputPath(`conspiracy-history-take-${name}.png`)
            })
        })

        test('a banner taken reads as seized from the seat', async ({ page }) => {
            await openTake(page)
            await rhys(page).click()
            await grid(page)
                .getByRole('button', { name: 'the People’s Favor', exact: true })
                .click()
            await play(page).click()
            await expect(play(page)).toHaveCount(0)
            expect(await historyText(page)).toMatch(
                /played the Conspiracy; seized the People’s Favor from rhys/i
            )
        })

        test('dropping the player makes "Play" a decline again; History reads "played the Conspiracy" alone', async ({
            page
        }) => {
            await openTake(page)
            await rhys(page).click()
            await expect(play(page)).toHaveCount(0)
            await rhys(page).click()
            await expect(rhys(page)).toHaveAttribute('aria-pressed', 'false')
            await expect(play(page)).toBeVisible()

            await play(page).click()
            await expect(play(page)).toHaveCount(0)
            const text = await historyText(page)
            expect(text).toMatch(/played the Conspiracy/)
            expect(text).not.toMatch(/took|seized/)
            await page.mouse.move(2, 2)
            await history(page).screenshot({
                path: test.info().outputPath(`conspiracy-history-decline-${name}.png`)
            })
        })
    })
}
