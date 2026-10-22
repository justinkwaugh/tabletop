import { expect, test, type Page } from '@playwright/test'
import type { RailheadsGameSession } from '../src/lib/model/session.svelte.js'

declare global {
    interface Window {
        railheadsSession: RailheadsGameSession
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

async function createGame(page: Page, edition = 'Germany') {
    await page.route('**/model/sessionContext.svelte.ts*', async (route) => {
        const response = await route.fetch()
        const body = await response.text()
        expect(body).toContain('return getContext();')
        await route.fulfill({
            response,
            body: body.replace(
                'return getContext();',
                'return window.railheadsSession = getContext();'
            )
        })
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'New game', exact: true }).click()
    await page.getByPlaceholder('choose a name for your game').fill('Railheads')
    await page
        .getByPlaceholder('optional reproduction seed')
        .fill('0123456789abcdef0123456789abcdef')
    await page.locator('#edition').selectOption(edition)
    const names = page.getByPlaceholder('player name')
    for (let i = 1; i < (await names.count()); i++) await names.nth(i).fill(`Player ${i + 1}`)
    await page.getByRole('button', { name: 'Create Game', exact: true }).click()
    await expect.poll(() => page.evaluate(() => !!window.railheadsSession)).toBe(true)
}

function machineState(page: Page) {
    return page.evaluate(() => window.railheadsSession.gameState.machineState)
}

async function screenshot(page: Page, name: string) {
    await page.screenshot({ path: test.info().outputPath(`${name}.png`) })
}

// Hotseat play: every seat is local. Each opener bids once, then everyone else passes.
async function playInitialAuctions(page: Page) {
    for (let step = 0; step < 60 && (await machineState(page)) !== 'ChoosingAction'; step++) {
        const bid = page.getByRole('button', { name: /^Bid \$/ })
        if (step % 5 === 0 && (await bid.count()) > 0) {
            await bid.click()
        } else {
            await page.getByRole('button', { name: 'Pass', exact: true }).click()
        }
        await page.waitForTimeout(100)
    }
}

async function layOneDisc(page: Page, prefix: string) {
    await page.getByRole('button', { name: /^Choose Lay Track III/ }).click()
    await expect.poll(() => machineState(page)).toBe('LayingTrack')
    const company = page.getByRole('button', { name: /^Choose the / })
    if ((await company.count()) > 0) {
        await company.first().click()
    }
    await screenshot(page, `${prefix}-laying-track`)
    await page
        .getByRole('button', { name: /^Lay a disc here/ })
        .first()
        .click()
    await expect(page.getByRole('button', { name: /^Lay 1 piece/ })).toBeVisible()
    await expect(page.locator('.panel .prompt')).toContainText(/lay a disc for/i)
    await screenshot(page, `${prefix}-staged`)
    const tracks = await page.evaluate(() => window.railheadsSession.gameState.track.length)
    await page.getByRole('button', { name: /^Lay 1 piece/ }).click()
    await expect
        .poll(() => page.evaluate(() => window.railheadsSession.gameState.track.length))
        .toBeGreaterThan(tracks)
    await screenshot(page, `${prefix}-after-build`)
}

test('plays the opening auctions and lays track on the map', async ({ page }) => {
    await createGame(page)
    await expect(page.getByText('Initial auction').first()).toBeVisible()
    await screenshot(page, '01-initial-auction')
    await playInitialAuctions(page)
    await expect.poll(() => machineState(page)).toBe('ChoosingAction')
    await screenshot(page, '02-first-turn')
    await layOneDisc(page, '03')
})

test('plays the Midwest opening auctions and lays track on its map', async ({ page }) => {
    await createGame(page, 'Midwest')
    await expect(page.getByRole('img', { name: /towards texas/i })).toBeAttached()
    await expect(page.getByRole('img', { name: /railheads the midwest/i })).toBeAttached()
    await playInitialAuctions(page)
    await expect.poll(() => machineState(page)).toBe('ChoosingAction')
    await expect(page.locator('.money', { hasText: /^1 · \$0$/ }).first()).toBeVisible()
    await screenshot(page, '09-midwest-first-turn')
    await layOneDisc(page, '10-midwest')
})

test('runs a sealed-bid industry auction', async ({ page }) => {
    await createGame(page)
    await playInitialAuctions(page)
    await page.getByRole('button', { name: /^Choose Industry Investment/ }).click()
    await page
        .getByRole('button', { name: /level 2/ })
        .first()
        .click()
    await expect.poll(() => machineState(page)).toBe('SealedBidding')
    await screenshot(page, '06-sealed-bidding')
    for (let seat = 0; seat < 4; seat++) {
        if ((await machineState(page)) !== 'SealedBidding') break
        await page.getByRole('button', { name: /^Seal bid/ }).click()
        await page.waitForTimeout(150)
    }
    await expect.poll(() => machineState(page)).toBe('ChoosingAction')
    await screenshot(page, '07-after-industry-auction')
    await page.getByRole('tab', { name: 'History', exact: true }).click()
    await expect(page.locator('.history .line.bid')).toHaveCount(4)
    await screenshot(page, '07b-revealed-bids')
})

for (const edition of ['Germany', 'Midwest']) {
    test(`fits a phone screen without sideways scrolling in the action area (${edition})`, async ({
        page
    }) => {
        // The harness hides its New game button on narrow screens, so shrink once the game is open.
        await createGame(page, edition)
        await page.setViewportSize({ width: 390, height: 780 })
        await playInitialAuctions(page)
        await screenshot(page, `08-phone-${edition}`)
        const overflow = await page.evaluate(() => ({
            page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            actionAreas: [...document.querySelectorAll<HTMLElement>('.action-area')]
                .filter((area) => area.offsetParent !== null)
                .map((area) => area.scrollWidth - area.clientWidth)
        }))
        expect(overflow.actionAreas.length).toBeGreaterThan(0)
        expect(overflow.page).toBeLessThanOrEqual(0)
        for (const excess of overflow.actionAreas) {
            expect(excess).toBeLessThanOrEqual(0)
        }
    })
}
