import { expect, test, type Page } from '@playwright/test'
import { Role, UserStatus, type User } from '@tabletop/common'
import { mockLibrary } from './fixtures/library'

const user: User = {
    id: 'confirmation-player',
    username: 'confirmation-player',
    email: 'confirmation@example.test',
    emailVerified: true,
    status: UserStatus.Active,
    roles: [Role.User],
    externalIds: [],
    timeZone: 'UTC',
    hasPassword: true
}

async function profileSubmissions(page: Page, { recent = false, account = user } = {}) {
    const submissions: unknown[] = []
    let current = account
    let pending: { email: string; expiresAt: string } | null = null
    const confirm = () => {
        recent = true
    }
    await page.route('**/api/v1/user/self', (route) =>
        route.fulfill({ json: { payload: { user: current } } })
    )
    await page.route('**/api/v1/user/update', (route) => {
        const fields: { password?: string; username?: string } = route.request().postDataJSON()
        submissions.push(fields)
        if (fields.password && !recent) {
            return route.fulfill({
                status: 403,
                json: {
                    error: {
                        name: 'RecentAuthenticationRequiredError',
                        message: 'This operation requires Recent Authentication'
                    }
                }
            })
        }
        current = {
            ...current,
            ...(fields.username ? { username: fields.username } : {}),
            ...(fields.password ? { hasPassword: true } : {})
        }
        return route.fulfill({ json: { payload: { user: current } } })
    })
    await page.route('**/api/v1/user/email/change', (route) => {
        if (route.request().method() === 'DELETE') pending = null
        if (route.request().method() === 'POST') {
            const fields: { email: string } = route.request().postDataJSON()
            submissions.push(fields)
            if (!recent)
                return route.fulfill({
                    status: 403,
                    json: {
                        error: {
                            name: 'RecentAuthenticationRequiredError',
                            message: 'Confirm your identity'
                        }
                    }
                })
            pending = {
                email: fields.email,
                expiresAt: new Date(Date.now() + 900_000).toISOString()
            }
        }
        return route.fulfill({ json: { payload: { pending } } })
    })
    await page.route('**/api/v1/user/email/change/confirm', (route) => {
        const fields: { email: string; code: string } = route.request().postDataJSON()
        if (!pending || fields.email !== pending.email || fields.code !== 'mail-code') {
            return route.fulfill({
                status: 400,
                json: { error: { name: 'InvalidChallengeError', message: 'Invalid code' } }
            })
        }
        current = { ...current, email: pending.email }
        pending = null
        return route.fulfill({ json: { payload: { user: current } } })
    })
    await page.route('**/api/v1/auth/reauthenticate', (route) => {
        confirm()
        return route.fulfill({ json: { payload: {} } })
    })
    await page.reload()
    return { submissions, confirm }
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

test('throttled password confirmation explains when to retry', async ({ page }) => {
    await page.route('**/api/v1/auth/reauthenticate', (route) =>
        route.fulfill({
            status: 429,
            headers: { 'retry-after': '60', 'access-control-expose-headers': 'Retry-After' },
            json: {
                error: {
                    name: 'BudgetExceededError',
                    message: 'Too many login attempts, retry in 60 seconds'
                }
            }
        })
    )
    const prompt = await requireConfirmation(page)
    await prompt.getByLabel('Password', { exact: true }).fill('correct-synthetic-password')
    await prompt.getByRole('button', { name: 'Confirm', exact: true }).click()
    await expect(
        prompt.getByText('Too many confirmation attempts. Try again in 60 seconds.', {
            exact: true
        })
    ).toBeVisible()
    await expect(prompt.getByText('That password was not accepted.', { exact: true })).toHaveCount(
        0
    )
})

test('a failed confirmation request does not blame the password', async ({ page }) => {
    await page.route('**/api/v1/auth/reauthenticate', (route) => route.abort('failed'))
    const prompt = await requireConfirmation(page)
    await prompt.getByLabel('Password', { exact: true }).fill('correct-synthetic-password')
    await prompt.getByRole('button', { name: 'Confirm', exact: true }).click()
    await expect(
        prompt.getByText('We could not confirm your identity. Please try again.', { exact: true })
    ).toBeVisible()
})

test('a revoked session during confirmation returns to sign-in', async ({ page }) => {
    await page.route('**/api/v1/auth/reauthenticate', (route) =>
        route.fulfill({
            status: 401,
            json: { error: { name: 'Error', message: 'Session is not live' } }
        })
    )
    const prompt = await requireConfirmation(page)
    await page.route('**/api/v1/user/self', (route) => route.fulfill({ status: 401 }))
    await prompt.getByLabel('Password', { exact: true }).fill('correct-synthetic-password')
    await prompt.getByRole('button', { name: 'Confirm', exact: true }).click()
    await expect(page).toHaveURL(/\/login$/)
    await expect(prompt).toHaveCount(0)
})

test('expired confirmation on Continue asks again without opening a popup', async ({ page }) => {
    const popups: Page[] = []
    page.on('popup', (popup) => popups.push(popup))
    await page.route('**/api/v1/auth/reauthenticate', (route) =>
        route.fulfill({ json: { payload: {} } })
    )
    const prompt = await requireConfirmation(page)
    await prompt.getByLabel('Password', { exact: true }).fill('correct-synthetic-password')
    await prompt.getByRole('button', { name: 'Confirm', exact: true }).click()
    await expect(prompt.getByRole('button', { name: 'Continue', exact: true })).toBeVisible()
    await prompt.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(prompt.getByLabel('Password', { exact: true })).toBeVisible()
    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0)
    expect(popups).toHaveLength(0)
})

