import { expect, test, type Page } from '@playwright/test'
import type { SantiagoGameSession } from '../src/lib/stores/SantiagoGameSession.svelte.js'

declare global {
    interface Window {
        santiagoSession: SantiagoGameSession
    }
}

async function createGame(page: Page, privateMoney: boolean) {
    await page.route('**/gameSessionContext.svelte.ts*', async (route) => {
        const response = await route.fetch()
        const body = await response.text()
        expect(body).toContain('return getContext();')
        await route.fulfill({
            response,
            body: body.replace(
                'return getContext();',
                'return window.santiagoSession = getContext();'
            )
        })
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'New game', exact: true }).click()
    await page.getByPlaceholder('choose a name for your game').fill('Santiago visibility')
    await page
        .getByPlaceholder('optional reproduction seed')
        .fill('0123456789abcdef0123456789abcdef')
    if (privateMoney) {
        await page
            .locator('label')
            .filter({ has: page.locator('#publicMoney') })
            .click()
        await expect(page.locator('#publicMoney')).not.toBeChecked()
    }
    const names = page.getByPlaceholder('player name')
    for (let i = 1; i < (await names.count()); i++) await names.nth(i).fill(`Player ${i + 1}`)
    await page.getByRole('button', { name: 'Create Game', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Place Bid', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Options', exact: true }).click()
    await page.getByText('Protected mode', { exact: true }).click()
    await page.getByRole('button', { name: 'Options', exact: true }).click()
}

async function selectActivePlayer(page: Page) {
    const id = await page.evaluate(() => window.santiagoSession.gameState.activePlayerIds[0])
    await page.getByLabel('Protected view', { exact: true }).selectOption(id)
    await expect.poll(() => page.evaluate(() => window.santiagoSession.myPlayer?.id)).toBe(id)
    await expect.poll(() => page.evaluate(() => window.santiagoSession.busy)).toBe(false)
    return id
}

async function visibleState(page: Page) {
    return page.evaluate(() => {
        const s = window.santiagoSession
        return {
            tiles: s.gameState.tileBag.length,
            remaining: s.gameState.getRemainingTileCount(),
            balances: s.gameState.players
                .filter((p) => p.money !== undefined)
                .map((p) => p.playerId),
            money: s.mySantiagoPlayer?.money
        }
    })
}

test('private money, public tile count and player bids survive perspective switching', async ({
    page
}) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await createGame(page, true)
    const id = await selectActivePlayer(page)
    await expect
        .poll(() => visibleState(page))
        .toEqual({ tiles: 0, remaining: 40, balances: [id], money: 10 })
    await expect(page.getByText('40', { exact: true })).toBeVisible()
    await expect(page.getByText('?', { exact: true })).toHaveCount(3)
    await expect(page.getByRole('button', { name: 'start exploring', exact: true })).toBeDisabled()
    await page.getByRole('button', { name: '+', exact: true }).click()
    await page.getByRole('button', { name: 'Place Bid', exact: true }).click()
    await expect.poll(async () => (await visibleState(page)).money).toBe(9)
    for (const width of [600, 1280]) {
        await page.setViewportSize({ width, height: 900 })
        await expect(page.getByText('?', { exact: true })).toHaveCount(3)
        await expect(page.getByText('undefined', { exact: true })).toHaveCount(0)
    }
    await page.getByLabel('Protected view', { exact: true }).selectOption('host')
    await expect.poll(async () => (await visibleState(page)).tiles).toBe(40)
    await expect.poll(async () => (await visibleState(page)).balances.length).toBe(4)
    await expect(page.getByRole('button', { name: 'start exploring', exact: true })).toBeDisabled()
    await page.getByLabel('Protected view', { exact: true }).selectOption('spectator')
    await expect.poll(async () => (await visibleState(page)).balances).toEqual([])
    await expect.poll(async () => (await visibleState(page)).tiles).toBe(0)
    await expect(page.getByText('?', { exact: true })).toHaveCount(4)
    await expect(page.getByRole('button', { name: 'Place Bid', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'start exploring', exact: true })).toBeDisabled()
    await selectActivePlayer(page)
    await page.getByRole('button', { name: 'Place Bid', exact: true }).click()
    await expect
        .poll(() => page.evaluate(() => window.santiagoSession.gameState.actionCount))
        .toBe(2)
    expect(errors).toEqual([])
})

test('public-money projected exploration creates a playable bag and returns to the source', async ({
    page
}) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await createGame(page, false)
    await page.getByLabel('Protected view', { exact: true }).selectOption('spectator')
    await expect.poll(async () => (await visibleState(page)).balances.length).toBe(4)
    await expect.poll(async () => (await visibleState(page)).tiles).toBe(0)
    await page.getByRole('button', { name: 'start exploring', exact: true }).click()
    await expect.poll(() => page.evaluate(() => window.santiagoSession.isExploring)).toBe(true)
    await expect.poll(async () => (await visibleState(page)).tiles).toBe(40)
    await page.getByRole('button', { name: 'Place Bid', exact: true }).click()
    await expect
        .poll(() => page.evaluate(() => window.santiagoSession.gameState.actionCount))
        .toBe(1)
    await page.getByRole('button', { name: 'Back to game', exact: true }).click()
    await expect.poll(() => page.evaluate(() => window.santiagoSession.isExploring)).toBe(false)
    await expect.poll(async () => (await visibleState(page)).tiles).toBe(0)
    await expect
        .poll(() => page.evaluate(() => window.santiagoSession.gameState.actionCount))
        .toBe(0)
    expect(errors).toEqual([])
})
