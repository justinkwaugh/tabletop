import { expect, test, type Page } from '@playwright/test'
import type { LowenherzGameSession } from '../src/lib/model/session.svelte.js'

declare global {
    interface Window {
        lowenherzSession: LowenherzGameSession
    }
}

async function createPrivateMoneyGame(page: Page) {
    await page.route('**/model/sessionContext.svelte.ts*', async (route) => {
        const response = await route.fetch()
        const body = await response.text()
        expect(body).toContain('return getContext();')
        await route.fulfill({
            response,
            body: body.replace(
                'return getContext();',
                'return window.lowenherzSession = getContext();'
            )
        })
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'New game', exact: true }).click()
    await page.getByPlaceholder('choose a name for your game').fill('Private-money exploration')
    await page
        .getByPlaceholder('optional reproduction seed')
        .fill('0123456789abcdef0123456789abcdef')
    // Both toggles present their variant and start off; switching one on stores `false`.
    for (const id of ['publicMoney', 'playerPlacedCastles']) {
        const toggle = page.locator(`#${id}`)
        await expect(toggle).not.toBeChecked()
        await page.locator('label').filter({ has: toggle }).click()
        await expect(toggle).toBeChecked()
    }
    const names = page.getByPlaceholder('player name')
    for (let i = 1; i < (await names.count()); i++) await names.nth(i).fill(`Player ${i + 1}`)
    await page.getByRole('button', { name: 'Create Game', exact: true }).click()
    await expect.poll(() => page.evaluate(() => !!window.lowenherzSession)).toBe(true)
}

test('private-money exploration requires Host View and preserves its source through play and Undo', async ({
    page
}) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await createPrivateMoneyGame(page)
    await page.getByRole('button', { name: 'Options', exact: true }).click()
    await page.getByText('Protected mode', { exact: true }).click()
    await page.getByRole('button', { name: 'Options', exact: true }).click()
    const explore = page.getByRole('button', { name: 'start exploring', exact: true })
    await expect(explore).toBeDisabled()
    await page
        .locator('label')
        .filter({ has: page.getByRole('checkbox', { name: 'Debug', exact: true }) })
        .click()
    await expect.poll(() => page.evaluate(() => window.lowenherzSession.showDebug)).toBe(true)
    await expect(explore).toBeDisabled()
    await page.getByLabel('Protected view', { exact: true }).selectOption('host')
    await expect.poll(() => page.evaluate(() => window.lowenherzSession?.isViewingHost)).toBe(true)
    await expect(explore).toBeEnabled()
    await page.evaluate(() => window.lowenherzSession.setViewAsActingPlayer(true))
    await expect(explore).toBeDisabled()
    await page.evaluate(() => window.lowenherzSession.setViewAsActingPlayer(false))
    await expect(explore).toBeEnabled()
    const source = await page.evaluate(() => window.lowenherzSession.gameState.dehydrate())
    await explore.click()
    await expect.poll(() => page.evaluate(() => window.lowenherzSession.isExploring)).toBe(true)
    expect(
        await page.evaluate(() => window.lowenherzSession.gameState.players.map((p) => p.money))
    ).toEqual(source.players.map((p) => p.money))
    await page.evaluate(() => window.lowenherzSession.drawActionCard())
    await expect
        .poll(() => page.evaluate(() => window.lowenherzSession.gameState.actionCount))
        .toBeGreaterThan(source.actionCount)
    await page.evaluate(() => window.lowenherzSession.undo())
    await expect
        .poll(() => page.evaluate(() => window.lowenherzSession.gameState.actionCount))
        .toBe(source.actionCount)
    await page.getByRole('button', { name: 'Back to game', exact: true }).click()
    await expect.poll(() => page.evaluate(() => window.lowenherzSession.isExploring)).toBe(false)
    expect(await page.evaluate(() => window.lowenherzSession.gameState.dehydrate())).toEqual(source)
    await page.getByLabel('Protected view', { exact: true }).selectOption('spectator')
    await expect(explore).toBeDisabled()
    expect(
        await page.evaluate(() => window.lowenherzSession.gameState.players.map((p) => p.money))
    ).toEqual(source.players.map(() => undefined))
    expect(errors).toEqual([])
})

for (const source of ['local', 'unmarked hosted']) {
    test(`Debug permits exploration of an already-canonical ${source} game`, async ({ page }) => {
        if (source === 'unmarked hosted') {
            await page.route('**/harnessSessions.svelte.js*', async (route) => {
                const response = await route.fetch()
                const body = await response.text()
                const load = /let \{ game, actions \} = [^\n]+;/
                expect(body).toMatch(load)
                await route.fulfill({
                    response,
                    body: body.replace(
                        load,
                        "$&\ngame.storage = 'remote'; game.hotseat = false; delete game.protectedInformation;"
                    )
                })
            })
        }
        await createPrivateMoneyGame(page)
        const explore = page.getByRole('button', { name: 'start exploring', exact: true })
        await expect(explore).toBeDisabled()
        await page
            .locator('label')
            .filter({
                has: page.getByRole('checkbox', { name: 'Debug', exact: true })
            })
            .click()
        await expect.poll(() => page.evaluate(() => window.lowenherzSession.showDebug)).toBe(true)
        expect(await page.evaluate(() => window.lowenherzSession.isViewingHost)).toBe(false)
        if (source === 'unmarked hosted') {
            expect(
                await page.evaluate(() => ({
                    storage: window.lowenherzSession.game.storage,
                    hotseat: window.lowenherzSession.game.hotseat,
                    protectedInformation: window.lowenherzSession.game.protectedInformation
                }))
            ).toEqual({ storage: 'remote', hotseat: false, protectedInformation: undefined })
        }
        await expect(explore).toBeEnabled()
        const sourceState = await page.evaluate(() => window.lowenherzSession.gameState.dehydrate())
        await explore.click()
        await expect.poll(() => page.evaluate(() => window.lowenherzSession.isExploring)).toBe(true)
        expect(
            await page.evaluate(() => window.lowenherzSession.gameState.players.map((p) => p.money))
        ).toEqual(sourceState.players.map((p) => p.money))
        await page.evaluate(() => window.lowenherzSession.drawActionCard())
        await expect
            .poll(() => page.evaluate(() => window.lowenherzSession.gameState.actionCount))
            .toBeGreaterThan(sourceState.actionCount)
        await page.evaluate(() => window.lowenherzSession.undo())
        await expect
            .poll(() => page.evaluate(() => window.lowenherzSession.gameState.actionCount))
            .toBe(sourceState.actionCount)
        await page.getByRole('button', { name: 'Back to game', exact: true }).click()
        await expect
            .poll(() => page.evaluate(() => window.lowenherzSession.isExploring))
            .toBe(false)
        expect(await page.evaluate(() => window.lowenherzSession.gameState.dehydrate())).toEqual(
            sourceState
        )
        await page
            .locator('label')
            .filter({
                has: page.getByRole('checkbox', { name: 'Debug', exact: true })
            })
            .click()
        await expect(explore).toBeDisabled()
    })
}
