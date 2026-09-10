import { expect, test } from '@playwright/test'
import type { Game, Tournament, User } from '@tabletop/common'
import { GameStatus, PlayerStatus, UserStatus, Role } from '@tabletop/common'
import { mockLibrary } from './fixtures/library'

const player: User = {
    id: 'library-player',
    username: 'Player',
    status: UserStatus.Active,
    roles: [Role.User],
    externalIds: []
}
function game(id: string, name: string, mine: boolean): Game {
    return {
        id,
        name,
        typeId: 'landing-0',
        status: mine ? GameStatus.Started : GameStatus.WaitingForPlayers,
        isPublic: true,
        deleted: false,
        ownerId: mine ? player.id : 'other-player',
        config: {},
        hotseat: false,
        players: [
            {
                id: 'seat-1',
                isHuman: true,
                userId: mine ? player.id : 'other-player',
                name: mine ? 'Player' : 'Other player',
                status: PlayerStatus.Joined
            },
            { id: 'seat-2', isHuman: true, name: '', status: PlayerStatus.Open }
        ],
        createdAt: new Date('2026-09-01'),
        winningPlayerIds: [],
        activePlayerIds: mine ? ['seat-1'] : []
    }
}
function tournament(id: string): Tournament {
    return {
        id,
        name: `Tournament ${id}`,
        description: '',
        organizerId: 'organizer',
        status: 'open',
        revision: 1,
        rules: {
            titleId: 'landing-0',
            tableSize: 2,
            registration: { kind: 'whenFull', capacity: 5 },
            concurrency: 1,
            gameConfig: {},
            scoring: 'splitWinsV1'
        },
        format: {
            kind: 'mini',
            stages: [{ id: 'stage-one', name: 'Main event', gamesPerEntrant: 4 }]
        },
        entrants: [],
        stages: [],
        createdAt: 1,
        updatedAt: 1
    }
}

test.beforeEach(async ({ page }) => {
    await mockLibrary(page)
    await page.route('**/api/v1/user/self', (route) =>
        route.fulfill({ json: { payload: { user: player } } })
    )
    await page.route('**/api/v1/games/mine', (route) =>
        route.fulfill({ json: { payload: { games: [] } } })
    )
    await page.route('**/api/v1/games/open/*', (route) =>
        route.fulfill({ json: { payload: { games: [] } } })
    )
    await page.route('**/api/v1/tournaments/**', (route) =>
        route.fulfill({ json: { status: 'ok', payload: { tournaments: [] } } })
    )
})

test('portrait covers preserve their proportions through navigation and Back', async ({ page }) => {
    await page.addInitScript(() => {
        const startViewTransition = document.startViewTransition.bind(document)
        document.startViewTransition = (update) => {
            const transition = startViewTransition(update)
            document.documentElement.dataset.outgoingCoverCount = String(
                [...document.images].filter((image) =>
                    getComputedStyle(image).viewTransitionName.startsWith('game-cover-')
                ).length
            )
            void transition.ready.then(() => {
                const root = document.documentElement
                const cover = getComputedStyle(
                    root,
                    '::view-transition-group(game-cover-landing-0)'
                )
                const collection = getComputedStyle(
                    root,
                    '::view-transition-group(game-collection)'
                )
                root.dataset.coverAboveCollection = String(
                    Number(cover.zIndex) > Number(collection.zIndex)
                )
                root.dataset.incomingCoverCount = String(
                    [...document.images].filter((image) =>
                        getComputedStyle(image).viewTransitionName.startsWith('game-cover-')
                    ).length
                )
            })
            return transition
        }
    })
    await page.route('**/favicon-32x32.png', (route) =>
        route.fulfill({
            contentType: 'image/svg+xml',
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="teal"/></svg>'
        })
    )
    const cover = page.locator('[data-game-cover="landing-0"]')
    async function expectPortraitSnapshot() {
        await expect(cover).toBeVisible()
        await expect
            .poll(() =>
                cover.evaluate((element) => {
                    const style = getComputedStyle(element)
                    return Number.parseFloat(style.width) / Number.parseFloat(style.height)
                })
            )
            .toBeCloseTo(0.75, 2)
    }

    await page.goto('/library')
    await expectPortraitSnapshot()
    await page.getByRole('link', { name: 'View Game 01' }).click()
    await expect(page).toHaveURL(/\/library\/landing-0$/)
    await expectPortraitSnapshot()
    await page.evaluate(() => delete document.documentElement.dataset.coverAboveCollection)
    await page.goBack()
    await expect(page).toHaveURL(/\/library$/)
    await expectPortraitSnapshot()
    await expect(page.locator('html')).toHaveAttribute('data-cover-above-collection', 'true')
    await expect(page.locator('html')).toHaveAttribute('data-outgoing-cover-count', '1')
    await expect(page.locator('html')).toHaveAttribute('data-incoming-cover-count', '1')
})

