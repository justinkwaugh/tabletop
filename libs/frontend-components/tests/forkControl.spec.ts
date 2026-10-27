import { expect, test } from '@playwright/test'

for (const { who, roles, disabled } of [
    { who: 'a player', roles: ['user'], disabled: 'true' },
    { who: 'a developer', roles: ['user', 'developer'], disabled: 'false' }
]) {
    test(`the Fork control of a protected hosted game is ${disabled === 'true' ? 'disabled' : 'enabled'} for ${who}`, async ({
        page
    }) => {
        await page.goto('/session-test.html')
        await page.evaluate(async (roles) => {
            const fixture = await import(
                new URL('/src/lib/model/tests/privateHandSession.fixture.ts', location.href).href
            )
            await fixture.mountForkControl(roles)
        }, roles)
        const fork = page.getByTestId('history-controls').getByRole('button', { name: 'fork game' })
        await expect(fork).toHaveAttribute('aria-disabled', disabled)
        await fork.dispatchEvent('click')
        await expect(page.getByText('Fork it!')).toHaveCount(disabled === 'true' ? 0 : 1)
    })
}
