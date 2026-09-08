import { expect, test } from '@playwright/test'

for (const projected of [true, false]) {
    for (const busyReason of ['processing', 'presentation'] as const) {
        test(`queues a ${projected ? 'projected' : 'legacy'} Undo during ${busyReason}`, async ({
            page
        }) => {
            await page.goto('/')
            const result = await page.evaluate(
                async ({ busyReason, projected }) => {
                    const moduleUrl = new URL(
                        '/src/lib/stores/tests/projectedHistory.fixture.ts',
                        window.location.href
                    ).href
                    const scenario = await import(moduleUrl)
                    return await scenario.runBusyUndo(busyReason, 'none', projected)
                },
                { busyReason, projected }
            )
            expect(result.busyDuringDelivery).toBe(true)
            expect(result.unchangedWhileBusy).toBe(true)
            expect(result.actualActionIds).toEqual(result.expectedActionIds)
            expect(result.stateMatches).toBe(true)
            expect(result.metadataMatches).toBe(true)
            expect(result.syncRequests).toBe(0)
        })
    }
}

for (const recovery of ['corruptReplay', 'discontinuity'] as const) {
    test(`recovers queued projected updates after ${recovery}`, async ({ page }) => {
        await page.goto('/')
        const result = await page.evaluate(async (recovery) => {
            const moduleUrl = new URL(
                '/src/lib/stores/tests/projectedHistory.fixture.ts',
                window.location.href
            ).href
            const scenario = await import(moduleUrl)
            return await scenario.runBusyUndo('processing', recovery)
        }, recovery)
        expect(result.unchangedWhileBusy).toBe(true)
        expect(result.syncRequests).toBe(1)
        expect(result.actualActionIds).toEqual(result.expectedActionIds)
        expect(result.stateMatches).toBe(true)
        expect(result.metadataMatches).toBe(true)
    })
}

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

test('continues play and recent History after a historical schema change', async ({ page }) => {
    await page.goto('/')
    const result = await page.evaluate(async () => {
        const moduleUrl = new URL(
            '/src/lib/stores/tests/projectedHistory.fixture.ts',
            window.location.href
        ).href
        const scenario = await import(moduleUrl)
        return await scenario.runIncompatibleHistory()
    })
    expect(result.initialHasHistory).toBe(false)
    expect(result.forwardDifference).toBeUndefined()
    expect(result.forwardMatches).toBe(true)
    expect(result.undoCandidate).toBe('new-bid-b')
    expect(result.boundary).toEqual({ index: 0, count: 1, hasPrevious: false })
    expect(result.undoMatches).toBe(true)
    expect(result.undoCount).toBe(1)
    expect(result.syncRequests).toBeGreaterThan(0)
    expect(result.reloads).toBe(0)
    expect(result.finalMatches).toBe(true)
    expect(result.finalCount).toBe(2)
    expect(result.finalActionId).toBe('next-bid-b')
    expect(result.containsHiddenBag).toBe(false)
})