test('Your games prioritizes overdue turns, recent activity, then newly created waiting games', async ({
    page
}) => {
    const games: Game[] = [
        { ...game('waiting-old', 'Waiting older', true), status: GameStatus.WaitingForPlayers },
        { ...game('turn-recent', 'Your turn recent', true), lastActionAt: new Date('2026-09-08') },
        {
            ...game('started-old', 'Started older', true),
            activePlayerIds: [],
            lastActionAt: new Date('2026-09-02')
        },
        {
            ...game('waiting-new', 'Waiting newer', true),
            status: GameStatus.WaitingToStart,
            createdAt: new Date('2026-09-09')
        },
        { ...game('turn-old', 'Your turn overdue', true), lastActionAt: new Date('2026-09-03') },
        {
            ...game('started-new', 'Started recent', true),
            activePlayerIds: [],
            lastActionAt: new Date('2026-09-07')
        },
        game('turn-no-action', 'Your turn no actions yet', true)
    ]
    await page.route('**/api/v1/games/mine', (route) =>
        route.fulfill({ json: { payload: { games } } })
    )
    await page.goto('/library/landing-0')
    await expect(
        page.getByRole('region', { name: 'Your games' }).locator('.game-list h1')
    ).toHaveText([
        'Your turn no actions yet',
        'Your turn overdue',
        'Your turn recent',
        'Started recent',
        'Started older',
        'Waiting newer',
        'Waiting older'
    ])
})

test('the All games link restores the scrolled library', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 700 })
    await page.goto('/library')
    const results = page.locator('.library-results')
    await expect(page.getByRole('link', { name: 'View Game 12' })).toBeAttached()
    await results.hover()
    await page.mouse.wheel(0, 5000)
    await expect.poll(() => results.evaluate((element) => element.scrollTop)).toBeGreaterThan(500)
    const position = await results.evaluate((element) => element.scrollTop)
    await page.getByRole('link', { name: 'View Game 12' }).click()
    await expect(page).toHaveURL(/\/library\/landing-11$/)
    await page.getByRole('link', { name: 'All games', exact: true }).click()
    await expect(page).toHaveURL(/\/library$/)
    await expect
        .poll(() => results.evaluate((element) => element.scrollTop))
        .toBeCloseTo(position, 0)
})

test('the library shares the collection, supports search, and remembers it on Back', async ({
    page
}) => {
    await page.goto('/library')
    await expect(page.getByRole('heading', { name: 'What would you like to play?' })).toBeVisible()
    await expect(page.locator('.hero')).toHaveCount(0)
    await expect(page.locator('.game-shelf > li')).toHaveCount(12)
    await page.getByRole('searchbox', { name: 'Find a game' }).fill('Game 01')
    await expect(page.locator('.game-shelf > li')).toHaveCount(1)
    await page.getByRole('link', { name: 'View Game 01' }).click()
    await expect(page).toHaveURL(/\/library\/landing-0$/)
    await expect(page.getByRole('heading', { name: 'Game 01', exact: true })).toBeVisible()
    await expect(page.getByText('Example Designer')).toBeVisible()
    await expect(page.getByText('Make every turn count.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Your games' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Open games' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Tournaments', exact: true })).toBeVisible()
    await page.goBack()
    await expect(page.getByRole('searchbox')).toHaveValue('Game 01')
    await page.getByRole('searchbox').fill('no matching title')
    await expect(page.getByRole('status')).toContainText('No games match')
    await page.getByRole('button', { name: 'Clear search' }).click()
    await expect(page.locator('.game-shelf > li')).toHaveCount(12)
})

