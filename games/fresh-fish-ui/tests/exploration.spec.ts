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
