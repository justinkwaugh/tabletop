import { expect, test, type Page } from '@playwright/test'
import type { OstbahnGameSession } from '../src/lib/model/session.svelte.js'

declare global {
    interface Window {
        ostbahnSession: OstbahnGameSession
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
                'return window.ostbahnSession = getContext();'
            )
        })
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'New game', exact: true }).click()
    await page.getByPlaceholder('choose a name for your game').fill('Ostbahn')
    await page
        .getByPlaceholder('optional reproduction seed')
        .fill('0123456789abcdef0123456789abcdef')
    const names = page.getByPlaceholder('player name')
    for (let i = 1; i < (await names.count()); i++) await names.nth(i).fill(`Investor ${i + 1}`)
    await page.getByRole('button', { name: 'Create Game', exact: true }).click()
    await expect.poll(() => page.evaluate(() => !!window.ostbahnSession)).toBe(true)
}

function machineState(page: Page) {
    return page.evaluate(() => window.ostbahnSession.gameState.machineState)
}

function trackCount(page: Page) {
    return page.evaluate(() =>
        window.ostbahnSession.gameState.railroads.reduce(
            (sum, railroad) => sum + railroad.track.length,
            0
        )
    )
}

test('auctions every opening share, then builds one track per press and takes it back', async ({
    page
}) => {
    await createGame(page)

    for (let auction = 0; auction < 8; auction++) {
        await expect(page.getByText(/^Auctioning 1st share of/)).toBeVisible()
        for (let raise = 0; raise < 5; raise++) {
            await page.getByRole('button', { name: 'Raise the bid' }).click()
        }
        await page.getByRole('button', { name: 'Bid $6' }).click()
        await expect(page.locator('.bid.high')).toContainText('$6')
        while ((await page.locator('.bid.high').count()) > 0) {
            await page.getByRole('button', { name: 'Pass', exact: true }).click()
        }
    }
    await expect.poll(() => machineState(page)).toBe('ChoosingAction')
    await expect(page.getByText('Turn order', { exact: true })).toBeVisible()

    const before = await trackCount(page)
    await page.getByRole('button', { name: 'Build track' }).click()
    const pills = page.locator('button.choice')
    if ((await pills.count()) > 0) {
        await pills.first().click()
    }
    await expect(page.getByText(/^Build .* track$/)).toBeVisible()
    await page.locator('g.target').first().dispatchEvent('click')
    await expect.poll(() => trackCount(page)).toBe(before + 1)

    if ((await machineState(page)) === 'Expanding') {
        await expect(page.getByText(/1 of \d built/)).toBeVisible()
    }
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect.poll(() => trackCount(page)).toBe(before)
    await expect.poll(() => machineState(page)).toBe('ChoosingAction')
})