test('the game page shows current games, joinable tables and paginated tournaments', async ({
    page
}) => {
    const mine = game('mine', 'Friday game', true)
    const open = game('open', 'Everyone welcome', false)
    await page.route('**/api/v1/games/mine', (route) =>
        route.fulfill({
            json: {
                payload: {
                    games: [
                        mine,
                        { ...mine, id: 'unrelated', typeId: 'landing-1', name: 'Other title' }
                    ]
                }
            }
        })
    )
    await page.route('**/api/v1/games/open/landing-0', (route) =>
        route.fulfill({ json: { payload: { games: [open, mine] } } })
    )
    await page.route('**/api/v1/tournaments/**', (route) => {
        const query = new URL(route.request().url()).searchParams
        expect(query.get('titleId')).toBe('landing-0')
        if (query.get('scope') === 'mine') {
            return route.fulfill({ json: { status: 'ok', payload: { tournaments: [] } } })
        }
        expect(query.get('scope')).toBe('open')
        return route.fulfill({
            json: {
                status: 'ok',
                payload: query.get('after')
                    ? { tournaments: [tournament('two')] }
                    : { tournaments: [tournament('one')], nextCursor: 'next' }
            }
        })
    })
    await page.goto('/library/landing-0')
    const mySection = page.getByRole('region', { name: 'Your games' })
    const openSection = page.getByRole('region', { name: 'Open games' })
    await expect(mySection.getByText('Friday game')).toBeVisible()
    await expect(mySection.getByText('Other title')).toHaveCount(0)
    await expect(mySection.getByRole('button', { name: 'Your Turn', exact: true })).toBeVisible()
    await expect(openSection.getByText('Friday game')).toHaveCount(0)
    await expect(openSection.getByRole('button', { name: 'Join', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: /Tournament one/ })).toHaveAttribute(
        'href',
        '/tournaments/one'
    )
    await page.getByRole('button', { name: 'More tournaments' }).click()
    await expect(page.getByRole('link', { name: /Tournament two/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'More tournaments' })).toHaveCount(0)
    for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 })
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
    }
    await page.getByRole('button', { name: 'Start a game', exact: true }).click()
    await expect(
        page.getByRole('dialog').getByPlaceholder('choose a name for your game')
    ).toBeVisible()
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('each activity section can recover from a request failure', async ({ page }) => {
    let attempts = 0
    await page.route('**/api/v1/games/mine', (route) => {
        attempts++
        return route.fulfill(
            attempts === 1
                ? { status: 500, json: {} }
                : { json: { payload: { games: [game('mine', 'Recovered game', true)] } } }
        )
    })
    await page.goto('/library/landing-0')
    const section = page.getByRole('region', { name: 'Your games' })
    await expect(section.getByRole('alert')).toContainText('couldn’t load')
    await expect(page.getByText('No tournaments to show for this game right now.')).toBeVisible()
    await section.getByRole('button', { name: 'Try again' }).click()
    await expect(section.getByText('Recovered game')).toBeVisible()
    expect(attempts).toBe(2)
})

