import { expect, test } from '@playwright/test'

test('Fresh Fish renders and discovers legal moves in the protected harness', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/')
    const playerId = await page.evaluate(async () => {
        const fixture = await import(
            new URL('/src/lib/stores/tests/exploration.fixture.ts', location.href).href
        )
        return fixture.saveProtectedHarnessGame()
    })
    await page.reload()
    await page.getByRole('button', { name: 'Games', exact: true }).click()
    await page.getByText('Protected Fresh Fish', { exact: true }).click()
    await expect(page.getByText('Please place your disk', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Options' }).click()
    await page.getByText('Protected mode', { exact: true }).click()
    await page.getByRole('button', { name: 'Options' }).click()
    await expect(page.getByLabel('Protected view', { exact: true })).toHaveValue(playerId)
    await expect(page.getByText('Please place your disk', { exact: true })).toBeVisible()
    await page.getByLabel('Protected view', { exact: true }).selectOption('spectator')
    await expect(page.getByText('Please place your disk', { exact: true })).toHaveCount(0)
    await page.getByLabel('Protected view', { exact: true }).selectOption('host')
    await expect(page.getByText('Please place your disk', { exact: true })).toBeVisible()
    await page.getByLabel('Protected view', { exact: true }).selectOption(playerId)
    await expect(page.getByText('Please place your disk', { exact: true })).toBeVisible()
    expect(errors).toEqual([])
})

test('reproduction seed survives harness creation and IndexedDB reload', async ({ page }) => {
    await page.goto('/')
    const { first, second } = await page.evaluate(async () => {
        const fixture = await import(
            new URL('/src/lib/stores/tests/exploration.fixture.ts', location.href).href
        )
        return fixture.reproduceHarnessGame()
    })
    expect(first).toEqual(second)
    expect(first.masterSeed).toBe('0123456789abcdef0123456789abcdef')
    expect(first.boardSeed).toBe(0)
    expect(first.protectedPrng.algorithm).toBe('chacha20-v1')
})