test('leaving Notifications cancels its pending link', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Edit your profile...' })).toBeVisible()
    await page.evaluate(() => {
        const link = document.createElement('a')
        link.href = '/notifications'
        document.body.append(link)
        link.click()
        link.remove()
    })
    await expect(page).toHaveURL(/\/notifications$/)
    const prompt = await requireConfirmation(page)
    await page.goBack()
    await expect(page).toHaveURL(/\/profile$/)
    await expect(prompt).toHaveCount(0)
})

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

test('closing Discord after Continue cancels linking without an error toast', async ({ page }) => {
    const prompt = await requireConfirmation(page)
    await page.route('**/api/v1/auth/discord/begin/link', (route) =>
        route.fulfill({
            json: {
                payload: {
                    state: 'link.cancelled-attempt',
                    authorizationUrl: 'about:blank',
                    expiresInSeconds: 600
                }
            }
        })
    )
    await page.route('**/api/v1/auth/reauthenticate', (route) =>
        route.fulfill({ json: { payload: {} } })
    )
    await prompt.getByLabel('Password', { exact: true }).fill('synthetic-password')
    await prompt.getByRole('button', { name: 'Confirm', exact: true }).click()
    await expect(prompt.getByRole('button', { name: 'Continue', exact: true })).toBeVisible()

    await page.clock.install()
    const popup = page.waitForEvent('popup')
    await prompt.getByRole('button', { name: 'Continue', exact: true }).click()
    await (await popup).close()
    await page.clock.runFor(3000)

    await expect(page.getByText('The Discord window was closed', { exact: true })).toHaveCount(0)
    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Link', exact: true })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Unlink', exact: true })).toHaveCount(0)
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

for (const field of ['email', 'password']) {
    test(`an expired ${field} change prompts only on Submit and resumes the same change`, async ({
        page
    }) => {
        const { submissions } = await profileSubmissions(page)
        const value = field === 'email' ? 'updated@example.test' : 'replacement-password-value'
        await page.locator(`input[name="${field}"]`).fill(value)
        const prompt = page.getByRole('dialog', { name: "Confirm it's you" })
        await expect(prompt).toHaveCount(0)
        await expect(page.locator('input[name="currentPassword"]')).toHaveCount(0)
        await expect(page.locator('input[name="challenge"]')).toHaveCount(0)
        expect(submissions).toEqual([])

        await page
            .getByRole('button', {
                name: field === 'email' ? 'Send verification code' : 'Submit',
                exact: true
            })
            .click()
        await expect(prompt).toBeVisible()
        expect(submissions).toEqual([{ [field]: value }])
        await prompt.getByLabel('Password', { exact: true }).fill('existing-password-value')
        await prompt.getByRole('button', { name: 'Confirm', exact: true }).click()
        await expect(prompt).toHaveCount(0)
        expect(submissions).toEqual([{ [field]: value }, { [field]: value }])
        if (field === 'email') {
            await expect(page).toHaveURL(/\/profile$/)
            await expect(page.getByText('updated@example.test', { exact: true })).toBeVisible()
            await expect(page.getByText(user.email!, { exact: true })).toBeVisible()
            await page.getByLabel('Verification code', { exact: true }).fill('mail-code')
            await page.getByRole('button', { name: 'Verify and change email' }).click()
            await expect(
                page.getByText('Your email address has been changed.', { exact: false })
            ).toBeVisible()
            await expect(page).toHaveURL(/\/profile$/)
        } else {
            await expect(page.getByText('Profile Updated', { exact: true })).toBeVisible()
            await expect(page.locator('input[name="password"]')).toHaveValue('')
        }
    })
}

