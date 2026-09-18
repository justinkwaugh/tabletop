import { expect, test } from '@playwright/test'
import {
    ConfigOptionType,
    GameStatus,
    PlayerStatus,
    Role,
    UserStatus,
    type Game,
    type PublicGamePreview,
    type User
} from '@tabletop/common'
import { mockLibrary } from './fixtures/library'

const visitor: User = {
    id: 'visitor',
    username: 'Bob',
    email: 'bob@example.com',
    emailVerified: true,
    status: UserStatus.Active,
    roles: [Role.User],
    externalIds: []
}
const preview: PublicGamePreview = {
    id: 'public-table',
    typeId: 'landing-0',
    titleName: 'Game 01',
    name: 'Friday night',
    ownerId: 'host',
    status: GameStatus.WaitingForPlayers,
    config: { expert: false, map: 'island' },
    configOptions: [
        {
            id: 'expert',
            name: 'Expert rules',
            description: '',
            type: ConfigOptionType.Boolean,
            default: false
        },
        {
            id: 'map',
            name: 'Map',
            description: '',
            type: ConfigOptionType.List,
            default: 'base',
            options: [
                { name: 'Original map', value: 'base' },
                { name: 'Island map', value: 'island' }
            ]
        }
    ],
    players: [
        { id: 'p1', name: 'Alice', userId: 'host', status: PlayerStatus.Joined, isHuman: true },
        { id: 'p2', name: '', status: PlayerStatus.Open, isHuman: true }
    ]
}

test.beforeEach(async ({ page }) => {
    await mockLibrary(page)
    await page.route('**/api/v1/game/public/public-table', (route) =>
        route.fulfill({ json: { payload: preview } })
    )
    await page.route('**/api/v1/games/mine*', (route) =>
        route.fulfill({ json: { payload: { games: [] } } })
    )
})

