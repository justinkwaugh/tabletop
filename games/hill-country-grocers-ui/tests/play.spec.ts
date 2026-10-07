import { expect, test, type Page } from '@playwright/test'
import type { HcgGameSession } from '../src/lib/model/session.svelte.js'

declare global {
    interface Window {
        hcgSession: HcgGameSession
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
            body: body.replace('return getContext();', 'return window.hcgSession = getContext();')
        })
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'New game', exact: true }).click()
    await page.getByPlaceholder('choose a name for your game').fill('HCG')
    await page
        .getByPlaceholder('optional reproduction seed')
        .fill('0123456789abcdef0123456789abcdef')
    const names = page.getByPlaceholder('player name')
    for (let i = 1; i < (await names.count()); i++) await names.nth(i).fill(`Player ${i + 1}`)
    await page.getByRole('button', { name: 'Create Game', exact: true }).click()
    await expect.poll(() => page.evaluate(() => !!window.hcgSession)).toBe(true)
}

function machineState(page: Page) {
    return page.evaluate(() => window.hcgSession.gameState.machineState)
}

async function screenshot(page: Page, name: string) {
    await page.screenshot({ path: test.info().outputPath(`${name}.png`) })
}

// Hotseat play: every seat is local, so whoever is active acts through the panel. Each starter
// opens at $3 and the next player raises once, so every company has money to build with.
async function playInitialAuctions(page: Page) {
    for (let step = 0; step < 60 && (await machineState(page)) !== 'ChoosingAction'; step++) {
        const state = await machineState(page)
        if (state === 'PlacingBonusCube') {
            await page
                .getByRole('button', { name: /^Place a store in / })
                .first()
                .click()
        } else if ((await page.getByRole('button', { name: 'Pass', exact: true }).count()) === 0) {
            for (let raise = 0; raise < 3; raise++) {
                await page.getByRole('button', { name: 'Raise the bid' }).click()
            }
            await page.getByRole('button', { name: /^Bid \$/ }).click()
        } else if (step % 5 === 1) {
            await page.getByRole('button', { name: /^Bid \$/ }).click()
        } else {
            await page.getByRole('button', { name: 'Pass', exact: true }).click()
        }
        await page.waitForTimeout(120)
    }
}

test('plays the initial auctions and builds a network on the map', async ({ page }) => {
    await createGame(page)
    await expect(page.getByText('Initial auction:')).toBeVisible()
    await screenshot(page, '01-initial-auction')

    await playInitialAuctions(page)
    await expect.poll(() => machineState(page)).toBe('ChoosingAction')
    const owned = await page.evaluate(() =>
        window.hcgSession.gameState.companies.every((company) => company.owners.length === 1)
    )
    expect(owned).toBe(true)
    await screenshot(page, '02-first-turn')

    // A player who won no share cannot build, so develop until a shareholder's turn comes up.
    const build = page.getByRole('button', { name: 'Choose Build Stores' })
    for (let turn = 0; turn < 5 && (await build.count()) === 0; turn++) {
        await page.getByRole('button', { name: 'Choose Develop Cities' }).click()
        await page
            .getByRole('button', { name: /^Develop / })
            .first()
            .click()
        const payee = page.getByRole('button', {
            name: /Alamo City|Verbena|Streamside|Comestibles/
        })
        if (
            (await page.getByRole('button', { name: 'Take $1' }).count()) === 0 &&
            (await payee.count()) > 0
        ) {
            await payee.first().click()
        }
        await page.getByRole('button', { name: 'Take $1' }).click()
        await page.waitForTimeout(120)
    }
    await build.click()
    await expect.poll(() => machineState(page)).toBe('BuildingNetwork')
    const companyCard = page.getByRole('button', { name: /^Build for / })
    if ((await companyCard.count()) > 0) {
        await companyCard.first().click()
    }
    await screenshot(page, '03-building')
    const cubes = await page.evaluate(() => window.hcgSession.gameState.cubes.length)
    await page
        .getByRole('button', { name: /^Place a store in / })
        .first()
        .click()
    const buildNow = page.getByRole('button', { name: /^Build 1 store/ })
    if ((await buildNow.count()) > 0) {
        await screenshot(page, '04-first-cube-staged')
        await buildNow.click()
    }
    await expect
        .poll(() => page.evaluate(() => window.hcgSession.gameState.cubes.length))
        .toBeGreaterThan(cubes)
    await screenshot(page, '05-after-build')
})

