import { expect, test, type Page } from '@playwright/test'
import type { MagnaGreciaGameSession } from '../src/lib/model/session.svelte.js'

declare global {
    interface Window {
        magnaGreciaSession: MagnaGreciaGameSession
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
                'return window.magnaGreciaSession = getContext();'
            )
        })
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'New game', exact: true }).click()
    await page.getByPlaceholder('choose a name for your game').fill('Turn controls')
    await page
        .getByPlaceholder('optional reproduction seed')
        .fill('0123456789abcdef0123456789abcdef')
    const names = page.getByPlaceholder('player name')
    for (let i = 1; i < (await names.count()); i++) await names.nth(i).fill(`Player ${i + 1}`)
    await page.getByRole('button', { name: 'Create Game', exact: true }).click()
    await expect.poll(() => page.evaluate(() => !!window.magnaGreciaSession)).toBe(true)
}

function picker(page: Page) {
    return page.locator('[aria-label="Road tile picker"]')
}

function roadTargets(page: Page) {
    return page.getByRole('button', { name: 'Build a road here', exact: true })
}

async function roadCount(page: Page) {
    return page.evaluate(() => window.magnaGreciaSession.gameState.board.roads.length)
}

async function foundFrontierCity(page: Page) {
    await createGame(page)
    await page.getByRole('button', { name: /^Cities/ }).click()
    await page.getByRole('button', { name: 'Place a city tile here', exact: true }).first().click()
    await expect
        .poll(() => page.evaluate(() => window.magnaGreciaSession.gameState.board.cities.length))
        .toBe(1)
    await page.getByRole('button', { name: /^Roads/ }).click()
}

async function openRoadPicker(page: Page) {
    await foundFrontierCity(page)
    await roadTargets(page).first().click()
    await expect(picker(page)).toBeVisible()
}

async function chooseAShape(page: Page) {
    if (await page.evaluate(() => window.magnaGreciaSession.roadShape === undefined)) {
        await page
            .getByRole('button', { name: /^Choose the (straight|curved) road tile$/ })
            .first()
            .click()
    }
    await expect(page.getByRole('button', { name: 'Place this road tile' })).toBeVisible()
}

test('starts each turn with no tool selected', async ({ page }) => {
    await createGame(page)
    const tool = () => page.evaluate(() => window.magnaGreciaSession.activeTool)
    await expect(page.getByText('Choose an action', { exact: true })).toBeVisible()
    await expect.poll(tool).toBeUndefined()
    await expect(
        page.getByRole('button', { name: 'Place a city tile here', exact: true })
    ).toHaveCount(0)

    await page.getByRole('button', { name: /^Cities/ }).click()
    await expect.poll(tool).toBe('City')
    await page.getByRole('button', { name: 'Place a city tile here', exact: true }).first().click()
    await page.getByRole('button', { name: 'End turn', exact: true }).click()
    await expect.poll(tool).toBeUndefined()
    await expect(roadTargets(page)).toHaveCount(0)
})

test('choosing, rotating and confirming lays the previewed road and closes the widget', async ({
    page
}) => {
    await openRoadPicker(page)
    await chooseAShape(page)
    const before = await roadCount(page)
    const preview = () => page.evaluate(() => window.magnaGreciaSession.roadPreview)
    const first = await preview()
    if (await page.evaluate(() => window.magnaGreciaSession.roadPlacements.length > 1)) {
        await page.getByRole('button', { name: 'Rotate the road tile' }).click()
        await expect.poll(preview).not.toEqual(first)
    }
    const chosen = await preview()
    await page.getByRole('button', { name: 'Place this road tile' }).click()
    await expect.poll(() => roadCount(page)).toBe(before + 1)
    const laid = await page.evaluate(() => window.magnaGreciaSession.gameState.board.roads.at(-1))
    expect(laid?.ends).toEqual(chosen)
    await expect(picker(page)).toHaveCount(0)
})

test('cancelling closes the widget without laying a road', async ({ page }) => {
    await openRoadPicker(page)
    await chooseAShape(page)
    const before = await roadCount(page)
    await page.getByRole('button', { name: 'Cancel road placement' }).click()
    await expect(picker(page)).toHaveCount(0)
    expect(await roadCount(page)).toBe(before)
    await expect(roadTargets(page).first()).toBeVisible()
})

test('Undo returns a manual shape to the arc before closing the widget', async ({ page }) => {
    await openRoadPicker(page)
    const choices = await page.evaluate(() => window.magnaGreciaSession.roadShapeChoices.length)
    await chooseAShape(page)
    await page.getByRole('button', { name: 'UNDO', exact: true }).click()
    if (choices > 1) {
        await expect(picker(page)).toBeVisible()
        await expect
            .poll(() => page.evaluate(() => window.magnaGreciaSession.roadShape))
            .toBeUndefined()
        await page.getByRole('button', { name: 'UNDO', exact: true }).click()
    }
    await expect(picker(page)).toHaveCount(0)
})

