import { expect, test, type Page } from '@playwright/test'
import type { ZertzGameSession } from '../src/lib/model/session.svelte.js'

declare global {
    interface Window {
        zertzSession: ZertzGameSession
    }
}

const pageErrors = new WeakMap<Page, string[]>()

test.use({ reducedMotion: 'reduce' })

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
            body: body.replace('return getContext();', 'return window.zertzSession = getContext();')
        })
    })
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'New game', exact: true }).click()
    await page.getByPlaceholder('choose a name for your game').fill('Table')
    await page
        .getByPlaceholder('optional reproduction seed')
        .fill('0123456789abcdef0123456789abcdef')
    const names = page.getByPlaceholder('player name')
    for (let i = 1; i < (await names.count()); i++) await names.nth(i).fill(`Player ${i + 1}`)
    await page.getByRole('button', { name: 'Create Game', exact: true }).click()
    await expect.poll(() => page.evaluate(() => !!window.zertzSession)).toBe(true)
    await expect(page.getByRole('group', { name: 'ZÈRTZ board' })).toBeVisible()
}

function placeRings(page: Page) {
    return page.getByRole('button', { name: /^place / })
}

function removeRings(page: Page) {
    return page.getByRole('button', { name: /^remove / })
}

function undoButton(page: Page) {
    return page.getByRole('button', { name: 'UNDO', exact: true })
}

function actionCount(page: Page) {
    return page.evaluate(() => window.zertzSession.gameState.actionCount)
}

async function stageWhite(page: Page) {
    await page.getByRole('button', { name: /^white marble/ }).click()
    // The middle of the board, where no ring is free to remove.
    await page.getByRole('button', { name: 'place D4' }).click()
    await expect(page.getByRole('button', { name: /^staged D4|^ring D4/ })).toHaveCount(1)
}

test('a staged marble shows the rings to remove, and Undo takes it back', async ({ page }) => {
    await createGame(page)
    await expect(placeRings(page)).toHaveCount(0)
    await expect(undoButton(page)).toHaveCount(0)

    await stageWhite(page)
    expect(await removeRings(page).count()).toBeGreaterThan(0)

    await undoButton(page).click()
    await expect(removeRings(page)).toHaveCount(0)
    expect(await placeRings(page).count()).toBeGreaterThan(0)

    await undoButton(page).click()
    await expect(placeRings(page)).toHaveCount(0)
    await expect(undoButton(page)).toHaveCount(0)
})

test('removing a ring hands the turn on, and Undo stands the marble back on its ring', async ({
    page
}) => {
    await createGame(page)
    const before = await actionCount(page)
    const mover = await page.evaluate(() => window.zertzSession.gameState.activePlayerIds[0])

    await stageWhite(page)
    await removeRings(page).first().click()
    await expect.poll(() => actionCount(page)).toBe(before + 1)
    expect(await page.evaluate(() => window.zertzSession.gameState.activePlayerIds[0])).not.toBe(
        mover
    )

    await undoButton(page).click()
    await expect.poll(() => actionCount(page)).toBe(before)
    expect(await removeRings(page).count()).toBeGreaterThan(0)
})
