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

test('loads all history on demand and reuses loaded pages when switching tabs ', async ({
    page
}) => {
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
    await expect(history.locator('li')).toHaveCount(20)
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
})

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
