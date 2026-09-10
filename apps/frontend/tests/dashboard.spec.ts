import { expect, test } from '@playwright/test'
import { GameStatus, PlayerStatus, Role, UserStatus, type Game, type User } from '@tabletop/common'
import { mockLibrary } from './fixtures/library'

const user: User = {
    id: 'dashboard-user',
    username: 'Player',
    status: UserStatus.Active,
    roles: [Role.User],
    externalIds: []
}
function game(index: number, status = GameStatus.Started): Game {
    return {
        id: `dashboard-${index}`,
        name: `Table ${String(index).padStart(2, '0')}`,
        typeId: 'landing-0',
        status,
        ownerId: user.id,
        isPublic: false,
        deleted: false,
        hotseat: false,
        config: {},
        createdAt: new Date('2026-09-01'),
        finishedAt: status === GameStatus.Finished ? new Date('2026-09-09') : undefined,
        lastActionAt: new Date('2026-09-08'),
        winningPlayerIds: [],
        activePlayerIds: ['p1'],
        players: [
            {
                id: 'p2',
                userId: 'opponent',
                name: 'Opponent',
                status: PlayerStatus.Joined,
                isHuman: true
            },
            {
                id: 'p1',
                userId: user.id,
                name: 'Player',
                status: PlayerStatus.Joined,
                isHuman: true
            }
        ]
    }
}

test.beforeEach(async ({ page }) => {
    await mockLibrary(page)
    await page.route('**/api/v1/user/self', (route) =>
        route.fulfill({ json: { payload: { user } } })
    )
    await page.route('**/api/v1/games/mine*', (route) => {
        expect(new URL(route.request().url()).searchParams.get('scope')).toBe('current')
        return route.fulfill({
            json: { payload: { games: Array.from({ length: 12 }, (_, index) => game(index)) } }
        })
    })
})

test('loads multiplayer history without runtime errors and reuses loaded pages when switching tabs', async ({
    page
}) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    const requests: string[] = []
    const games = Array.from({ length: 47 }, (_, index) => game(index, GameStatus.Finished))
    games[46].name = 'Hidden treasure'
    await page.route('**/api/v1/games/history*', (route) => {
        const cursor = new URL(route.request().url()).searchParams.get('before')
        requests.push(cursor ?? 'first')
        const offset = cursor === 'older' ? 25 : 0
        return route.fulfill({
            json: {
                payload: {
                    games: games.slice(offset, offset + 25),
                    nextCursor: offset === 0 ? 'older' : undefined
                }
            }
        })
    })
    await page.goto('/dashboard')
    await expect(page.locator('.dashboard-game-list li')).toHaveCount(12)
    expect(requests).toEqual([])
    await page.getByRole('tab', { name: 'History' }).click()
    const history = page.locator('#dashboard-panel-history')
    await expect
        .poll(async () => ({ errors, cards: await history.locator('li').count() }))
        .toEqual({ errors: [], cards: 20 })
    await expect(history.getByRole('button', { name: 'Revisit', exact: true })).toHaveCount(20)
    const firstCard = history.locator('li').first()
    await firstCard.getByRole('heading', { name: 'Table 00' }).click()
    await expect(firstCard.getByText(/^(Player|Opponent)$/)).toHaveText(['Player', 'Opponent'])
    expect(requests).toEqual(['first'])
    await page.getByRole('button', { name: 'Load more games' }).click()
    await expect(history.locator('li')).toHaveCount(40)
    await page.getByRole('button', { name: 'Load more games' }).click()
    await expect(history.locator('li')).toHaveCount(47)
    await expect(page.getByText('All 47 games shown')).toBeVisible()
    await page.getByRole('tab', { name: 'Current' }).click()
    await page.getByRole('tab', { name: 'History' }).click()
    await expect(history.locator('li')).toHaveCount(47)
    expect(requests).toEqual(['first', 'older'])
    expect(errors).toEqual([])
})

for (const tab of ['Current', 'History']) {
    test(`${tab} cards stack independently on desktop and in order on mobile`, async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 900 })
        await page.route('**/api/v1/games/history*', (route) =>
            route.fulfill({
                json: {
                    payload: {
                        games: Array.from({ length: 4 }, (_, index) =>
                            game(index, GameStatus.Finished)
                        )
                    }
                }
            })
        )
        await page.goto('/dashboard')
        await page.getByRole('tab', { name: tab }).click()
        const cards = page.locator('.panel:visible .dashboard-game-list > li')
        await expect(cards).toHaveCount(tab === 'Current' ? 12 : 4)
        const positions = () =>
            cards.evaluateAll((elements) =>
                elements.map((element) => {
                    const { x, y, bottom, height } = element.getBoundingClientRect()
                    return { x, y, bottom, height }
                })
            )
        await page.evaluate(() => document.fonts.ready)
        const before = await positions()
        await cards.first().getByRole('heading', { name: 'Table 00' }).click()
        await expect
            .poll(async () => (await positions())[0].height)
            .toBeGreaterThan(before[0].height + 50)
        await expect
            .poll(async () => {
                const boxes = await positions()
                return boxes[2].y - boxes[0].bottom
            })
            .toBeGreaterThanOrEqual(16)
        await expect
            .poll(async () => {
                const boxes = await positions()
                return boxes[2].y - boxes[0].bottom
            })
            .toBeLessThan(17)
        const expanded = await positions()
        expect(expanded[1]).toEqual(before[1])
        expect(expanded[3]).toEqual(before[3])
        expect(expanded[2].x).toBe(expanded[0].x)
        expect(expanded[3].x).toBe(expanded[1].x)
        await page.screenshot({ path: `/tmp/dashboard-columns-${tab}.png` })

        await page.setViewportSize({ width: 390, height: 900 })
        await expect
            .poll(async () => {
                const boxes = await positions()
                return boxes.every(
                    (box, index) =>
                        box.x === boxes[0].x &&
                        (index === 0 || Math.abs(box.y - boxes[index - 1].bottom - 16) < 1)
                )
            })
            .toBe(true)
    })
}

