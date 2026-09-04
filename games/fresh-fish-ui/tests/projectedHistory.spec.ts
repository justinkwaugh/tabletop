import { expect, test } from '@playwright/test'

test('projected History round-trips a completed simultaneous auction', async ({ page }) => {
    await page.goto('/')

    const result = await page.evaluate(async () => {
        const moduleUrl = new URL(
            '/src/lib/stores/tests/projectedHistory.fixture.ts',
            window.location.href
        ).href
        const scenario = await import(moduleUrl)
        return await scenario.runProjectedHistoryRoundTrip()
    })

    expect(result.canonicalStillContainsHiddenTile).toBe(true)
    expect(result.iterations).toHaveLength(3)
    for (const iteration of result.iterations) {
        expect(iteration.backward.difference).toBeUndefined()
        expect(iteration.backward).toEqual({
            inHistory: true,
            actionIndex: -1,
            stateMatches: true,
            difference: undefined,
            containsCanonicalTile: false
        })
        expect(iteration.forward).toEqual({
            inHistory: false,
            stateMatches: true,
            containsCanonicalTile: false
        })
    }
})
