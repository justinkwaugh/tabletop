import { chromium, firefox, expect, test } from '@playwright/test'

for (const browserType of [chromium, firefox]) {
    test(`${browserType.name()}: previous player turn works immediately from Live View`, async ({ baseURL }) => {
        const browser = await browserType.launch()
        try {
            const page = await browser.newPage({ baseURL })
            await page.goto('/session-test.html')
            for (const deferred of [true, false]) {
                for (const stepFirst of [false, true]) {
                    const result = await page.evaluate(async ({ first, deferred }) => {
                        const fixture = await import(new URL('/src/lib/model/tests/historyNavigation.fixture.ts', location.href).href)
                        return fixture.previousPlayerTurnFromLive(first, deferred)
                    }, { first: stepFirst, deferred })
                    expect(result).toEqual({
                        inHistory: true,
                        actionIndex: stepFirst ? -1 : 0,
                        count: stepFirst ? 0 : 1
                    })
                }
            }
        } finally {
            await browser.close()
        }
    })
}

for (const scenario of [
    {
        name: 'stops at the end after skipping the last matching action',
        skipping: 'first',
        destination: { inHistory: true, actionIndex: 1, count: 2 }
    },
    {
        name: 'exits history when all remaining actions are automatic',
        skipping: 'all',
        destination: { inHistory: false, actionIndex: 0, count: 2 }
    },
    {
        name: 'stops at a matching action before the end',
        skipping: 'none',
        destination: { inHistory: true, actionIndex: 0, count: 1 }
    }
] as const) {
    test(`next player turn ${scenario.name}`, async ({ page }) => {
        await page.goto('/session-test.html')
        const result = await page.evaluate(async (skipping) => {
            const fixture = await import(
                new URL('/src/lib/model/tests/historyNavigation.fixture.ts', location.href).href
            )
            return fixture.navigatePlayerTurn(skipping)
        }, scenario.skipping)
        expect(result).toEqual({ destination: scenario.destination, beginningCount: 0 })
    })
}
