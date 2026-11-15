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
const tile = (page: Page, label: string) =>
    panel(page).locator('.majors button').filter({ hasText: label })

const SIZES = [
    { name: 'desktop', viewport: { width: 1280, height: 900 }, phone: false },
    { name: 'phone', viewport: { width: 375, height: 812 }, phone: true }
]

for (const { name, viewport, phone } of SIZES) {
    test.describe(`a Search from the menu, on a ${name}`, () => {
        test.use({ viewport, hasTouch: phone })

        // The tapped source's row is focused and pointed at when the draw replaces the menu: letting go of it
        // as it leaves the page reports no error.
        test('the draw replaces the menu and the console stays clean', async ({ page }) => {
            const errors: string[] = []
            page.on('pageerror', (error) => errors.push(error.message))
            page.on('console', (message) => {
                if (message.type() === 'error') errors.push(message.text())
            })
            await page.goto('/')
            await call(page, 'open', 'actPhase')
            await tile(page, 'Search').click()
            const sources = page.getByRole('list', { name: 'Sources to search' })
            await sources.getByRole('button').first().click()
            await expect(panel(page).getByText('Keep one.', { exact: true })).toBeVisible()
            await expect(sources).toHaveCount(0)
            expect(errors).toEqual([])
        })
    })
}
