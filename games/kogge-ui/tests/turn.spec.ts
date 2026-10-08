import { expect, test, type Page } from '@playwright/test'
import type { KoggeGameSession } from '../src/lib/model/session.svelte.js'

declare global {
    interface Window {
        koggeSession: KoggeGameSession
    }
}

const pageErrors = new WeakMap<Page, string[]>()

test.beforeEach(({ page }) => {
    const errors: string[] = []
    pageErrors.set(page, errors)
    page.on('pageerror', (error) => errors.push(error.message))
})

test.afterEach(({ page }) => {
    expect(pageErrors.get(page)).toEqual([])
})

async function createGame(page: Page) {
    await page.route('**/model/sessionContext.svelte.ts*', async (route) => {
        const response = await route.fetch()
        const body = await response.text()
        expect(body).toContain('return getContext();')
        await route.fulfill({
            response,
            body: body.replace('return getContext();', 'return window.koggeSession = getContext();')
        })
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'New game', exact: true }).click()
    await page.getByPlaceholder('choose a name for your game').fill('Kogge test')
    await page
        .getByPlaceholder('optional reproduction seed')
        .fill('0123456789abcdef0123456789abcdef')
    const names = page.getByPlaceholder('player name')
    for (let i = 1; i < (await names.count()); i++) await names.nth(i).fill(`Player ${i + 1}`)
    await page.getByRole('button', { name: 'Create Game', exact: true }).click()
    await expect.poll(() => page.evaluate(() => !!window.koggeSession)).toBe(true)
}

function machineState(page: Page) {
    return page.evaluate(() => window.koggeSession.gameState.machineState)
}

async function reachFirstTurn(page: Page) {
    await createGame(page)
    const startTargets = page.getByRole('button', { name: 'Found your first office here' })
    for (let chooser = 0; chooser < 4; chooser++) {
        await startTargets.nth(chooser * 2).click()
        await expect
            .poll(() => page.evaluate(() => window.koggeSession.gameState.startChoices?.filter((choice) => choice.submitted).length ?? 4))
            .toBeGreaterThan(chooser)
    }
    await expect.poll(() => machineState(page)).toBe('Bidding')
    for (let bidder = 0; bidder < 4; bidder++) {
        const bid = page.getByRole('button', { name: 'Bid', exact: true })
        for (let choice = 0; ; choice++) {
            await page.getByTitle(/^Add \d to your bid$/).nth(choice).click()
            if (await bid.isEnabled()) break
            await page.getByTitle(/^Take \d back$/).click()
        }
        await bid.click()
        await expect.poll(() => page.evaluate(() => window.koggeSession.gameState.bids.length)).toBe(bidder + 1)
    }
    await expect.poll(() => machineState(page)).toBe('MovingGuildMaster')
    await page.getByRole('button', { name: /^One city/ }).click()
    await expect.poll(() => machineState(page)).toBe('TakingTurn')
}

test('founds offices, bids and sails along a route', async ({ page }) => {
    await reachFirstTurn(page)
    const playerId = await page.evaluate(() => window.koggeSession.myPlayerId)
    const before = await page.evaluate((id) => window.koggeSession.gameState.getPlayerState(id).city, playerId)
    await page.getByRole('button', { name: 'Sail here', exact: true }).first().click()
    await expect
        .poll(() => page.evaluate((id) => window.koggeSession.gameState.getPlayerState(id).city, playerId))
        .not.toBe(before)
})

test('Undo takes back a paid route before the fee is chosen', async ({ page }) => {
    await reachFirstTurn(page)
    await page.getByRole('button', { name: 'Sail here', exact: true }).first().click()
    await expect.poll(() => page.evaluate(() => window.koggeSession.gameState.turn?.moves)).toBe(1)
    const paid = page.getByRole('button', { name: 'Sail here for 1', exact: true })
    if ((await paid.count()) === 0) {
        test.skip(true, 'This seed offers no paid move after the first')
    }
    await paid.first().click()
    await expect(page.getByText(/^Pay 1 more to sail/)).toBeVisible()
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(page.getByText(/^Pay 1 more to sail/)).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => window.koggeSession.gameState.turn?.moves)).toBe(1)
})
