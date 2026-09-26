import { expect, test } from '@playwright/test'

test('game contexts normalize stored config on load, clone and refresh without modifying inputs', async ({
    page
}) => {
    await page.goto('/session-test.html')
    const result = await page.evaluate(async () => {
        const fixture = await import(
            new URL('/src/lib/model/tests/configNormalization.fixture.ts', window.location.href)
                .href
        )
        return fixture.normalizedClientContexts()
    })
    expect(result).toEqual({
        loaded: { enabled: true },
        cloned: { enabled: false },
        cloneFrozen: { game: true, config: true },
        refreshed: { enabled: false },
        original: { legacyEnabled: true },
        updateInput: { legacyEnabled: false },
        oldArtifact: { retained: null }
    })
})