test('Undo deselects a chosen tool before undoing any action', async ({ page }) => {
    await createGame(page)
    const tool = () => page.evaluate(() => window.magnaGreciaSession.activeTool)
    const undo = page.getByRole('button', { name: 'UNDO', exact: true })
    await expect(undo).toHaveCount(0)

    await page.getByRole('button', { name: /^Cities/ }).click()
    await expect.poll(tool).toBe('City')
    await undo.click()
    await expect.poll(tool).toBeUndefined()
    await expect(undo).toHaveCount(0)
})

test('a tool stays chosen after placing, and Undo then undoes the placement', async ({ page }) => {
    await createGame(page)
    const tool = () => page.evaluate(() => window.magnaGreciaSession.activeTool)
    const cities = () =>
        page.evaluate(() => window.magnaGreciaSession.gameState.board.cities.length)
    await page.getByRole('button', { name: /^Cities/ }).click()
    await page.getByRole('button', { name: 'Place a city tile here', exact: true }).first().click()
    await expect.poll(cities).toBe(1)
    await expect.poll(tool).toBe('City')

    await page.getByRole('button', { name: 'UNDO', exact: true }).click()
    await expect.poll(cities).toBe(0)
    await expect.poll(tool).toBe('City')
})

test('a tool chosen then undone does not return when the turn comes round again', async ({
    page
}) => {
    await createGame(page)
    const tool = () => page.evaluate(() => window.magnaGreciaSession.activeTool)
    const turnOf = () => page.evaluate(() => window.magnaGreciaSession.gameState.turn?.playerId)
    const undo = page.getByRole('button', { name: 'UNDO', exact: true })
    const endTurn = page.getByRole('button', { name: 'End turn', exact: true })

    const first = await turnOf()
    await endTurn.click()
    await expect.poll(turnOf).not.toBe(first)
    const second = await turnOf()

    await page.getByRole('button', { name: /^Cities/ }).click()
    await expect.poll(tool).toBe('City')
    await undo.click()
    await expect.poll(tool).toBeUndefined()
    await expect.poll(turnOf).toBe(second)

    await page.getByRole('button', { name: /^Cities/ }).click()
    await undo.click()
    await undo.click()
    await expect.poll(turnOf).toBe(first)
    await expect.poll(tool).toBeUndefined()

    await endTurn.click()
    await expect.poll(turnOf).toBe(second)
    await expect.poll(tool).toBeUndefined()
})

test('a chosen mode hides the tile actions it rules out until Undo', async ({ page }) => {
    await createGame(page)
    const cities = page.getByRole('button', { name: /^Cities/ })
    const resupply = page.getByRole('button', { name: /^Resupply/ })
    const undo = page.getByRole('button', { name: 'UNDO', exact: true })

    await resupply.click()
    await expect(cities).toHaveCount(0)
    await expect(resupply).toBeVisible()
    await undo.click()
    await expect(cities).toBeVisible()

    await page.getByRole('button', { name: 'Build market', exact: true }).click()
    await expect(cities).toHaveCount(0)
    await expect(resupply).toHaveCount(0)
    await undo.click()
    await expect(cities).toBeVisible()
    await expect(resupply).toBeVisible()
})

test('on a phone the turn steps from tile actions to the market and back with Undo', async ({
    page
}) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await createGame(page)
    const cities = page.getByRole('button', { name: /^Cities/ })
    const skip = page.getByRole('button', { name: /^Skip/ })
    const buy = page.getByRole('button', { name: 'Build market', exact: true })
    const endTurn = page.getByRole('button', { name: 'End turn', exact: true })

    await expect(cities).toBeVisible()
    await expect(skip).toBeVisible()
    await expect(buy).toBeHidden()
    await expect(endTurn).toBeHidden()

    await skip.click()
    await expect(cities).toBeHidden()
    await expect(buy).toBeVisible()
    await expect(endTurn).toBeVisible()

    await page.getByRole('button', { name: 'UNDO', exact: true }).click()
    await expect(cities).toBeVisible()
    await expect(buy).toBeHidden()
})

test('another road space moves the widget and another tool closes it', async ({ page }) => {
    await openRoadPicker(page)
    const targets = await roadTargets(page).count()
    const space = () => page.evaluate(() => window.magnaGreciaSession.roadSpace)
    const first = await space()
    if (targets > 1) {
        await roadTargets(page).nth(1).click()
        await expect.poll(space).not.toEqual(first)
        await expect(picker(page)).toBeVisible()
    }
    await page.getByRole('button', { name: /^Cities/ }).click()
    await expect(picker(page)).toHaveCount(0)
})

