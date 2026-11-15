import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 390, height: 700 } })

test('a visually hidden label at the right of the scrolled game column keeps the page to the screen width', async ({
    page
}) => {
    await page.goto('/session-test.html')
    await page.evaluate(async () => {
        const fixture = await import(
            new URL('/src/lib/model/tests/privateHandSession.fixture.ts', location.href).href
        )
        await fixture.mountTableLayout()
    })
    await expect(page.getByTestId('hidden-label').locator('..')).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
})
