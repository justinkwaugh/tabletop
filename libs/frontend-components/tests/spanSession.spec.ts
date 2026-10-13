import { expect, test } from '@playwright/test'

const scenarios = {
    localSpanSession: ['runLocalSpan', 'runProtectedLocalSpan'],
    hostedSpanSession: [
        'runHostedSpanPlay',
        'runHostedSpanMerges',
        'runHostedSpanReload',
        'runHostedSpanBarrier',
        'runHostedSpanNextSpan',
        'runHostedSpanFollowsNextSpan',
        'runHostedSpanSyncFailure',
        'runHostedSpanFork',
        'runHostedSpanSecondSession',
        'runHostedSpanReopen',
        'runHostedSpanClosesCross',
        'runJoinedHistoryGrowth',
        'runHostedSpanBeginsWhileAnimating',
        'runHostedSpanLateBranchUpdates',
        'runHostedSpanUndoBehindTheMainLine',
        'runHostedSpanReopenBehindTheMainLine'
    ]
}

for (const [fixture, names] of Object.entries(scenarios)) {
    for (const name of names) {
        test(name, async ({ page }) => {
            await page.goto('/session-test.html')
            const result = await page.evaluate(
                async ([file, scenario]) => {
                    const module = await import(
                        new URL(`/src/lib/model/tests/${file}.fixture.ts`, window.location.href)
                            .href
                    )
                    return module[scenario]()
                },
                [fixture, name]
            )
            expect(Object.keys(result).length).toBeGreaterThan(0)
            expect(result).toEqual(
                Object.fromEntries(Object.keys(result).map((key) => [key, true]))
            )
        })
    }
}