for (const width of [360, 390, 768, 1280]) {
    test(`keeps controls fixed and shares tournaments padding at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 })
        await page.goto('/dashboard')
        await expect(page.locator('.dashboard-game-list li')).toHaveCount(12)
        const tabs = page.getByRole('tablist', { name: 'My games' })
        const before = await tabs.boundingBox()
        await page.locator('.current-results').evaluate((element) => {
            element.scrollTop = element.scrollHeight
        })
        expect(await tabs.boundingBox()).toEqual(before)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true
        )
        const dashboardPadding = await page.locator('main.dashboard').evaluate((element) => {
            const style = getComputedStyle(element)
            return [
                style.paddingTop,
                style.paddingLeft,
                style.paddingRight,
                element.getBoundingClientRect().x
            ]
        })
        await expect(page.getByRole('link', { name: 'Go to the library' })).toBeVisible()
        await page.screenshot({ path: `/tmp/dashboard-${width}.png` })
        await page.goto('/tournaments')
        const tournamentsPadding = await page
            .locator('main.collection-page')
            .evaluate((element) => {
                const style = getComputedStyle(element)
                return [
                    style.paddingTop,
                    style.paddingLeft,
                    style.paddingRight,
                    element.getBoundingClientRect().x
                ]
            })
        expect(tournamentsPadding).toEqual(dashboardPadding)
    })
}

test('loads local and hosted games together before showing the initial sorted list', async ({
    page
}) => {
    const requested = Promise.withResolvers<void>()
    const released = Promise.withResolvers<void>()
    await page.route('**/api/v1/games/mine*', async (route) => {
        requested.resolve()
        await released.promise
        await route.fulfill({ json: { payload: { games: [game(0)] } } })
    })
    await page.goto('/about')
    await page.evaluate(
        async (localGame) => {
            const request = indexedDB.open('tabletop-local', 1)
            request.onupgradeneeded = () => {
                const db = request.result
                const games = db.createObjectStore('games', { keyPath: 'id' })
                games.createIndex('by-owner', 'ownerId', { multiEntry: true })
                games.createIndex('by-status', 'status')
                const actions = db.createObjectStore('actions', { keyPath: 'gameId' })
                actions.createIndex('by-game', 'gameId')
                db.createObjectStore('states', { keyPath: 'gameId' })
            }
            const db = await new Promise<IDBDatabase>((resolve, reject) => {
                request.onsuccess = () => resolve(request.result)
                request.onerror = () => reject(request.error)
            })
            try {
                const tx = db.transaction('games', 'readwrite')
                tx.objectStore('games').put(localGame)
                await new Promise<void>((resolve, reject) => {
                    tx.oncomplete = () => resolve()
                    tx.onerror = () => reject(tx.error)
                })
            } finally {
                db.close()
            }
        },
        { ...game(99), hotseat: true, activePlayerIds: [] }
    )
    await page.getByRole('button', { name: 'My Games', exact: true }).click()
    await requested.promise
    try {
        await expect(page.locator('.dashboard-game-list li')).toHaveCount(0)
    } finally {
        released.resolve()
    }
    await expect(page.locator('.dashboard-game-list h1')).toHaveText(['Table 00', 'Table 99'])
})

test('library navigation waits for the catalog without showing loading text', async ({ page }) => {
    const requested = Promise.withResolvers<void>()
    const released = Promise.withResolvers<void>()
    await page.route('**/api/v1/catalog', async (route) => {
        requested.resolve()
        await released.promise
        await route.fallback()
    })
    await page.goto('/dashboard')
    await expect(page.locator('.dashboard-game-list li')).toHaveCount(12)
    const navigation = page.getByRole('link', { name: 'Go to the library' }).click()
    await requested.promise
    try {
        await expect(page.getByRole('heading', { name: 'Your games.', exact: true })).toBeVisible()
        await expect(page.getByText('Setting out the games…')).toHaveCount(0)
    } finally {
        released.resolve()
        await navigation
    }
    await expect(page.locator('.game-shelf li')).toHaveCount(12)
})

test('dashboard card positions stay fixed when cover images arrive', async ({ page }) => {
    const released = Promise.withResolvers<void>()
    await page.setViewportSize({ width: 390, height: 900 })
    await page.route('**/favicon-32x32.png', async (route) => {
        await released.promise
        await route.fulfill({
            contentType: 'image/svg+xml',
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="blue"/></svg>'
        })
    })
    await page.route('**/api/v1/games/mine*', (route) =>
        route.fulfill({
            json: {
                payload: {
                    games: Array.from({ length: 4 }, (_, index) => ({
                        ...game(index),
                        name: `A long game name that needs several lines ${index}`
                    }))
                }
            }
        })
    )
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
    const cards = page.locator('.dashboard-game-list > li')
    await expect(cards).toHaveCount(4)
    await page.evaluate(() => document.fonts.ready)
    const positions = () =>
        cards.evaluateAll((elements) =>
            elements.map((element) => ({
                top: element.getBoundingClientRect().top,
                height: element.getBoundingClientRect().height
            }))
        )
    const before = await positions()
    released.resolve()
    await expect
        .poll(() =>
            cards
                .locator('img')
                .evaluateAll((images) =>
                    images.every(
                        (image) =>
                            image instanceof HTMLImageElement &&
                            image.complete &&
                            image.naturalWidth > 0
                    )
                )
        )
        .toBe(true)
    expect(await positions()).toEqual(before)
})
