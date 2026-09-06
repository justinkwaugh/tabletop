import { expect, test } from '@playwright/test'

for (const scenario of [
    'runPrivateHandPlayAndUndo',
    'runPrivateHandDelivery',
    'runPrivateHandDrawAndReload',
    'runPrivateHandExploration',
    'runPrivateHandHostView',
    'runPrivateHandProtectedFallback'
] as const) {
    test(scenario, async ({ page }) => {
        await page.goto('/session-test.html')
        const result = await page.evaluate(async (name) => {
            const url = new URL(
                '/src/lib/model/tests/privateHandSession.fixture.ts',
                window.location.href
            ).href
            const fixture = await import(url)
            return fixture[name]()
        }, scenario)
        expect(Object.values(result).every((value) => value === true)).toBe(true)
    })
}
