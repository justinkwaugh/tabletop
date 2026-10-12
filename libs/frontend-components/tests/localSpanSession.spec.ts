import { expect, test } from '@playwright/test'

for (const scenario of ['runLocalSpan', 'runProtectedLocalSpan']) {
    test(scenario, async ({ page }) => {
        await page.goto('/session-test.html')
        const result = await page.evaluate(async (name) => {
            const fixture = await import(
                new URL('/src/lib/model/tests/localSpanSession.fixture.ts', window.location.href)
                    .href
            )
            return fixture[name]()
        }, scenario)
        expect(Object.keys(result).length).toBeGreaterThan(0)
        expect(result).toEqual(Object.fromEntries(Object.keys(result).map((key) => [key, true])))
    })
}