test('closing the resupply picker restores the chosen tool', async ({ page }) => {
    await foundFrontierCity(page)
    const tool = () => page.evaluate(() => window.magnaGreciaSession.activeTool)
    const chosen = await tool()
    await page.getByRole('button', { name: /^Resupply/ }).click()
    await expect.poll(tool).toBeUndefined()
    await expect(roadTargets(page)).toHaveCount(0)
    await page.getByRole('button', { name: /^Resupply/ }).click()
    await expect.poll(tool).toBe(chosen)
    await expect(roadTargets(page).first()).toBeVisible()

    await page.getByRole('button', { name: /^Resupply/ }).click()
    await expect.poll(tool).toBeUndefined()
    await page.getByRole('button', { name: 'UNDO', exact: true }).click()
    await expect.poll(tool).toBe(chosen)
    await expect.poll(() => page.evaluate(() => window.magnaGreciaSession.resupplyOpen)).toBe(false)
})

test('the keyboard jump button jumps to history without starting a replay', async ({ page }) => {
    await createGame(page)
    await page.getByRole('button', { name: /^Cities/ }).click()
    await page.getByRole('button', { name: 'Place a city tile here', exact: true }).first().click()
    await page.getByRole('button', { name: 'End turn', exact: true }).click()
    await page.getByRole('tab', { name: 'History' }).click()

    const jump = page.getByRole('button', { name: 'Jump to this action in history' }).last()
    await jump.focus()
    await page.keyboard.press('Enter')
    await expect
        .poll(() => page.evaluate(() => window.magnaGreciaSession.isViewingHistory))
        .toBe(true)
    await expect(page.getByText('Replaying', { exact: true })).toHaveCount(0)
})

test('marks the enhanced extra apart from the basic allowance', async ({ page }) => {
    await createGame(page)
    const cities = page.getByRole('button', { name: /^Cities/ })
    const split = await page.evaluate(() => window.magnaGreciaSession.cityAllowance)
    expect(split.bonus).toBe(1)
    await expect(cities.locator('.count')).toHaveText(String(split.basic))
    await expect(cities.locator('.bonus')).toHaveText('+1')
    await cities.click()
    await expect(
        page.getByText(`or ${split.basic + 1} as your only action (★ enhanced)`, { exact: false })
    ).toBeVisible()
})

test('a market action keeps the turn open and highlights End turn', async ({ page }) => {
    await createGame(page)
    const turnOf = () => page.evaluate(() => window.magnaGreciaSession.gameState.turn?.playerId)
    const first = await turnOf()
    const endTurn = page.getByRole('button', { name: 'End turn', exact: true })
    await expect(endTurn).not.toHaveClass(/ready/)

    await page.getByRole('button', { name: 'Build market', exact: true }).click()
    await expect(page.getByText('Skipped', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Build a market here', exact: true }).first().click()
    await expect
        .poll(() => page.evaluate(() => window.magnaGreciaSession.gameState.board.markets.length))
        .toBe(1)
    expect(await turnOf()).toBe(first)
    await expect(endTurn).toHaveClass(/ready/)
    await expect(page.getByText('Skipped', { exact: true })).toBeVisible()
    await expect(
        page.getByRole('button', { name: /^(Roads|Cities|Resupply|Build market|Sell market)/ })
    ).toHaveCount(0)

    await endTurn.click()
    await expect.poll(turnOf).not.toBe(first)
})

test('warns the last player of a round before an early End turn', async ({ page }) => {
    await createGame(page)
    const endTurn = page.getByRole('button', { name: 'End turn', exact: true })
    const cities = page.getByRole('button', { name: /^Cities/ })
    const warning =
        'Ending your turn starts the next round and reveals a new action card. It cannot be undone.'
    const turnIndex = () => page.evaluate(() => window.magnaGreciaSession.gameState.turnIndex)
    const players = await page.evaluate(
        () => window.magnaGreciaSession.gameState.turnManager.turnOrder.length
    )
    for (let turn = 0; turn < players - 1; turn++) {
        await expect(page.getByText(warning)).toHaveCount(0)
        await expect(endTurn).not.toHaveClass(/caution/)
        await endTurn.click()
        await expect.poll(turnIndex).toBe(turn + 1)
    }

    await expect(cities).toBeVisible()
    await expect(page.getByText(warning)).toBeVisible()
    await expect(endTurn).toHaveClass(/caution/)
    await expect(endTurn).toHaveAttribute('title', warning)

    await cities.click()
    await expect(page.getByText(warning)).toHaveCount(0)
    await expect(endTurn).toHaveClass(/caution/)
})
