import { expect, test } from '@playwright/test'
import { mockLibrary } from './fixtures/library'

test.beforeEach(async ({ page }) => {
    await mockLibrary(page)
})

test('visitors can browse an expanding public collection before signing in', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Care to play a game?' })).toBeVisible()
    await expect(page.locator('.game-shelf > li')).toHaveCount(10)
    await expect(page.getByText('12 games to explore')).toBeVisible()

    const expand = page.getByRole('button', { name: 'See all 12 games' })
    await expand.click()
    await expect(page.locator('.game-shelf > li')).toHaveCount(12)
    await expect(page.getByRole('heading', { name: 'Game 13' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Show fewer games' })).toBeFocused()
    await page.getByRole('button', { name: 'Show fewer games' }).click()
    await expect(page.locator('.game-shelf > li')).toHaveCount(10)
    await expect(expand).toHaveAttribute('aria-expanded', 'false')

    await page.getByRole('link', { name: 'Explore the games' }).click()
    await expect(page).toHaveURL(/\/#games$/)
    const game = page.getByRole('button', { name: 'Sign in to play Game 01', exact: true })
    await game.click()
    await expect(page).toHaveURL(/\/#games$/)
    await expect(page.getByRole('dialog', { name: 'Sign in' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(game).toBeFocused()
})

test('signup and sign-in switch within the same modal on a narrow screen', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 })
    await page.goto('/')
    await expect(page.locator('.game-shelf > li')).toHaveCount(10)
    for (const width of [320, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 740 })
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
    }
    await page.setViewportSize({ width: 320, height: 740 })
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeInViewport()
    await page.getByRole('button', { name: 'Take a seat' }).click()
    const dialog = page.getByRole('dialog', { name: 'Sign in' })
    await expect(dialog).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320)
    await dialog.getByRole('link', { name: 'Sign up' }).click()
    await expect(page).toHaveURL(/\/$/)
    const signup = page.getByRole('dialog', { name: 'Create an account' })
    await expect(signup).toBeInViewport()
    await expect(page.locator('dialog')).toHaveCount(1)
    await expect(signup.getByLabel('Username', { exact: true })).toBeFocused()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320)
    await signup.getByRole('link', { name: 'Sign in' }).click()
    await expect(dialog.getByLabel('Username', { exact: true })).toBeFocused()
    await dialog.getByRole('button', { name: 'Close' }).click()
    await expect(dialog).toHaveCount(0)
})

test('an unavailable collection leaves the visitor a usable entrance', async ({ page }) => {
    await page.route('**/api/v1/manifest', (route) =>
        route.fulfill({ json: { payload: { frontend: { version: '18.0.0' }, games: [] } } })
    )
    await page.goto('/')
    await expect(page.getByRole('status')).toContainText('The game shelf couldn’t load')
    await expect(page.getByRole('button', { name: 'Take a seat' })).toBeVisible()
    await expect(page.getByRole('button', { name: /See all/ })).toHaveCount(0)
})

for (const hasActive of [true, false]) {
    test(`signed-in players still reach ${hasActive ? 'their games' : 'the library'}`, async ({
        page
    }) => {
        await page.route('**/api/v1/user/self', (route) =>
            route.fulfill({
                json: {
                    payload: {
                        user: {
                            id: 'landing-player',
                            username: 'Landing Player',
                            status: 'active',
                            roles: ['user'],
                            externalIds: []
                        }
                    }
                }
            })
        )
        await page.route('**/api/v1/games/hasActive', (route) =>
            route.fulfill({ json: { payload: { hasActive } } })
        )
        await page.route('**/api/v1/games/mine', (route) =>
            route.fulfill({ json: { payload: { games: [] } } })
        )
        await page.goto('/')
        await expect(page).toHaveURL(hasActive ? /\/dashboard$/ : /\/library$/)
        await expect(page.getByRole('button', { name: 'Take a seat' })).toHaveCount(0)
    })
}

test('username login stays in the modal through an error and signs in successfully', async ({
    page
}) => {
    let attempts = 0
    await page.route('**/api/v1/auth/login', async (route) => {
        attempts += 1
        if (attempts === 1) {
            await route.fulfill({ status: 401, json: { message: 'Invalid credentials' } })
        } else {
            expect(route.request().postDataJSON()).toEqual({
                username: 'player',
                password: 'correct-password'
            })
            await route.fulfill({
                json: {
                    payload: {
                        user: {
                            id: 'landing-player',
                            username: 'player',
                            status: 'active',
                            roles: ['user'],
                            externalIds: []
                        }
                    }
                }
            })
        }
    })
    await page.route('**/api/v1/games/hasActive', (route) =>
        route.fulfill({ json: { payload: { hasActive: false } } })
    )
    await page.goto('/')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Sign in' })
    await expect(dialog.getByRole('button', { name: 'Use Username / Password' })).toHaveCount(0)
    await expect(dialog.getByRole('button', { name: 'Back', exact: true })).toHaveCount(0)
    await expect(dialog.getByRole('link', { name: 'Sign up' })).toBeVisible()
    await expect(dialog.getByRole('heading', { name: 'Welcome!' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Close' })).toHaveCount(0)
    await dialog.getByLabel('Username', { exact: true }).fill('player')
    await dialog.getByLabel('Password', { exact: true }).fill('incorrect-password')
    await dialog.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(dialog.getByRole('alert')).toContainText('Unable to sign in')
    await expect(page).toHaveURL(/\/$/)
    await dialog.getByLabel('Password', { exact: true }).fill('correct-password')
    await dialog.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page).toHaveURL(/\/library$/)
    await expect(dialog).toHaveCount(0)
})

test('password recovery stays in the modal through a failed send, confirmation, and back', async ({
    page
}) => {
    let attempts = 0
    await page.route('**/api/v1/user/email/sendPasswordReset', async (route) => {
        attempts += 1
        expect(route.request().postDataJSON()).toEqual({ email: 'player@example.com' })
        if (attempts === 1) {
            await route.fulfill({ status: 500, json: { message: 'Unavailable' } })
        } else {
            await route.fulfill({ json: { payload: {} } })
        }
    })
    await page.goto('/')
    const opener = page.getByRole('button', { name: 'Take a seat' })
    await opener.click()
    await page.getByRole('link', { name: 'Forgot password?' }).click()
    const dialog = page.getByRole('dialog', { name: 'Reset password' })
    await expect(dialog.getByLabel('Email address')).toBeFocused()
    await dialog.getByLabel('Email address').fill('player@example.com')
    await dialog.getByRole('button', { name: 'Send reset link' }).click()
    await expect(dialog.getByRole('alert')).toContainText('couldn’t send')
    await dialog.getByRole('button', { name: 'Send reset link' }).click()
    await expect(dialog.getByRole('status')).toContainText('Check your email')
    await expect(dialog.getByRole('status')).toBeFocused()
    await expect(page).toHaveURL(/\/$/)
    await dialog.getByRole('button', { name: 'Try another email' }).click()
    await expect(dialog.getByLabel('Email address')).toBeFocused()
    await dialog.getByRole('button', { name: 'Back to sign in' }).click()
    await expect(page.getByRole('heading', { name: 'Welcome!' })).toBeVisible()
    await expect(page.getByLabel('Username', { exact: true })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(opener).toBeFocused()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await opener.click()
    await expect(page.getByRole('dialog', { name: 'Sign in' })).toBeVisible()
})

test('direct recovery links work and fit a mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 })
    await page.goto('/login/username')
    await expect(page.getByLabel('Username', { exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'Forgot password?' }).click()
    await expect(page).toHaveURL(/\/forgot\/password$/)
    const dialog = page.getByRole('dialog', { name: 'Reset password' })
    await expect(dialog).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320)
    await dialog.getByLabel('Email address').fill('player@example.com')
    await dialog.getByRole('button', { name: 'Send reset link' }).click()
    await expect(dialog.getByRole('status')).toContainText('Check your email')
    await dialog.getByRole('button', { name: 'Close' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(dialog).toHaveCount(0)
})

test('emailed links reset the password in a modal with validation and retry', async ({ page }) => {
    let attempts = 0
    await page.route('**/api/v1/auth/token/login', (route) => {
        expect(route.request().postDataJSON()).toEqual({ token: 'reset-test-token' })
        return route.fulfill({
            json: {
                payload: {
                    user: {
                        id: 'landing-player',
                        username: 'player',
                        status: 'active',
                        roles: ['user'],
                        externalIds: []
                    }
                }
            }
        })
    })
    await page.route('**/api/v1/games/mine', (route) =>
        route.fulfill({ json: { payload: { games: [] } } })
    )
    await page.route('**/api/v1/user/setPassword', async (route) => {
        attempts += 1
        expect(route.request().postDataJSON()).toEqual({
            password: 'a-new-password',
            token: 'reset-test-token'
        })
        await route.fulfill(
            attempts === 1
                ? { status: 500, json: { message: 'Unavailable' } }
                : { json: { payload: {} } }
        )
    })
    await page.setViewportSize({ width: 320, height: 740 })
    await page.goto('/email/passwordReset/reset-test-token')
    const dialog = page.getByRole('dialog', { name: 'Reset password' })
    await expect(dialog).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320)
    await dialog.getByLabel('New password', { exact: true }).fill('short')
    await dialog.getByRole('button', { name: 'Set new password' }).click()
    expect(attempts).toBe(0)
    await dialog.getByLabel('New password', { exact: true }).fill('a-new-password')
    await dialog.getByRole('button', { name: 'Show password' }).click()
    await expect(dialog.getByLabel('New password', { exact: true })).toHaveAttribute('type', 'text')
    await dialog.getByRole('button', { name: 'Set new password' }).click()
    await expect(dialog.getByRole('alert')).toContainText('couldn’t update')
    await dialog.getByRole('button', { name: 'Set new password' }).click()
    await expect(dialog.getByRole('status')).toContainText('Your password has been updated')
    await expect(page).toHaveURL(/\/email\/passwordReset\/reset-test-token$/)
    await dialog.getByRole('button', { name: 'Continue to Dashboard' }).click()
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(dialog).toHaveCount(0)
})

test('an unusable reset link offers another email without leaving the modal', async ({ page }) => {
    await page.route('**/api/v1/auth/token/login', (route) =>
        route.fulfill({ status: 401, json: { message: 'Invalid token' } })
    )
    await page.goto('/email/passwordReset/expired-token')
    const dialog = page.getByRole('dialog', { name: 'Reset password' })
    await expect(dialog.getByRole('alert')).toContainText('couldn’t be verified')
    await expect(dialog.getByLabel('New password', { exact: true })).toHaveCount(0)
    await dialog.getByLabel('Email address').fill('player@example.com')
    await dialog.getByRole('button', { name: 'Send reset link' }).click()
    await expect(dialog.getByRole('status')).toContainText('Check your email')
    await expect(page).toHaveURL(/\/email\/passwordReset\/expired-token$/)
})

test('signup validates, handles errors, prevents duplicate submissions, and signs in', async ({
    page
}) => {
    let attempts = 0
    let completeSignup = () => {}
    const signupResponse = new Promise<void>((resolve) => {
        completeSignup = resolve
    })
    await page.route('**/api/v1/user/create', async (route) => {
        attempts += 1
        expect(route.request().postDataJSON()).toEqual({
            username: 'new-player',
            password: 'a-long-password',
            email: 'player@example.com'
        })
        if (attempts <= 2) {
            await route.fulfill({
                status: 400,
                json: {
                    error: {
                        name: 'AlreadyExistsError',
                        message: attempts === 1 ? 'username already exists' : 'email already exists'
                    }
                }
            })
        } else if (attempts === 3) {
            await route.fulfill({ status: 500, json: { message: 'Unavailable' } })
        } else {
            await signupResponse
            await route.fulfill({
                json: {
                    payload: {
                        user: {
                            id: 'new-player',
                            username: 'new-player',
                            status: 'active',
                            roles: ['user'],
                            externalIds: []
                        }
                    }
                }
            })
        }
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'Take a seat' }).click()
    await page.getByRole('link', { name: 'Sign up' }).click()
    const dialog = page.getByRole('dialog', { name: 'Create an account' })
    await dialog.getByLabel('Username', { exact: true }).fill('new-player')
    await dialog.getByLabel('Password', { exact: true }).fill('short')
    await dialog.getByLabel('Email', { exact: true }).fill('player@example.com')
    await dialog.getByRole('button', { name: 'Sign up', exact: true }).click()
    expect(attempts).toBe(0)
    await dialog.getByLabel('Password', { exact: true }).fill('a-long-password')
    await dialog.getByRole('button', { name: 'Sign up', exact: true }).click()
    await expect(dialog.getByRole('alert')).toContainText('Username already exists')
    await dialog.getByRole('button', { name: 'Sign up', exact: true }).click()
    await expect(dialog.getByRole('alert')).toContainText('Email already exists')
    await dialog.getByRole('button', { name: 'Sign up', exact: true }).click()
    await expect(dialog.getByRole('alert')).toContainText('couldn’t create your account')
    await dialog.getByRole('button', { name: 'Sign up', exact: true }).click()
    await expect(dialog.getByRole('button', { name: 'Creating…' })).toBeDisabled()
    expect(attempts).toBe(4)
    completeSignup()
    await expect(page).toHaveURL(/\/library$/)
    await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('signup remains directly accessible', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.getByRole('heading', { name: 'Create an account' })).toBeVisible()
    await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'Sign in', exact: true }).click()
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByLabel('Username', { exact: true })).toBeVisible()
})

test('the background stays still while a short-screen signup dialog can scroll', async ({
    page
}) => {
    await page.setViewportSize({ width: 390, height: 400 })
    await page.goto('/')
    await page.getByRole('button', { name: 'Sign in to play Game 01', exact: true }).click()
    const scrollPosition = await page.evaluate(() => window.scrollY)
    await expect(page.locator('html')).toHaveCSS('overflow', 'hidden')
    await page.getByRole('link', { name: 'Sign up' }).click()
    const dialog = page.getByRole('dialog', { name: 'Create an account' })
    await page.mouse.move(3, 350)
    await page.mouse.wheel(0, 600)
    await page.waitForTimeout(150)
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollPosition)
    const submit = dialog.getByRole('button', { name: 'Sign up', exact: true })
    await submit.scrollIntoViewIfNeeded()
    await expect(submit).toBeInViewport()
    expect(
        await dialog.locator('.overflow-y-auto').evaluate((element) => element.scrollTop)
    ).toBeGreaterThan(0)
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollPosition)
    await dialog.getByRole('button', { name: 'Close' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.locator('html')).not.toHaveCSS('overflow', 'hidden')
    await page.mouse.wheel(0, 400)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrollPosition)
})
