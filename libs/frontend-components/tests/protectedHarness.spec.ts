import { expect, test } from '@playwright/test'

for (const scenario of [
    'runProtectedHarnessPlay',
    'runProtectedHarnessExploration',
    'runProtectedHarnessFallback'
]) {
    test(scenario, async ({ page }) => {
        await page.goto('/session-test.html')
        const result = await page.evaluate(async (name) => {
            const fixture = await import(
                new URL('/src/lib/model/tests/protectedHarness.fixture.ts', window.location.href)
                    .href
            )
            return fixture[name]()
        }, scenario)
        expect(Object.values(result).every((value) => value === true)).toBe(true)
    })
}

test('Protected controls replace the rendered table', async ({ page }) => {
    await page.goto('/session-test.html')
    await page.evaluate(async () => {
        const fixture = await import(
            new URL('/src/lib/model/tests/protectedHarness.fixture.ts', window.location.href).href
        )
        await fixture.mountProtectedHarness()
    })
    await page.getByRole('button', { name: 'Games', exact: true }).click()
    await page.getByText('Privacy test', { exact: true }).click()
    await expect(page.getByTestId('p1')).toHaveText('r1,b1')
    await expect(page.getByTestId('p2')).toHaveText('r2,b2')
    await page.getByRole('button', { name: 'Options' }).click()
    await page.getByLabel('Protected mode', { exact: true }).check()
    await page.getByRole('button', { name: 'Options' }).click()
    await expect(page.getByTestId('p1')).toHaveText('r1,b1')
    await expect(page.getByTestId('p2')).toHaveText('Hidden')
    await expect(page.getByTestId('deck')).toHaveText('0')
    await page.getByLabel('Protected view', { exact: true }).selectOption('p2')
    await expect(page.getByTestId('p1')).toHaveText('Hidden')
    await expect(page.getByTestId('p2')).toHaveText('r2,b2')
    await page.getByLabel('Protected view', { exact: true }).selectOption('host')
    await expect(page.getByTestId('p1')).toHaveText('r1,b1')
    await expect(page.getByTestId('deck')).toHaveText('2')
    await page.getByLabel('Protected view', { exact: true }).selectOption('spectator')
    await expect(page.getByTestId('p1')).toHaveText('Hidden')
    await expect(page.getByTestId('p2')).toHaveText('Hidden')
})
