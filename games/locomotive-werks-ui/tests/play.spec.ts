import { expect, test, type Page } from '@playwright/test'
import type { LwGameSession } from '../src/lib/model/session.svelte.js'

declare global {
    interface Window {
        lwSession: LwGameSession
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

async function createGame(page: Page, options: string[] = []) {
    await page.route('**/model/sessionContext.svelte.ts*', async (route) => {
        const response = await route.fetch()
        const body = await response.text()
        expect(body).toContain('return getContext();')
        await route.fulfill({
            response,
            body: body.replace('return getContext();', 'return window.lwSession = getContext();')
        })
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'New game', exact: true }).click()
    await page.getByPlaceholder('choose a name for your game').fill('Locomotive Werks')
    await page
        .getByPlaceholder('optional reproduction seed')
        .fill('0123456789abcdef0123456789abcdef')
    const names = page.getByPlaceholder('player name')
    for (let i = 1; i < (await names.count()); i++) await names.nth(i).fill(`Player ${i + 1}`)
    for (const option of options) {
        await page.locator('label', { hasText: option }).click()
    }
    await page.getByRole('button', { name: 'Create Game', exact: true }).click()
    await expect.poll(() => page.evaluate(() => !!window.lwSession), { timeout: 20_000 }).toBe(true)
}

// Waits until the last press has been applied and drawn, however slow the machine.
async function settle(page: Page) {
    await page.waitForTimeout(150)
    await expect
        .poll(() => page.evaluate(() => window.lwSession.busy), { timeout: 20_000 })
        .toBe(false)
}

function machineState(page: Page) {
    return page.evaluate(() => window.lwSession.gameState.machineState)
}

function round(page: Page) {
    return page.evaluate(() => window.lwSession.gameState.roundManager.series.length)
}

// Hotseat play: every seat is local, so whoever is active acts through the table.
async function playRound(page: Page) {
    const start = await round(page)
    for (let step = 0; step < 60 && (await round(page)) === start; step++) {
        const skipReview = page.getByRole('button', { name: /^Skip to Round/ })
        if (await skipReview.isVisible()) {
            await skipReview.click()
        }
        switch (await machineState(page)) {
            case 'Developing': {
                const develop = page.locator('button.choice:enabled')
                if ((await develop.count()) > 0) {
                    await develop.last().click()
                } else {
                    await page.getByRole('button', { name: 'Develop nothing' }).click()
                }
                break
            }
            case 'ExpandingCapacity': {
                const add = page.getByRole('button', { name: /^Add a unit/ }).first()
                if (await add.isEnabled()) {
                    await add.click()
                } else {
                    await page.getByRole('button', { name: /^Done/ }).click()
                }
                break
            }
            case 'Shipping':
                await page.getByRole('button', { name: /^Ship ·/ }).click()
                break
        }
        await settle(page)
    }
    expect(await round(page)).toBe(start + 1)
}

test('plays two rounds of the Queen rules through the table', async ({ page }) => {
    await createGame(page)
    await expect(page.getByText('Round 1', { exact: true })).toBeVisible()
    await playRound(page)
    await playRound(page)
    await expect(page.getByText('Round 2', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Skip to Round 3' }).click()
    await expect(page.getByText('Round 3', { exact: true })).toBeVisible()
    await page.getByText('History', { exact: true }).click()
    await expect(page.getByText('Market Demands').first()).toBeVisible()
    await expect(page.getByText(/^Player Order:/).first()).toBeVisible()
})

test('Lucas Order ships straight after buying capacity', async ({ page }) => {
    await createGame(page, ['Lucas Order'])
    while ((await machineState(page)) === 'Developing') {
        await page.getByRole('button', { name: 'Develop nothing' }).click()
        await settle(page)
    }
    await expect(page.locator('li[aria-current="step"]')).toHaveText('Capacity & First Shipment')
    const first = await page.evaluate(() => window.lwSession.myPlayerId)
    await page.getByRole('button', { name: 'Done, on to shipping' }).click()
    await expect.poll(() => machineState(page)).toBe('Shipping')
    expect(await page.evaluate(() => window.lwSession.myPlayerId)).toBe(first)
    await page.getByRole('button', { name: /^Ship ·/ }).click()
    await expect.poll(() => machineState(page)).toBe('ExpandingCapacity')
    expect(await page.evaluate(() => window.lwSession.myPlayerId)).not.toBe(first)
})

test('a player who ticks automatic shipping ships without being asked', async ({ page }) => {
    await createGame(page, ['Lucas Order'])
    while ((await machineState(page)) === 'Developing') {
        await page.getByRole('button', { name: 'Develop nothing' }).click()
        await settle(page)
    }
    const first = await page.evaluate(() => window.lwSession.myPlayerId)
    const autoShip = page.getByRole('checkbox', { name: 'Ship everything automatically' })
    await expect(autoShip).not.toBeChecked()
    await autoShip.check()
    await page.getByRole('button', { name: 'Done, on to shipping' }).click()
    await expect.poll(() => page.evaluate(() => window.lwSession.myPlayerId)).not.toBe(first)
    expect(await machineState(page)).toBe('ExpandingCapacity')
    await expect(page.getByText('Shipping everything automatically')).toHaveCount(1)
    await expect(autoShip).not.toBeChecked()
    await page.getByText('History', { exact: true }).click()
    await expect(page.getByText(/auto-shipped for \$\d+/)).toBeVisible()
})

test('the capacity table plans units until Done buying, and Undo takes back a press', async ({
    page
}) => {
    await createGame(page)
    await page.locator('button.choice', { hasText: 'Fast' }).click()
    while ((await machineState(page)) === 'Developing') {
        await page.getByRole('button', { name: 'Develop nothing' }).click()
        await settle(page)
    }
    const me = await page.evaluate(() => window.lwSession.myPlayerId)
    const cash = await page.evaluate(() => window.lwSession.myCash)
    const plants = () =>
        page.evaluate(
            (playerId) =>
                window.lwSession.gameState
                    .getPlayerState(playerId ?? '')
                    .plants.map((plant) => `${plant.locomotiveId}:${plant.units}`),
            me
        )
    const units = page.locator('table span.units')
    await expect(units).toHaveText(['1', '1'])

    await page.getByRole('button', { name: 'Add a unit to Passenger I for $2' }).click()
    await expect(units).toHaveText(['2', '1'])
    await expect(page.getByText('$2 planned')).toBeVisible()
    expect(await plants()).toEqual(['passenger-1:1', 'fast-1:1'])
    await page.getByRole('button', { name: 'UNDO' }).click()
    await expect(units).toHaveText(['1', '1'])

    await page.getByRole('button', { name: 'Add a unit to Passenger I for $2' }).click()
    await page.getByRole('button', { name: 'Upgrade a unit to Fast I for $2' }).click()
    await expect(units).toHaveText(['1', '2'])
    await page.getByRole('button', { name: 'Done buying · $4' }).click()
    await expect.poll(plants).toEqual(['passenger-1:1', 'fast-1:2'])
    expect(
        await page.evaluate(
            (playerId) => window.lwSession.gameState.getPlayerState(playerId ?? '').cash,
            me
        )
    ).toBe(cash - 4)
})

test('the round review steps through Production, Taxes and Market Demands', async ({ page }) => {
    await createGame(page)
    await playRound(page)
    const review = page.getByRole('region', { name: 'Round review' })
    const phase = page.locator('li[aria-current="step"]')
    await expect(page.getByText('Round 1', { exact: true })).toBeVisible()
    await expect(phase).toHaveText('Production')
    await expect(review.getByText('Shipped this Production')).toBeVisible()
    await review.getByRole('button', { name: 'Next: Taxes' }).click()
    await expect(phase).toHaveText('Taxes')
    await expect(review.getByText('Taxes and Player Order for Round 2')).toBeVisible()
    await review.getByRole('button', { name: 'Next: Market Demands' }).click()
    await expect(phase).toHaveText('Market Demands')
    await expect(review.getByText('Market Demands', { exact: true })).toBeVisible()
    await review.getByRole('button', { name: 'On to Round 2' }).click()
    await expect(review).toHaveCount(0)
    await expect(page.getByText('Round 2', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /^(Develop nothing|Done buying)/ })).toBeVisible()
})

test('the game does not wait for the round review', async ({ page }) => {
    await createGame(page)
    await playRound(page)
    await expect(page.getByRole('region', { name: 'Round review' })).toBeVisible()
    expect(await page.evaluate(() => window.lwSession.gameState.round())).toBe(2)
    expect(await page.evaluate(() => window.lwSession.gameState.activePlayerIds.length)).toBe(1)
})

test('the phase track marks the phase in progress', async ({ page }) => {
    await createGame(page)
    await expect(page.locator('li[aria-current="step"]')).toHaveText('Development')
    while ((await machineState(page)) === 'Developing') {
        await page.getByRole('button', { name: 'Develop nothing' }).click()
        await settle(page)
    }
    await expect(page.locator('li[aria-current="step"]')).toHaveText('Production Capacity')
})

test('the colour-blind setting adds a shape to each kind', async ({ page }) => {
    await createGame(page)
    const shapes = page.locator('#lw-row-passenger-1 .kind-shape')
    await expect(shapes).toHaveCount(0)
    await page.getByRole('checkbox', { name: 'Colour-blind colours and shapes' }).check()
    await expect(shapes).toHaveCount(2)
    await expect(page.getByText('Tax at this cash').first()).toBeVisible()
})
