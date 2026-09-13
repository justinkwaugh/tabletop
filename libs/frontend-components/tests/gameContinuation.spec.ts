import { expect, test } from '@playwright/test'

for (const failFirst of [false, true]) {
    test(`local continuation preserves one independent successor${failFirst ? ' after a failed attempt' : ''}`, async ({
        page
    }) => {
        await page.goto('/session-test.html')
        const result = await page.evaluate(async (failFirst) => {
            const fixture = await import(
                new URL('/src/lib/model/tests/gameContinuation.fixture.ts', location.href).href
            )
            return fixture.continueLocalGame(failFirst)
        }, failFirst)
        expect(result.initializations).toBe(1)
        expect(result.sameSuccessor).toBe(true)
        expect(result.linkPreserved).toBe(true)
        expect(result.sourceCanContinue).toBe(false)
        expect(result.sourceStatus).toBe('started')
        expect(result.actions).toEqual([])
        expect(result.nextState).toMatchObject({
            secretBonus: 9,
            actionCount: 0,
            actionChecksum: 0,
            winningPlayerIds: []
        })
        expect(result.nextState.result).toBeUndefined()
        if (failFirst) expect(result.failedWithoutLink).toBe(true)
    })
}
