import { expect, test } from '@playwright/test'

test('hotseat island bidding resets the bid amount for the next player', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(async () => {
        const fixture = await import(
            new URL('/src/lib/model/tests/protectedHarness.fixture.ts', location.href).href
        )
        await fixture.saveProtectedHarnessGame(true)
    })
    await page.reload()
    await page.getByRole('button', { name: 'Games', exact: true }).click()
    await page.getByText('Protected Kaivai', { exact: true }).click()
    const amount = page.getByRole('button', { name: '+', exact: true }).locator('..').locator('> h1')
    await expect(amount).toHaveText('0')
    await page.getByRole('button', { name: '+', exact: true }).click()
    await expect(amount).toHaveText('1')
    await page.getByRole('button', { name: 'Submit', exact: true }).click()
    await expect(amount).toHaveText('0')
    await expect(page.getByRole('button', { name: 'Submit', exact: true })).toBeEnabled()
    await page.getByRole('button', { name: '+', exact: true }).click()
    await page.getByRole('button', { name: '+', exact: true }).click()
    await expect(amount).toHaveText('2')
    await page.getByRole('button', { name: 'Submit', exact: true }).click()
    await expect(amount).toHaveText('0')
    await expect(page.getByRole('button', { name: 'Submit', exact: true })).toBeEnabled()
})

for (const scoring of [false, true]) {
    test(`Kaivai protected harness supports ${scoring ? 'scoring' : 'ordinary'} bidding`, async ({
        page
    }) => {
        const errors: string[] = []
        page.on('pageerror', (error) => errors.push(error.message))
        await page.goto('/')
        const playerId = await page.evaluate(async (scoring) => {
            const fixture = await import(
                new URL('/src/lib/model/tests/protectedHarness.fixture.ts', location.href).href
            )
            return fixture.saveProtectedHarnessGame(scoring)
        }, scoring)
        await page.reload()
        await page.getByRole('button', { name: 'Games', exact: true }).click()
        await page.getByText('Protected Kaivai', { exact: true }).click()
        await page.getByRole('button', { name: 'Options', exact: true }).click()
        await page.getByText('Protected mode', { exact: true }).click()
        await page.getByRole('button', { name: 'Options', exact: true }).click()
        const perspective = page.getByLabel('Protected view', { exact: true })
        await perspective.selectOption(playerId)
        const instruction = page.getByText(
            scoring ? 'How much influence do you want to bid?' : 'Place your bid',
            { exact: true }
        )
        await expect(instruction).toBeVisible()
        await perspective.selectOption('spectator')
        await expect(instruction).toHaveCount(0)
        await perspective.selectOption('host')
        await expect(instruction).toBeVisible()
        await perspective.selectOption(playerId)
        await expect(instruction).toBeVisible()
        if (scoring) {
            await page.getByRole('button', { name: 'Submit', exact: true }).click()
            await expect(
                page.getByText("Collecting other players' bids...", { exact: true })
            ).toBeVisible()
            await perspective.selectOption('p2')
            await expect(instruction).toBeVisible()
            await page.getByRole('button', { name: 'Submit', exact: true }).click()
            await perspective.selectOption('p3')
            await expect(instruction).toBeVisible()
            await page.getByRole('button', { name: 'Submit', exact: true }).click()
            await expect(instruction).toHaveCount(0)
        }
        expect(errors).toEqual([])
    })
}
