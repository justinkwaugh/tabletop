import { expect, test, type Page, type Route } from '@playwright/test'
import { Role, UserStatus, type User } from '@tabletop/common'
import { mockLibrary } from './fixtures/library'

const admin: User = {
    id: 'admin-user',
    username: 'Admin',
    status: UserStatus.Active,
    roles: [Role.User, Role.Admin],
    externalIds: []
}

function person(status: UserStatus): User {
    return {
        id: `person-${status}`,
        username: `Person ${status}`,
        email: `${status}@example.test`,
        status,
        roles: [Role.User],
        externalIds: []
    }
}

const people = [
    UserStatus.Active,
    UserStatus.Incomplete,
    UserStatus.Inactive,
    UserStatus.Deleted
].map(person)

test.beforeEach(async ({ page }) => {
    await mockLibrary(page)
    await page.route('**/api/v1/user/self', (route) =>
        route.fulfill({ json: { payload: { user: admin } } })
    )
    await page.route('**/api/v1/auth/admin-mode', (route) =>
        route.fulfill({
            json: {
                payload: {
                    adminMode: { expiresAt: new Date(Date.now() + 10 * 60_000).toISOString() }
                }
            }
        })
    )
    await page.route('**/api/v1/admin/users/search?*', (route) =>
        route.fulfill({ json: { payload: { users: people } } })
    )
})

async function openUsers(page: Page) {
    await page.goto('/admin')
    await page.getByLabel('Username or email').fill('person')
    await page.getByRole('button', { name: 'Search' }).click()
    await expect(page.getByRole('list').getByRole('listitem')).toHaveCount(people.length)
}

function select(page: Page, status: UserStatus) {
    return page.getByRole('button', { name: new RegExp(`^Person ${status}`) }).click()
}

const statusPanel = (page: Page) => page.getByRole('form', { name: /^Account status for/ })
const currentStatus = (page: Page) => statusPanel(page).getByText(/^Current status:/)

test('shows each account status and offers only the transition its status allows', async ({
    page
}) => {
    await openUsers(page)

    await select(page, UserStatus.Active)
    await expect(currentStatus(page)).toHaveText('Current status: Active')
    await expect(
        statusPanel(page).getByRole('button', { name: 'Deactivate account' })
    ).toBeEnabled()

    await select(page, UserStatus.Incomplete)
    await expect(currentStatus(page)).toHaveText('Current status: Incomplete')
    await expect(
        statusPanel(page).getByRole('button', { name: 'Deactivate account' })
    ).toBeEnabled()

    await select(page, UserStatus.Inactive)
    await expect(currentStatus(page)).toHaveText('Current status: Inactive')
    await expect(
        statusPanel(page).getByRole('button', { name: 'Reactivate account' })
    ).toBeEnabled()

    await select(page, UserStatus.Deleted)
    await expect(currentStatus(page)).toHaveText('Current status: Deleted')
    await expect(statusPanel(page).getByRole('button')).toHaveCount(0)
    await expect(
        statusPanel(page).getByText('A deleted account cannot be deactivated or reactivated.')
    ).toBeVisible()
})

test('deactivates an account, showing the pending state and adopting the server-returned account', async ({
    page
}) => {
    const requests: { url: string; body: unknown }[] = []
    let answer: ((route: Route) => Promise<void>) | undefined
    const answered = new Promise<void>((resolve) => {
        answer = async (route) => {
            await route.fulfill({
                json: {
                    payload: {
                        user: {
                            ...person(UserStatus.Active),
                            status: UserStatus.Inactive,
                            sessionGeneration: 1
                        }
                    }
                }
            })
            resolve()
        }
    })
    let pending: Route | undefined
    await page.route('**/api/v1/admin/users/*/status', async (route) => {
        requests.push({ url: route.request().url(), body: route.request().postDataJSON() })
        pending = route
    })
    await openUsers(page)
    await select(page, UserStatus.Active)

    const deactivate = statusPanel(page).getByRole('button', { name: 'Deactivate account' })
    await deactivate.click()
    const busy = statusPanel(page).getByRole('button', { name: 'Deactivating…' })
    await expect(busy).toBeDisabled()
    await expect.poll(() => requests.length).toBe(1)
    expect(requests[0].url).toMatch(/\/api\/v1\/admin\/users\/person-active\/status$/)
    expect(requests[0].body).toEqual({ transition: 'deactivate' })

    expect(pending).toBeDefined()
    expect(answer).toBeDefined()
    if (pending && answer) await answer(pending)
    await answered

    await expect(currentStatus(page)).toHaveText('Current status: Inactive')
    await expect(
        statusPanel(page).getByRole('button', { name: 'Reactivate account' })
    ).toBeEnabled()
    await expect(statusPanel(page).getByRole('status')).toHaveText(
        'Account deactivated. Its sessions and live connections have ended.'
    )
    await expect(
        page.getByRole('button', { name: /^Person active/ }).getByText(/Inactive/)
    ).toBeVisible()
})

test('reports a refused change and keeps the shown status', async ({ page }) => {
    await page.route('**/api/v1/admin/users/*/status', (route) =>
        route.fulfill({
            status: 403,
            json: {
                status: 'error',
                error: { name: 'AdminModeRequiredError', message: 'Admin Mode is required' }
            }
        })
    )
    await openUsers(page)
    await select(page, UserStatus.Inactive)

    await statusPanel(page).getByRole('button', { name: 'Reactivate account' }).click()

    await expect(statusPanel(page).getByRole('alert')).toHaveText('Admin Mode is required')
    await expect(currentStatus(page)).toHaveText('Current status: Inactive')
    await expect(
        statusPanel(page).getByRole('button', { name: 'Reactivate account' })
    ).toBeEnabled()

    await select(page, UserStatus.Active)
    await expect(statusPanel(page).getByRole('alert')).toHaveCount(0)
})