test('shows players and non-default options before login and returns after login even after refresh', async ({
    page
}) => {
    let joins = 0
    await page.route('**/api/v1/game/join', (route) => {
        joins++
        expect(route.request().postDataJSON()).toEqual({ gameId: preview.id })
        const game: Game = {
            ...preview,
            isPublic: true,
            deleted: false,
            hotseat: false,
            createdAt: new Date(),
            winningPlayerIds: [],
            players: [
                preview.players[0],
                {
                    ...preview.players[1],
                    name: visitor.username ?? '',
                    userId: visitor.id,
                    status: PlayerStatus.Joined
                }
            ]
        }
        return route.fulfill({ json: { payload: { game } } })
    })
    await page.route('**/api/v1/auth/login', (route) =>
        route.fulfill({ json: { payload: { user: visitor } } })
    )
    await page.goto('/join/public-table')
    await expect(page.getByRole('heading', { name: 'Friday night' })).toBeVisible()
    await expect(page.getByText('Alice', { exact: true })).toBeVisible()
    await expect(page.getByText('Open seat', { exact: true })).toBeVisible()
    await expect(page.getByText('Expert rules', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Island map', { exact: true })).toBeVisible()
    await expect(page.locator('main')).not.toContainText('Sign in')
    expect(joins).toBe(0)
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
    await page.getByRole('button', { name: 'Join', exact: true }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page).toHaveURL(/\/join\/public-table$/)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(joins).toBe(0)
    await page.reload()
    await page.getByRole('button', { name: 'Join', exact: true }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByLabel('Username', { exact: true }).fill('Bob')
    await page.getByLabel('Password', { exact: true }).fill('correct-password')
    await page.getByRole('button', { name: 'Sign in', exact: true }).last().click()
    await expect(page).toHaveURL(/\/join\/public-table$/)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(joins).toBe(0)
    await page.getByRole('button', { name: 'Join', exact: true }).click()
    await expect(page).toHaveURL(/\/dashboard$/)
    expect(joins).toBe(1)
})

test('returns to the invitation after signup, email verification, and an onboarding refresh', async ({
    page
}) => {
    const incomplete = { ...visitor, emailVerified: false, status: UserStatus.Incomplete }
    await page.route('**/api/v1/user/create', (route) =>
        route.fulfill({ json: { payload: { user: incomplete } } })
    )
    await page.route('**/api/v1/user/email/verify/*', (route) =>
        route.fulfill({ json: { payload: { user: visitor } } })
    )
    await page.goto('/join/public-table')
    await page.getByRole('button', { name: 'Join', exact: true }).click()
    await page.getByRole('link', { name: 'Sign up', exact: true }).click()
    await page.getByLabel('Username', { exact: true }).fill('Bob')
    await page.getByLabel('Email', { exact: true }).fill('bob@example.com')
    await page.getByLabel('Password', { exact: true }).fill('correct-password')
    await page.getByRole('button', { name: 'Sign up', exact: true }).click()
    await expect(page).toHaveURL(/\/onboarding$/)
    await page.route('**/api/v1/user/self', (route) =>
        route.fulfill({ json: { payload: { user: incomplete } } })
    )
    await page.reload()
    await page.locator('input[name="verificationToken"]').fill('aBCdef')
    await page.getByRole('button', { name: 'Submit', exact: true }).click()
    await expect(page).toHaveURL(/\/join\/public-table$/)
    await expect(page.getByRole('button', { name: 'Join', exact: true })).toBeVisible()
})

test('refreshes availability when another player claims the last seat', async ({ page }) => {
    await page.route('**/api/v1/user/self', (route) =>
        route.fulfill({ json: { payload: { user: visitor } } })
    )
    await page.goto('/join/public-table')
    await expect(page.getByRole('button', { name: 'Join', exact: true })).toBeVisible()
    await page.route('**/api/v1/game/public/public-table', (route) =>
        route.fulfill({
            json: {
                payload: {
                    ...preview,
                    status: GameStatus.WaitingToStart,
                    players: [
                        preview.players[0],
                        {
                            ...preview.players[1],
                            name: 'Carol',
                            userId: 'carol',
                            status: PlayerStatus.Joined
                        }
                    ]
                }
            }
        })
    )
    await page.route('**/api/v1/game/join', (route) =>
        route.fulfill({ status: 409, json: { message: 'Game is full' } })
    )
    await page.getByRole('button', { name: 'Join', exact: true }).click()
    await expect(page.getByText('There are no open seats in this game.')).toBeVisible()
    await expect(page.getByText('Carol', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Join', exact: true })).toHaveCount(0)
})

test('shows an unavailable invitation for a deleted or invite-only game', async ({ page }) => {
    await page.route('**/api/v1/game/public/public-table', (route) =>
        route.fulfill({ status: 404 })
    )
    await page.goto('/join/public-table')
    await expect(page.getByRole('heading', { name: 'Invitation unavailable' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Join', exact: true })).toHaveCount(0)
})

for (const scenario of [
    {
        signedIn: true,
        status: GameStatus.Started,
        notice: 'This game has already started. Opening the game…'
    },
    {
        signedIn: false,
        status: GameStatus.Started,
        notice: 'This game has already started. Opening the game…'
    },
    {
        signedIn: false,
        status: GameStatus.Finished,
        notice: 'This game has finished. Opening the game…'
    }
]) {
    test(`old invite opens the normal game loader: ${scenario.status}, signed in ${scenario.signedIn}`, async ({
        page
    }) => {
        const joins: string[] = []
        page.on('request', (request) => {
            if (request.url().endsWith('/game/join')) joins.push(request.url())
        })
        await page.route('**/api/v1/game/public/public-table', (route) =>
            route.fulfill({ json: { payload: { ...preview, status: scenario.status } } })
        )
        if (scenario.signedIn) {
            await page.route('**/api/v1/user/self', (route) =>
                route.fulfill({ json: { payload: { user: visitor } } })
            )
        }
        await page.route('**/api/v1/game/get/public-table', () => {})
        const gameRequested = page.waitForRequest('**/api/v1/game/get/public-table')
        await page.goto('/join/public-table')
        await expect(page.getByText(scenario.notice, { exact: true })).toBeVisible()
        if (!scenario.signedIn) {
            await expect(page).toHaveURL(/\/login$/)
            expect(await page.evaluate(() => sessionStorage.getItem('loginContinuation'))).toBe(
                '/game/public-table'
            )
            await page.route('**/api/v1/auth/login', (route) =>
                route.fulfill({ json: { payload: { user: visitor } } })
            )
            await page.getByLabel('Username', { exact: true }).fill('Bob')
            await page.getByLabel('Password', { exact: true }).fill('correct-password')
            await page.getByRole('button', { name: 'Sign in', exact: true }).last().click()
        }
        await gameRequested
        expect(joins).toEqual([])
    })
}

for (const scenario of [
    {
        name: 'owner',
        userId: 'host',
        status: GameStatus.WaitingForPlayers,
        page: '/dashboard',
        kind: 'invite',
        path: '/join/public-table'
    },
    {
        name: 'public browser',
        userId: visitor.id,
        status: GameStatus.WaitingForPlayers,
        page: '/library/landing-0',
        kind: 'invite',
        path: '/join/public-table'
    },
    {
        name: 'player after start',
        userId: visitor.id,
        status: GameStatus.Started,
        page: '/dashboard',
        kind: 'game',
        path: '/game/public-table'
    }
]) {
    test(`${scenario.name} can copy the public game link`, async ({ page, context }) => {
        await context.grantPermissions(['clipboard-read', 'clipboard-write'])
        await page.route('**/api/v1/user/self', (route) =>
            route.fulfill({ json: { payload: { user: { ...visitor, id: scenario.userId } } } })
        )
        const game: Game = {
            ...preview,
            status: scenario.status,
            isPublic: true,
            deleted: false,
            hotseat: false,
            createdAt: new Date(),
            winningPlayerIds: [],
            players:
                scenario.status === GameStatus.Started
                    ? [
                          preview.players[0],
                          {
                              ...preview.players[1],
                              name: 'Bob',
                              userId: visitor.id,
                              status: PlayerStatus.Joined
                          }
                      ]
                    : preview.players
        }
        await page.route('**/api/v1/games/mine*', (route) =>
            route.fulfill({
                json: { payload: { games: scenario.page === '/dashboard' ? [game] : [] } }
            })
        )
        await page.route('**/api/v1/games/open/*', (route) =>
            route.fulfill({ json: { payload: { games: [game] } } })
        )
        await page.goto(scenario.page)
        await page.getByRole('button', { name: `Copy ${scenario.kind} link`, exact: true }).click()
        await expect(page.getByLabel('Public invite link')).toHaveCount(0)
        await expect(
            page.getByText(scenario.kind === 'invite' ? 'Invite link copied' : 'Game link copied', {
                exact: true
            })
        ).toBeVisible()
        expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
            `http://localhost:4173${scenario.path}`
        )
    })
}