test('pending email changes survive a reload and cancellation keeps the verified address', async ({
    page
}) => {
    await profileSubmissions(page, { recent: true })
    await page.getByLabel('New email address').fill('pending@example.test')
    await page.getByRole('button', { name: 'Send verification code' }).click()
    await expect(page.getByLabel('Verification code')).toBeVisible()
    await page.reload()
    await expect(page.getByText('pending@example.test', { exact: true })).toBeVisible()
    await expect(page.getByText(user.email!, { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Cancel email change' }).click()
    await expect(page.getByLabel('New email address')).toBeVisible()
    await expect(page.getByText(user.email!, { exact: true })).toBeVisible()
    await expect(page).toHaveURL(/\/profile$/)
})

test('a wrong code leaves the current address in place and permits a retry', async ({ page }) => {
    await profileSubmissions(page, { recent: true })
    await page.getByLabel('New email address').fill('pending@example.test')
    await page.getByRole('button', { name: 'Send verification code' }).click()
    await page.getByLabel('Verification code').fill('wrong-code')
    await page.getByRole('button', { name: 'Verify and change email' }).click()
    await expect(
        page.getByText('That code is incorrect or has expired.', { exact: false })
    ).toBeVisible()
    await expect(page.getByText(user.email!, { exact: true })).toBeVisible()
    await page.getByLabel('Verification code').fill('mail-code')
    await page.getByRole('button', { name: 'Verify and change email' }).click()
    await expect(
        page.getByText('Your email address has been changed.', { exact: false })
    ).toBeVisible()
    await expect(page.getByText('pending@example.test', { exact: true })).toBeVisible()
})

test('a recent password change saves without asking again', async ({ page }) => {
    const { submissions } = await profileSubmissions(page, { recent: true })
    await page.locator('input[name="password"]').fill('replacement-password-value')
    await page.getByRole('button', { name: 'Submit', exact: true }).click()
    await expect(page.getByText('Profile Updated', { exact: true })).toBeVisible()
    await expect(page.getByRole('dialog', { name: "Confirm it's you" })).toHaveCount(0)
    expect(submissions).toEqual([{ password: 'replacement-password-value' }])
})

test('cancelling confirmation leaves the draft intact and does not retry the update', async ({
    page
}) => {
    const { submissions } = await profileSubmissions(page)
    await page.locator('input[name="password"]').fill('replacement-password-value')
    await page.getByRole('button', { name: 'Submit', exact: true }).click()
    const prompt = page.getByRole('dialog', { name: "Confirm it's you" })
    await expect(prompt).toBeVisible()
    await prompt.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(prompt).toHaveCount(0)
    await expect(page.locator('input[name="password"]')).toHaveValue('replacement-password-value')
    expect(submissions).toHaveLength(1)
    await expect(page.getByText('Profile Updated', { exact: true })).toHaveCount(0)
})

test('a username-only change needs no recent proof', async ({ page }) => {
    const { submissions } = await profileSubmissions(page)
    await page.locator('input[name="username"]').fill('renamed-player')
    await page.getByRole('button', { name: 'Submit', exact: true }).click()
    await expect(page.getByText('Profile Updated', { exact: true })).toBeVisible()
    await expect(page.getByRole('dialog', { name: "Confirm it's you" })).toHaveCount(0)
    expect(submissions).toEqual([{ username: 'renamed-player' }])
})

for (const field of ['email', 'password']) {
    test(`a Discord-only account confirms through Discord before changing its ${field}`, async ({
        page,
        context
    }) => {
        const { submissions, confirm } = await profileSubmissions(page, {
            account: { ...user, hasPassword: false, externalIds: ['discord:linked-user'] }
        })
        await page.route('**/api/v1/auth/discord/begin/reauthenticate', (route) =>
            route.fulfill({
                json: {
                    payload: {
                        state: 'reauthenticate.profile-change',
                        authorizationUrl: new URL(
                            '/oauth/discord/link?code=synthetic&state=reauthenticate.profile-change',
                            page.url()
                        ).href,
                        expiresInSeconds: 600
                    }
                }
            })
        )
        await context.route('**/api/v1/auth/discord/reauthenticate', (route) => {
            confirm()
            return route.fulfill({ json: { payload: {} } })
        })
        const value = field === 'email' ? 'provider-new@example.test' : 'replacement-password-value'
        await page.locator(`input[name="${field}"]`).fill(value)
        await page
            .getByRole('button', {
                name: field === 'email' ? 'Send verification code' : 'Submit',
                exact: true
            })
            .click()
        const prompt = page.getByRole('dialog', { name: "Confirm it's you" })
        await expect(prompt).toBeVisible()
        await expect(prompt.getByLabel('Password', { exact: true })).toHaveCount(0)
        const popup = page.waitForEvent('popup')
        await prompt.getByRole('button', { name: 'Continue with Discord' }).click()
        const authorization = await popup
        if (field === 'email') {
            await expect(page.getByLabel('Verification code')).toBeVisible()
            await expect(page.getByText(user.email!, { exact: true })).toBeVisible()
            await expect(page).toHaveURL(/\/profile$/)
        } else {
            await expect(page.getByText('Profile Updated', { exact: true })).toBeVisible()
        }
        expect(submissions).toEqual([{ [field]: value }, { [field]: value }])
        await authorization.close()
    })
}
