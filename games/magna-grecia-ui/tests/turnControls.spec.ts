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
    await page.getByPlaceholder('optional reproduction seed').fill('12345')
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

test('Back returns a manual shape to the arc before closing the widget', async ({ page }) => {
    await openRoadPicker(page)
    const choices = await page.evaluate(() => window.magnaGreciaSession.roadShapeChoices.length)
    await chooseAShape(page)
    await page.getByRole('button', { name: 'BACK', exact: true }).click()
    if (choices > 1) {
        await expect(picker(page)).toBeVisible()
        await expect
            .poll(() => page.evaluate(() => window.magnaGreciaSession.roadShape))
            .toBeUndefined()
        await page.getByRole('button', { name: 'BACK', exact: true }).click()
    }
    await expect(picker(page)).toHaveCount(0)
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
    await page.getByRole('button', { name: 'BACK', exact: true }).click()
    await expect.poll(tool).toBe(chosen)
    await expect
        .poll(() => page.evaluate(() => window.magnaGreciaSession.resupplyOpen))
        .toBe(false)
})