test('unavailable and hidden beta titles do not open a game page', async ({ page }) => {
    for (const id of ['missing', 'landing-12']) {
        await page.goto(`/library/${id}`)
        await expect(page.getByText('This game is not available in your library.')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Start a game', exact: true })).toHaveCount(0)
    }
})

for (const reducedMotion of [false, true]) {
    test(`login brings the collection up with ${reducedMotion ? 'reduced' : 'normal'} motion`, async ({
        page
    }) => {
        await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' })
        await page.addInitScript(() => {
            const start = document.startViewTransition
            document.startViewTransition = function (update) {
                document.documentElement.dataset.libraryTransitions = 'started'
                return start.call(document, update)
            }
        })
        await page.route('**/api/v1/user/self', (route) => route.fulfill({ json: { payload: {} } }))
        await page.route('**/api/v1/auth/login', (route) =>
            route.fulfill({ json: { payload: { user: player } } })
        )
        await page.route('**/api/v1/games/hasActive', (route) =>
            route.fulfill({ json: { payload: { hasActive: true } } })
        )
        await page.goto('/')
        await page.getByRole('button', { name: 'Take a seat' }).click()
        await page.getByLabel('Username', { exact: true }).fill('Player')
        await page.getByLabel('Password', { exact: true }).fill('a-valid-password')
        await page.getByRole('dialog').getByRole('button', { name: 'Sign in', exact: true }).click()
        await expect(page).toHaveURL(/\/library$/)
        await expect(
            page.getByRole('heading', { name: 'What would you like to play?' })
        ).toBeVisible()
        expect(await page.evaluate(() => document.documentElement.dataset.libraryTransitions)).toBe(
            reducedMotion ? undefined : 'started'
        )
    })
}

test('a direct game link survives signing in', async ({ page }) => {
    await page.route('**/api/v1/user/self', (route) => route.fulfill({ json: { payload: {} } }))
    await page.route('**/api/v1/auth/login', (route) =>
        route.fulfill({ json: { payload: { user: player } } })
    )
    await page.goto('/library/landing-1')
    await expect(page).toHaveURL(/\/login$/)
    await page.getByLabel('Username', { exact: true }).fill('Player')
    await page.getByLabel('Password', { exact: true }).fill('a-valid-password')
    await page.getByRole('button', { name: 'Sign in', exact: true }).last().click()
    await expect(page).toHaveURL(/\/library\/landing-1$/)
    await expect(page.getByRole('heading', { name: 'Game 02', exact: true })).toBeVisible()
})

test('joining an open game moves it into your games on the same page', async ({ page }) => {
    const open = game('join-me', 'Take a seat', false)
    await page.route('**/api/v1/games/open/landing-0', (route) =>
        route.fulfill({ json: { payload: { games: [open] } } })
    )
    await page.route('**/api/v1/game/join', (route) => {
        expect(route.request().postDataJSON()).toEqual({ gameId: open.id })
        return route.fulfill({
            json: {
                payload: {
                    game: {
                        ...open,
                        status: GameStatus.WaitingToStart,
                        players: [
                            open.players[0],
                            {
                                id: 'seat-2',
                                isHuman: true,
                                userId: player.id,
                                name: 'Player',
                                status: PlayerStatus.Joined
                            }
                        ]
                    }
                }
            }
        })
    })
    await page.goto('/library/landing-0')
    const openSection = page.getByRole('region', { name: 'Open games' })
    await openSection.getByRole('button', { name: 'Join', exact: true }).click()
    await expect(
        page.getByRole('region', { name: 'Your games' }).getByText('Take a seat', { exact: true })
    ).toBeVisible()
    await expect(openSection.getByText('Take a seat', { exact: true })).toHaveCount(0)
    await expect(page).toHaveURL(/\/library\/landing-0$/)
})

test('creating a game refreshes the game page without sending you away', async ({ page }) => {
    let created = false
    const newGame = {
        ...game('created', 'A new table', true),
        status: GameStatus.WaitingForPlayers
    }
    await page.route('**/api/v1/games/mine', (route) =>
        route.fulfill({ json: { payload: { games: created ? [newGame] : [] } } })
    )
    await page.route('**/api/v1/game/landing-0/create', (route) => {
        const request = route.request().postDataJSON()
        expect(request.game.typeId).toBe('landing-0')
        expect(request.game.name).toBe('A new table')
        created = true
        return route.fulfill({ json: { payload: { game: newGame } } })
    })
    await page.goto('/library/landing-0')
    await page.getByRole('button', { name: 'Start a game', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByPlaceholder('choose a name for your game').fill('A new table')
    await dialog.getByRole('button', { name: 'Create Game', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(
        page.getByRole('region', { name: 'Your games' }).getByText('A new table', { exact: true })
    ).toBeVisible()
    await expect(page.getByRole('status')).toContainText('Game created')
    await expect(page).toHaveURL(/\/library\/landing-0$/)
})

test('title tournaments show your ongoing events before open events and link to a filtered list', async ({
    page
}) => {
    const active: Tournament = {
        ...tournament('active'),
        status: 'inProgress',
        entrants: [{ userId: player.id, joinedAt: 1 }]
    }
    const locked: Tournament = {
        ...tournament('locked'),
        status: 'locked',
        entrants: active.entrants
    }
    const finished: Tournament = {
        ...tournament('finished'),
        status: 'finished',
        entrants: active.entrants
    }
    const joined: Tournament = { ...tournament('joined'), entrants: active.entrants }
    await page.route('**/api/v1/tournaments/**', (route) => {
        const query = new URL(route.request().url()).searchParams
        expect(query.get('titleId')).toBe('landing-0')
        const mine = query.get('scope') === 'mine'
        const payload = mine
            ? query.get('after')
                ? { tournaments: [active, locked] }
                : { tournaments: [finished, joined], nextCursor: 'mine-next' }
            : query.get('after')
              ? { tournaments: [tournament('later')] }
              : { tournaments: [joined, tournament('open')], nextCursor: 'open-next' }
        return route.fulfill({ json: { status: 'ok', payload } })
    })
    await page.goto('/library/landing-0')
    const section = page.getByRole('region', { name: 'Tournaments', exact: true })
    await expect(section.locator('h3')).toHaveText([
        'Tournament active',
        'Tournament locked',
        'Tournament joined',
        'Tournament open'
    ])
    await expect(section.getByText('0 games finished')).toBeVisible()
    await expect(section.getByText('Tournament finished', { exact: true })).toHaveCount(0)
    await section.getByRole('button', { name: 'More tournaments' }).click()
    await expect(section.locator('h3')).toHaveText([
        'Tournament active',
        'Tournament locked',
        'Tournament joined',
        'Tournament open',
        'Tournament later'
    ])
    await section.getByRole('link', { name: 'View all tournaments' }).click()
    await expect(page).toHaveURL(/\/tournaments\?titleId=landing-0$/)
    await expect(page.locator('#tournament-game-filter')).toContainText('Game 01')
    await page.getByRole('tab', { name: 'Open', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Tournament open', exact: true })).toBeVisible()
    await expect(page.locator('#tournament-game-filter')).toContainText('Game 01')
})

test('a filtered tournaments link keeps its game when defaulting from empty Mine to Open', async ({
    page
}) => {
    await page.route('**/api/v1/tournaments/**', (route) => {
        const query = new URL(route.request().url()).searchParams
        expect(query.get('titleId')).toBe('landing-0')
        return route.fulfill({
            json: {
                status: 'ok',
                payload: {
                    tournaments: query.get('scope') === 'mine' ? [] : [tournament('open')]
                }
            }
        })
    })
    await page.goto('/tournaments?titleId=landing-0')
    await expect(page.getByRole('tab', { name: 'Open', exact: true })).toHaveAttribute(
        'aria-selected',
        'true'
    )
    await expect(page.locator('#tournament-game-filter')).toContainText('Game 01')
    await expect(page.getByRole('heading', { name: 'Tournament open', exact: true })).toBeVisible()
})

for (const path of ['/library/landing-0', '/dashboard']) {
    for (const reducedMotion of ['no-preference', 'reduce'] as const) {
        test(`pending invitations move down after joining with ${reducedMotion} motion on ${path}`, async ({
            page
        }) => {
            await page.emulateMedia({ reducedMotion })
            await page.addInitScript(() => {
                const animate = Element.prototype.animate
                Element.prototype.animate = function (keyframes, options) {
                    const animation = animate.call(this, keyframes, options)
                    const duration = typeof options === 'number' ? options : options?.duration
                    if (this.querySelector('h1') && typeof duration === 'number' && duration > 0) {
                        document.documentElement.dataset.listAnimated = 'true'
                    }
                    return animation
                }
            })
            const invitation = game('invitation', 'Invitation', false)
            invitation.createdAt = new Date('2026-09-02')
            invitation.players[1] = {
                id: 'invitee',
                isHuman: true,
                userId: player.id,
                name: 'Player',
                status: PlayerStatus.Reserved
            }
            const accepted: Game = {
                ...invitation,
                status: GameStatus.WaitingToStart,
                players: invitation.players.map((seat) =>
                    seat.userId === player.id ? { ...seat, status: PlayerStatus.Joined } : seat
                )
            }
            const games: Game[] = [
                {
                    ...game('joined-waiting', 'Joined waiting', true),
                    status: GameStatus.WaitingToStart,
                    createdAt: new Date('2026-09-09')
                },
                game('turn', 'Your turn', true),
                invitation,
                { ...game('started', 'Started', true), activePlayerIds: [] }
            ]
            await page.route('**/api/v1/games/mine', (route) =>
                route.fulfill({ json: { payload: { games } } })
            )
            await page.route('**/api/v1/game/join', (route) => {
                expect(route.request().postDataJSON()).toEqual({ gameId: invitation.id })
                return route.fulfill({ json: { payload: { game: accepted } } })
            })
            await page.goto(path)
            const titles =
                path === '/dashboard'
                    ? page.locator('h1')
                    : page.getByRole('region', { name: 'Your games' }).locator('.game-list h1')
            await expect(titles).toHaveText(
                path === '/dashboard'
                    ? ['Your turn', 'Started', 'Invitation', 'Joined waiting']
                    : ['Invitation', 'Your turn', 'Started', 'Joined waiting']
            )
            await page.getByRole('button', { name: 'Join', exact: true }).click()
            await expect(titles).toHaveText([
                'Your turn',
                'Started',
                'Joined waiting',
                'Invitation'
            ])
            if (reducedMotion === 'reduce') {
                await expect(page.locator('html')).not.toHaveAttribute('data-list-animated', 'true')
            } else {
                await expect(page.locator('html')).toHaveAttribute('data-list-animated', 'true')
            }
        })
    }
}
