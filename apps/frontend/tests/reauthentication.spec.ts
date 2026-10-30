import { expect, test, type Page } from '@playwright/test'
import { mockLibrary } from './fixtures/library'

const user = {
    id: 'confirmation-player',
    username: 'confirmation-player',
    email: 'confirmation@example.test',
    emailVerified: true,
    status: 'active',
    roles: ['user'],
    externalIds: [],
    timeZone: 'UTC',
    hasPassword: true
}

async function requireConfirmation(page: Page) {
    await page.route('**/api/v1/auth/discord/begin/link', (route) =>
        route.fulfill({
            status: 403,
            json: {
                error: {
                    name: 'RecentAuthenticationRequiredError',
                    message: 'Confirm your identity'
                }
            }
        })
    )
    await page.getByRole('button', { name: 'Link', exact: true }).click()
    const prompt = page.getByRole('dialog', { name: "Confirm it's you" })
    await expect(prompt).toBeVisible()
    return prompt
}

test.beforeEach(async ({ page, context }) => {
    await context.route('https://discord.com/**', (route) => route.abort())
    await context.route('https://accounts.google.com/**', (route) => route.abort())
    await context.route('**/api/v1/**', (route) => route.fulfill({ json: { payload: {} } }))
    await context.route('**/api/v1/manifest', (route) =>
        route.fulfill({ json: { payload: { frontend: { version: '24.7.0' }, games: [] } } })
    )
    await mockLibrary(page)
    await page.route('**/api/v1/user/self', (route) =>
        route.fulfill({ json: { payload: { user } } })
    )
    await page.goto('/profile')
})

test('Discord linking waits for a Continue click after identity confirmation', async ({
    page,
    context
}) => {
    const popups: Page[] = []
    page.on('popup', (popup) => popups.push(popup))
    const prompt = await requireConfirmation(page)
    expect(popups).toHaveLength(0)
    let starts = 0
    await page.route('**/api/v1/auth/discord/begin/link', (route) => {
        starts += 1
        return route.fulfill({
            json: {
                payload: {
                    state: 'link.confirmed-attempt',
                    authorizationUrl: new URL(
                        '/oauth/discord/link?code=synthetic&state=link.confirmed-attempt',
                        page.url()
                    ).href,
                    expiresInSeconds: 600
                }
            }
        })
    })
    await context.route('**/api/v1/auth/discord/link', (route) =>
        route.fulfill({
            json: { payload: { user: { ...user, externalIds: ['discord:linked'] } } }
        })
    )
    await page.route('**/api/v1/auth/reauthenticate', (route) =>
        route.fulfill({ json: { payload: {} } })
    )
    await prompt.getByLabel('Password', { exact: true }).fill('synthetic-password')
    await prompt.getByRole('button', { name: 'Confirm', exact: true }).click()
    await expect(prompt.getByText('Your identity is confirmed.', { exact: false })).toBeVisible()
    expect(starts).toBe(0)

    const popup = page.waitForEvent('popup')
    await prompt.getByRole('button', { name: 'Continue', exact: true }).click()
    const authorization = await popup
    await expect(page.getByRole('button', { name: 'Unlink', exact: true })).toBeVisible()
    await expect(prompt).toHaveCount(0)
    expect(starts).toBe(1)
    expect(popups).toHaveLength(1)
    await authorization.close()
})

test('a late password confirmation cannot complete the replacement prompt', async ({ page }) => {
    const response = Promise.withResolvers<void>()
    const requested = Promise.withResolvers<void>()
    await page.route('**/api/v1/auth/reauthenticate', async (route) => {
        requested.resolve()
        await response.promise
        await route.fulfill({ json: { payload: {} } })
    })
    const oldPrompt = await requireConfirmation(page)
    await oldPrompt.getByLabel('Password', { exact: true }).fill('synthetic-password')
    await oldPrompt.getByRole('button', { name: 'Confirm', exact: true }).click()
    await requested.promise
    await oldPrompt.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(oldPrompt).toHaveCount(0)
    const replacement = await requireConfirmation(page)

    const completed = page.waitForResponse('**/api/v1/auth/reauthenticate')
    response.resolve()
    await (await completed).finished()
    await page.evaluate(() => new Promise(requestAnimationFrame))
    await expect(replacement.getByLabel('Password', { exact: true })).toBeVisible()
    await expect(replacement.getByRole('button', { name: 'Continue', exact: true })).toHaveCount(0)
    await expect(replacement.getByRole('button', { name: 'Confirm', exact: true })).toBeEnabled()
})

test('a logout broadcast dismisses confirmation before the logout request completes', async ({
    page
}) => {
    const response = Promise.withResolvers<void>()
    const requested = Promise.withResolvers<void>()
    await page.route('**/api/v1/auth/logout', async (route) => {
        requested.resolve()
        await response.promise
        await route.fulfill({ json: { payload: {} } })
    })
    const prompt = await requireConfirmation(page)
    await page.evaluate(() => {
        const channel = new BroadcastChannel('logout')
        channel.postMessage({})
        channel.close()
    })
    await requested.promise
    await expect(prompt).toHaveCount(0)
    response.resolve()
    await expect(page).toHaveURL(/\/$/)
})
