import { expect, test, type Page } from '@playwright/test'
import { ActionSource } from '@tabletop/common'
import { TechId } from '@tabletop/stellar-horizons-2'
import type { StellarHorizonsGameSession } from '../src/lib/model/session.svelte.js'

declare global {
    interface Window {
        stellarSession: StellarHorizonsGameSession
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
            body: body.replace(
                'return getContext();',
                'return window.stellarSession = getContext();'
            )
        })
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'New game', exact: true }).click()
    await page.getByPlaceholder('choose a name for your game').fill('Footfall')
    await page
        .getByPlaceholder('optional reproduction seed')
        .fill('0123456789abcdef0123456789abcdef')
    const names = page.getByPlaceholder('player name')
    for (let i = 1; i < (await names.count()); i++) await names.nth(i).fill(`Player ${i + 1}`)
    await page.getByRole('button', { name: 'Create Game', exact: true }).click()
    await expect.poll(() => page.evaluate(() => !!window.stellarSession)).toBe(true)
    for (const faction of ['The Starfarers', 'The Givers', 'The Praetorians']) {
        await page.getByRole('button', { name: new RegExp(`^${faction}`) }).click()
    }
    await expect
        .poll(() => page.evaluate(() => window.stellarSession.gameState.machineState))
        .toBe('PlayingTurn')
    await page.evaluate(() =>
        window.stellarSession.setActingPlayer(window.stellarSession.gameState.initiativeOrder()[0])
    )
}

function shipTile(page: Page, name: string) {
    return page.locator('.ship-tile', { hasText: name })
}

const selectedShipId = (page: Page) =>
    page.evaluate(() => window.stellarSession.selectedShip?.shipId)
const actionCount = (page: Page) => page.evaluate(() => window.stellarSession.actions.length)

async function buildProbeAndReachMovement(page: Page) {
    await shipTile(page, 'Kepler').getByRole('button', { name: '$5B' }).click()
    await expect(page.getByRole('button', { name: 'Kepler', exact: true }).first()).toBeVisible()
    await page.getByRole('button', { name: 'Done building' }).click()
    await page.getByRole('button', { name: 'Done with cargo' }).click()
    await expect(page.getByRole('button', { name: 'Done moving' })).toBeVisible()
}

test('a chosen ship shows its destinations and moves from the map', async ({ page }) => {
    await createGame(page)
    await buildProbeAndReachMovement(page)
    await shipTile(page, 'Kepler').getByRole('button').first().click()
    await expect.poll(() => selectedShipId(page)).toBe('starfarers-kepler')
    await expect(page.getByRole('button', { name: 'Move to Alpha Centauri' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Alpha Centauri \(2 turns\)$/ })).toBeVisible()

    await page.getByRole('button', { name: 'Move to Alpha Centauri' }).click()
    await expect
        .poll(() =>
            page.evaluate(() => window.stellarSession.gameState.ship('starfarers-kepler').transit)
        )
        .toBe(2)
    await expect.poll(() => selectedShipId(page)).toBeUndefined()
    await expect(page.getByRole('button', { name: 'Move to Alpha Centauri' })).toHaveCount(0)
})

test('Undo clears a chosen ship before undoing any action', async ({ page }) => {
    await createGame(page)
    await buildProbeAndReachMovement(page)
    const before = await actionCount(page)
    await page.getByRole('button', { name: 'Kepler', exact: true }).first().click()
    await expect.poll(() => selectedShipId(page)).toBe('starfarers-kepler')
    await page.getByRole('button', { name: 'UNDO' }).click()
    await expect.poll(() => selectedShipId(page)).toBeUndefined()
    expect(await actionCount(page)).toBe(before)
    await expect(page.getByRole('button', { name: 'Move to Alpha Centauri' })).toHaveCount(0)
})

test('history hides a chosen ship and live view restores it', async ({ page }) => {
    await createGame(page)
    await buildProbeAndReachMovement(page)
    await page.getByRole('button', { name: 'Kepler', exact: true }).first().click()
    await expect(page.getByRole('button', { name: 'Move to Alpha Centauri' })).toBeVisible()
    await page.getByRole('button', { name: 'step backwards' }).first().click()
    await expect(page.getByRole('button', { name: 'Move to Alpha Centauri' })).toHaveCount(0)
    await page.getByRole('button', { name: 'go to current' }).first().click()
    await expect(page.getByRole('button', { name: 'Move to Alpha Centauri' })).toBeVisible()
})

test('a tech chosen on the chart is paid for with suggested markers', async ({ page }) => {
    await createGame(page)
    await page.getByRole('button', { name: 'Done building' }).click()
    await page.getByRole('button', { name: 'Done with cargo' }).click()
    await page.getByRole('button', { name: 'Done moving' }).click()
    await page.getByRole('button', { name: 'Done exploring' }).click()
    await page
        .getByRole('button', { name: 'Improved Interstellar Settlement', exact: true })
        .click()
    await expect(page.getByRole('button', { name: /^Develop for/ })).toBeVisible()
    await page.getByRole('button', { name: /^Develop for/ }).click()
    await expect
        .poll(() =>
            page.evaluate(
                (techId) =>
                    window.stellarSession.gameState
                        .getPlayerState(window.stellarSession.gameState.initiativeOrder()[0])
                        .ownsTech(techId),
                TechId.ImprovedInterstellarSettlement
            )
        )
        .toBe(true)
})

test("another player's action keeps the chosen ship", async ({ page }) => {
    await createGame(page)
    await buildProbeAndReachMovement(page)
    await page.getByRole('button', { name: 'Kepler', exact: true }).first().click()
    await expect.poll(() => selectedShipId(page)).toBe('starfarers-kepler')
    const before = await actionCount(page)
    await page.evaluate(async (source) => {
        const session = window.stellarSession
        const state = session.gameState
        const other = state.initiativeOrder()[1]
        const action = {
            id: 'other-player-step',
            gameId: state.gameId,
            source,
            playerId: other,
            type: 'EndStep',
            step: state.getPlayerState(other).step,
            simultaneousGroupId: `turn-${state.year}`
        }
        await session.applyAction(action)
    }, ActionSource.User)
    await expect.poll(() => actionCount(page)).toBe(before + 1)
    await expect.poll(() => selectedShipId(page)).toBe('starfarers-kepler')
    await expect(page.getByRole('button', { name: 'Move to Alpha Centauri' })).toBeVisible()
})
