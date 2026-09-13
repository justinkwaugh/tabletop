import { expect, test } from '@playwright/test'

test('queued changes retry conflicts without erasing concurrent fields', async ({ page }) => {
    await page.goto('/session-test.html')
    const result = await page.evaluate(async () => {
        const fixture = await import(
            new URL('/src/lib/preferences/tests/preferences.fixture.svelte.ts', location.href).href
        )
        return fixture.verifyQueuedPreferences()
    })
    expect(result).toEqual({
        values: { compact: false, sound: false },
        stored: { compact: false, sound: false },
        writes: 3,
        errors: []
    })
})

test('a late response from the previous account cannot change the new account', async ({
    page
}) => {
    await page.goto('/session-test.html')
    const result = await page.evaluate(async () => {
        const fixture = await import(
            new URL('/src/lib/preferences/tests/preferences.fixture.svelte.ts', location.href).href
        )
        return fixture.verifyPreferenceAccountChange()
    })
    expect(result).toEqual({ compact: false, sound: true })
})

test('a failed save rolls back the optimistic choice and reports the error', async ({ page }) => {
    await page.goto('/session-test.html')
    const result = await page.evaluate(async () => {
        const fixture = await import(
            new URL('/src/lib/preferences/tests/preferences.fixture.svelte.ts', location.href).href
        )
        return fixture.verifyFailedPreferenceWrite()
    })
    expect(result).toEqual({ optimistic: true, saved: false, errors: ['Save failed'] })
})

test('older hosts still allow a local display choice', async ({ page }) => {
    await page.goto('/session-test.html')
    const result = await page.evaluate(async () => {
        const fixture = await import(
            new URL('/src/lib/preferences/tests/preferences.fixture.svelte.ts', location.href).href
        )
        return fixture.verifyOlderHostPreferences()
    })
    expect(result).toEqual({ compact: true, sound: true })
})

test('leaving a game finishes a queued preference save for the same account', async ({ page }) => {
    await page.goto('/session-test.html')
    const result = await page.evaluate(async () => {
        const fixture = await import(
            new URL('/src/lib/preferences/tests/preferences.fixture.svelte.ts', location.href).href
        )
        return fixture.verifySaveAfterDisposal()
    })
    expect(result).toBe(true)
})
