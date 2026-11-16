import { expect, test, type Page } from '@playwright/test'
import type { GipfPotentialsGameSession } from '../src/lib/model/session.svelte.js'

declare global {
    interface Window {
        gipfPotentialsSession: GipfPotentialsGameSession
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
            body: body.replace(
                'return getContext();',
                'return window.gipfPotentialsSession = getContext();'
            )
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
    await expect.poll(() => page.evaluate(() => !!window.gipfPotentialsSession)).toBe(true)
    await expect(page.getByRole('group', { name: 'GIPF board' })).toBeVisible()
}

function entryDots(page: Page) {
    return page.locator('g.dot.entry')
}

function pushTargets(page: Page) {
    return page.getByRole('button', { name: /^push to / })
}

function undoButton(page: Page) {
    return page.getByRole('button', { name: 'UNDO', exact: true })
}

function actionCount(page: Page) {
    return page.evaluate(() => window.gipfPotentialsSession.gameState.actionCount)
}

test('choosing a dot shows where its piece can push, and Undo lets it go', async ({ page }) => {
    await createGame(page)
    await expect(pushTargets(page)).toHaveCount(0)
    await expect(undoButton(page)).toHaveCount(0)

    await entryDots(page).first().click()
    expect(await pushTargets(page).count()).toBeGreaterThan(0)

    await undoButton(page).click()
    await expect(pushTargets(page)).toHaveCount(0)
    await expect(undoButton(page)).toHaveCount(0)
})

test('pushing a piece hands the turn on, and Undo takes it back out onto its dot', async ({
    page
}) => {
    await createGame(page)
    const before = await actionCount(page)
    const mover = await page.evaluate(
        () => window.gipfPotentialsSession.gameState.activePlayerIds[0]
    )

    await entryDots(page).first().click()
    // The arrows and the staged piece stand over the targets' click areas, so press it instead.
    await pushTargets(page).first().press('Enter')
    await expect.poll(() => actionCount(page)).toBe(before + 1)
    expect(
        await page.evaluate(() => window.gipfPotentialsSession.gameState.activePlayerIds[0])
    ).not.toBe(mover)

    await undoButton(page).click()
    await expect.poll(() => actionCount(page)).toBe(before)
    expect(await pushTargets(page).count()).toBeGreaterThan(0)
})
