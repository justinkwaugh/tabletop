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

const panel = (page: Page) => page.locator('.panel')
const card = (page: Page, name: string) =>
    panel(page).locator(`button:not(.magnifier):has(img[alt="${name}"])`)
const discard = (page: Page) => panel(page).getByRole('button', { name: 'Discard', exact: true })

type StackTable = 'questionStackUnderTop' | 'questionStackOlderGame' | 'questionStackPlain'

async function asked(page: Page, table: StackTable) {
    await page.goto('/')
    await call(page, 'open', table)
    await expect.poll(async () => (await call(page, 'tableFacts')).seatId).toBe('Dana')
    await expect(
        panel(page).getByText('Tap to discard, bottom first.', { exact: true })
    ).toBeVisible()
    await expect(
        panel(page).getByText('Tap to discard; the last goes on top.', { exact: true })
    ).toHaveCount(0)
    await expect(card(page, 'Scouts')).toHaveText('')
    await expect(card(page, 'Wayside Inn')).toHaveText('')
    await expect(discard(page)).toHaveCount(0)
}

const SIZES = [
    { name: 'desktop', viewport: { width: 1280, height: 900 }, phone: false },
    { name: 'phone', viewport: { width: 375, height: 812 }, phone: true }
] as const

for (const { name, viewport, phone } of SIZES) {
    test.describe(`the order question's last card, at ${viewport.width} × ${viewport.height}`, () => {
        test.use({ viewport, hasTouch: phone })

        test('Land Warden, with Tents already on the pile from the second card: "under top"', async ({
            page
        }) => {
            await asked(page, 'questionStackUnderTop')
            await card(page, 'Wayside Inn').click()
            await expect(card(page, 'Wayside Inn')).toHaveText('bottom')
            await expect(card(page, 'Scouts')).toHaveText('under top')
            await expect(discard(page)).toBeVisible()
            await page.screenshot({ path: test.info().outputPath(`stack-under-top-${name}.png`) })
        })

        test('the same in a revision 32 game: "on top"', async ({ page }) => {
            await asked(page, 'questionStackOlderGame')
            await card(page, 'Wayside Inn').click()
            await expect(card(page, 'Scouts')).toHaveText('on top')
        })

        test('no Land Warden: "on top"', async ({ page }) => {
            await asked(page, 'questionStackPlain')
            await card(page, 'Wayside Inn').click()
            await expect(card(page, 'Wayside Inn')).toHaveText('bottom')
            await expect(card(page, 'Scouts')).toHaveText('on top')
            await expect(discard(page)).toBeVisible()
            await page.screenshot({ path: test.info().outputPath(`stack-plain-${name}.png`) })
        })
    })
}
