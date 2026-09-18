import { expect, test } from '@playwright/test'

for (const fast of [false, true]) {
    test(`history controls: ${fast ? 'fast load stays blank' : 'delayed indicator replaces controls'}`, async ({
        page
    }) => {
        await page.goto('/session-test.html')
        await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') })
        await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'))
        await page.evaluate(async () => {
            const fixture = await import(
                new URL('/src/lib/model/tests/privateHandSession.fixture.ts', location.href).href
            )
            await fixture.mountHistoryControls()
        })
        const controls = page.getByTestId('history-controls')
        await expect(controls.getByRole('button')).toHaveCount(0)
        await expect(controls).not.toContainText('Loading history...')
        await page.clock.runFor(299)
        await expect(controls).not.toContainText('Loading history...')
        if (!fast) {
            await page.clock.runFor(1)
            await expect(controls.getByRole('status')).toHaveText('Loading history...')
            await expect(controls.getByRole('status')).toHaveClass(/text-orange-400/)
            await expect(controls.locator('svg')).toHaveAttribute('aria-hidden', 'true')
            await expect(controls.getByRole('button')).toHaveCount(0)
        }
        await page.getByRole('button', { name: 'Complete history' }).click()
        await page.clock.runFor(1000)
        await expect(controls).not.toContainText('Loading history...')
        await expect(controls.getByRole('button', { name: 'go to current' })).toBeVisible()
    })
}
