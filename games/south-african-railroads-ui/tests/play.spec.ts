import { expect, test, type Page } from '@playwright/test'
import type { SarGameSession } from '../src/lib/model/session.svelte.js'

declare global {
    interface Window {
        sarSession: SarGameSession
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

async function createGame(page: Page, map: string) {
    await page.route('**/model/sessionContext.svelte.ts*', async (route) => {
        const response = await route.fetch()
        const body = await response.text()
        expect(body).toContain('return getContext();')
        await route.fulfill({
            response,
            body: body.replace('return getContext();', 'return window.sarSession = getContext();')
        })
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'New game', exact: true }).click()
    await page.getByPlaceholder('choose a name for your game').fill('SAR')
    await page
        .getByPlaceholder('optional reproduction seed')
        .fill('0123456789abcdef0123456789abcdef')
    const names = page.getByPlaceholder('player name')
    for (let i = 1; i < (await names.count()); i++) await names.nth(i).fill(`Player ${i + 1}`)
    await page
        .locator('select')
        .filter({ has: page.locator('option', { hasText: map }) })
        .selectOption({ label: map })
    await page.getByRole('button', { name: 'Create Game', exact: true }).click()
    await expect
        .poll(() => page.evaluate(() => !!window.sarSession), { timeout: 20_000 })
        .toBe(true)
}

function machineState(page: Page) {
    return page.evaluate(() => window.sarSession.gameState.machineState)
}

async function screenshot(page: Page, name: string) {
    await page.screenshot({ path: test.info().outputPath(`${name}.png`) })
}

// Hotseat play: every seat is local, so whoever is active can act through the panel.
async function playInitialOffering(page: Page) {
    for (let step = 0; step < 40 && (await machineState(page)) !== 'ChoosingAction'; step++) {
        if ((await machineState(page)) === 'Bidding') {
            const bid = page.getByRole('button', { name: /^Bid \$/ })
            if (step % 3 === 0 && (await bid.count()) > 0) {
                // Bids fund the treasuries; $1 bids leave every railroad unable to build.
                for (let raise = 0; raise < 15; raise++) {
                    await page.getByRole('button', { name: 'Raise the bid' }).click()
                }
                await bid.click()
            } else {
                await page.getByRole('button', { name: 'Pass', exact: true }).click()
            }
        } else {
            await page
                .getByRole('button', { name: /^Build / })
                .first()
                .locator('.hit-box')
                .click()
        }
        await page.waitForTimeout(150)
    }
}

test('plays the initial offering and a construction turn on the board', async ({ page }) => {
    await createGame(page, 'Texas Special')
    await expect(page.getByText(/^initial offering$/i)).toBeVisible()
    await screenshot(page, '01-initial-auction')

    await playInitialOffering(page)
    await expect.poll(() => machineState(page)).toBe('ChoosingAction')
    const open = await page.evaluate(
        () => window.sarSession.gameState.railroads.filter((railroad) => railroad.open).length
    )
    expect(open).toBe(5)
    await screenshot(page, '02-first-turn')

    await page.getByRole('button', { name: 'Choose Construct Track' }).click()
    await expect.poll(() => machineState(page)).toBe('ConstructingTrack')
    await screenshot(page, '03-constructing')
    const tracks = await page.evaluate(() => window.sarSession.gameState.track.length)
    const railroadCard = page.getByRole('button', { name: /^Choose the / })
    if ((await railroadCard.count()) > 0) {
        await railroadCard.first().click()
    }
    await page
        .getByRole('button', { name: /^Build / })
        .first()
        .locator('.hit-box')
        .click()
    const oneLink = page.getByRole('button', { name: /^build one link/i })
    if ((await oneLink.count()) > 0) {
        await screenshot(page, '04-double-choice')
        await oneLink.click()
    }
    await expect
        .poll(() => page.evaluate(() => window.sarSession.gameState.track.length))
        .toBeGreaterThan(tracks)
    await screenshot(page, '05-after-build')
})

test('develops a settlement through the board', async ({ page }) => {
    await createGame(page, 'Texas Special')
    await playInitialOffering(page)
    await page.getByRole('button', { name: 'Choose Develop Settlements' }).click()
    await expect.poll(() => machineState(page)).toBe('DevelopingSettlements')
    await screenshot(page, '06-developing')
    await page
        .getByRole('button', { name: /^Develop / })
        .first()
        .click()
    await expect
        .poll(() => page.evaluate(() => window.sarSession.gameState.developmentsThisTurn))
        .toBe(1)
})

test('fits a phone screen without sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 740 })
    await createGame(page, 'Texas Special')
    await playInitialOffering(page)
    await expect.poll(() => machineState(page)).toBe('ChoosingAction')
    await screenshot(page, '07-phone')
    const overflow = await page.evaluate(() =>
        ['.action-area', '[aria-label="Action boxes"]'].map((selector) => {
            const element = document.querySelector(selector)
            if (!element) {
                return `${selector} missing`
            }
            const right = Math.max(
                ...[element, ...element.querySelectorAll('*')].map(
                    (part) => part.getBoundingClientRect().right
                )
            )
            return right > window.innerWidth + 1 ? `${selector} overflows` : 'fits'
        })
    )
    expect(overflow).toEqual(['fits', 'fits'])
})

test('plays the Pennsylvania Railroad opening, the PRR buyer first', async ({ page }) => {
    await createGame(page, 'Pennsylvania Railroad')
    await playInitialOffering(page)
    await expect.poll(() => machineState(page)).toBe('ChoosingAction')
    const opening = await page.evaluate(() => {
        const state = window.sarSession.gameState
        return {
            mapId: state.mapId,
            firstTurn: state.turnManager.turnOrder[0],
            prrOwner: state.railroads.find((railroad) => railroad.id === 'PRR')?.owners[0]
        }
    })
    expect(opening.mapId).toBe('Pennsylvania')
    expect(opening.firstTurn).toBe(opening.prrOwner)
    const board = page.locator('.settlement-layer')
    await expect(board.locator('.metro-name')).toHaveCount(5)
    await expect(board.locator('.name', { hasText: 'Harrisburg' })).toBeVisible()
    await expect(page.getByText('2nd $3 · Pittsburgh free')).toBeVisible()
    const order = page.getByLabel('Automatic Metro Development order')
    await expect(order.locator('.number')).toHaveText(['1.', '2.', '3.', '4.', '5.'])
    await expect(order.locator('.place.next')).toHaveText('Pittsburgh')
    await screenshot(page, '10-pennsylvania')
})

test('plays the Veld Railroads opening over eight rounds and closed borders', async ({ page }) => {
    await createGame(page, 'Veld Railroads')
    // Before the opening builds, when no one-way link is yet taken.
    await expect(page.locator('.one-way-layer .one-way')).toHaveCount(2)
    await playInitialOffering(page)
    await expect.poll(() => machineState(page)).toBe('ChoosingAction')
    const opening = await page.evaluate(() => {
        const state = window.sarSession.gameState
        return {
            mapId: state.mapId,
            firstTurn: state.turnManager.turnOrder[0],
            cmrcOwner: state.railroads.find((railroad) => railroad.id === 'CMRC')?.owners[0]
        }
    })
    expect(opening.mapId).toBe('Veld')
    expect(opening.firstTurn).toBe(opening.cmrcOwner)
    await expect(page.locator('.timer .round')).toContainText('1 of 8')
    await expect(page.locator('.border-layer .caption')).toHaveText([
        'closed until dividend 1',
        'closed until dividend 2',
        'closed until dividend 3'
    ])
    // The rules are read from the ? button, not printed on the board.
    await page.getByRole('button', { name: 'Map rules' }).click()
    await expect(page.getByRole('dialog', { name: 'Veld Railroads rules' })).toContainText(
        'Round 4, War'
    )
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await screenshot(page, '11-veld')
})

test('plays the Texas Special opening, the Frisco buyer first', async ({ page }) => {
    await createGame(page, 'Texas Special')
    await expect(page.getByText(/^initial offering$/i)).toBeVisible()
    await playInitialOffering(page)
    await expect.poll(() => machineState(page)).toBe('ChoosingAction')
    const opening = await page.evaluate(() => {
        const state = window.sarSession.gameState
        return {
            mapId: state.mapId,
            open: state.railroads
                .filter((railroad) => railroad.open)
                .map((railroad) => railroad.id),
            firstTurn: state.turnManager.turnOrder[0],
            friscoOwner: state.railroads.find((railroad) => railroad.id === 'SLSF')?.owners[0]
        }
    })
    expect(opening.mapId).toBe('TexasSpecial')
    expect(opening.open.toSorted()).toEqual(['GHH', 'MKT', 'MP', 'SLSF', 'SP'])
    expect(opening.firstTurn).toBe(opening.friscoOwner)
    await expect(page.getByText(/opens when track reaches dallas/i)).toBeVisible()
    await screenshot(page, '08-south-african-railroads')
})

test('declines a second Texas Special development, so Dallas develops', async ({ page }) => {
    await createGame(page, 'Texas Special')
    await playInitialOffering(page)
    await page.getByRole('button', { name: 'Choose Develop Settlements' }).click()
    await expect.poll(() => machineState(page)).toBe('DevelopingSettlements')
    await page
        .getByRole('button', { name: /^Develop / })
        .first()
        .click()
    await page.getByRole('button', { name: /^decline · dallas develops$/i }).click()
    await expect
        .poll(() => page.evaluate(() => window.sarSession.gameState.developments.dallas))
        .toBe(1)
})
