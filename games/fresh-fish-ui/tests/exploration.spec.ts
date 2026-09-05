import { expect, test } from '@playwright/test'

for (const scenario of [
    'runExplorationHistory',
    'runSafeExplorationUndo',
    'runPartialExploration',
    'runPrivilegedExploration',
    'runSimulatedAuction'
]) {
    test(scenario, async ({ page }) => {
        await page.goto('/')
        const result = await page.evaluate(async (name) => {
            const url = new URL(
                '/src/lib/stores/tests/exploration.fixture.ts',
                window.location.href
            ).href
            const fixture = await import(url)
            return fixture[name]()
        }, scenario)
        if (scenario === 'runPartialExploration') {
            expect(result).toEqual({
                sourcePhase: 'StallTileDrawn',
                phase: 'AuctioningTile',
                sameTile: true,
                sameCount: true,
                undoBlocked: true
            })
        } else {
            for (const value of Object.values(result))
                expect(value, JSON.stringify(result)).toBe(true)
        }
    })
}

test('recovers the primary game during Exploration without changing the sample', async ({
    page
}) => {
    await page.goto('/')
    const result = await page.evaluate(async () => {
        const moduleUrl = new URL(
            '/src/lib/stores/tests/exploration.fixture.ts',
            window.location.href
        ).href
        const scenario = await import(moduleUrl)
        return await scenario.runExplorationRecovery()
    })
    expect(result).toEqual({
        syncRequests: 1,
        branchUnchanged: true,
        returnedToCurrentGame: true,
        stillProjected: true
    })
})

for (const hostView of [true, false]) {
    test(`retains notifications arriving during a ${hostView ? 'host' : 'ordinary'} representation load`, async ({
        page
    }) => {
        await page.goto('/')
        const result = await page.evaluate(async (hostView) => {
            const moduleUrl = new URL(
                '/src/lib/stores/tests/exploration.fixture.ts',
                window.location.href
            ).href
            const scenario = await import(moduleUrl)
            return await scenario.runRepresentationRecovery(hostView)
        }, hostView)
        expect(result).toEqual({ current: true, correctView: true, correctBag: true })
    })
}