test('develops towns and auctions a share', async ({ page }) => {
    await createGame(page)
    await playInitialAuctions(page)
    await page.getByRole('button', { name: 'Choose Develop Cities' }).click()
    await expect.poll(() => machineState(page)).toBe('DevelopingTowns')
    await screenshot(page, '06-developing')
    await page.getByRole('button', { name: 'Develop San Antonio' }).click()
    const payee = page.getByRole('button', { name: /Alamo City|Verbena/ })
    if ((await machineState(page)) === 'DevelopingTowns' && (await payee.count()) > 0) {
        await payee.first().click()
    }
    await page.getByRole('button', { name: 'Develop Austin' }).click()
    await expect.poll(() => machineState(page)).toBe('ChoosingAction')
    await expect
        .poll(() => page.evaluate(() => window.hcgSession.gameState.roundTrack.length))
        .toBe(1)

    await page.getByRole('button', { name: 'Choose Auction Share' }).click()
    await page.getByRole('button', { name: 'Auction a Verbena share' }).click()
    await screenshot(page, '07-opening-auction')
    await page.getByRole('button', { name: /^Open at \$/ }).click()
    await expect.poll(() => machineState(page)).toBe('Bidding')
    await screenshot(page, '08-share-auction')
})

// Alternates auctions and developments through the session until two companies sell out.
test('plays to the end of the game', async ({ page }) => {
    test.setTimeout(240_000)
    await createGame(page)
    await playInitialAuctions(page)
    for (
        let step = 0;
        step < 400 && !(await page.evaluate(() => window.hcgSession.gameState.result));
        step++
    ) {
        await page.evaluate(async () => {
            const session = window.hcgSession
            const state = session.gameState
            switch (state.machineState) {
                case 'ChoosingAction': {
                    const spaces = session.selectableSpaces
                    const space =
                        spaces.find((choice) => choice === 'AuctionShare') ??
                        spaces.find((choice) => choice === 'DevelopTowns') ??
                        spaces[0]
                    await session.chooseSpace(space)
                    return
                }
                case 'StartingAuction':
                    session.selectAuctionCompany(state.auctionableCompanies()[0])
                    await session.openAuction(0)
                    return
                case 'Bidding':
                    if (state.bidding().hasBid) {
                        await session.passBid()
                    } else {
                        await session.placeBid(0)
                    }
                    return
                case 'PlacingBonusCube':
                    await session.skipBonusCube()
                    return
                case 'DevelopingTowns':
                    if (session.payeeOptions.length > 0) {
                        await session.choosePayee(session.payeeOptions[0])
                    } else if (session.mayTakeDevelopmentCash) {
                        await session.takeDevelopmentCash()
                    } else {
                        await session.clickCity(session.cityTargets[0])
                    }
                    return
                case 'BuildingNetwork':
                    if (!session.buildCompany) {
                        session.selectBuildCompany(session.buildCompanyOptions[0])
                    }
                    await session.clickHex(session.hexTargets[0])
                    return
            }
        })
        await page.waitForTimeout(40)
    }
    await expect(page.getByText(/The richest investors? (is|are)/)).toBeVisible()
    await screenshot(page, '10-game-end')
    await page.getByRole('tab', { name: 'History' }).click()
    await screenshot(page, '11-history')
})

test('fits a phone screen without sideways scrolling in the action area', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 740 })
    await createGame(page)
    await expect(page.getByPlaceholder('choose a name for your game')).toBeHidden()
    await screenshot(page, '09-phone')
    const overflow = await page.evaluate(() => {
        const area = document.querySelector('.action-area')
        return area ? area.scrollWidth - area.clientWidth : 0
    })
    expect(overflow).toBeLessThanOrEqual(1)
})
