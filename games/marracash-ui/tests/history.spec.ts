import { expect, test, type Page } from '@playwright/test'
import {
    actionPanel,
    auctionableShops,
    board,
    createGame,
    destinationFountains,
    playOpeningRound
} from './helpers'

let pageErrors: string[] = []

test.beforeEach(({ page }) => {
    pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
})

test.afterEach(() => {
    expect(pageErrors).toEqual([])
})

const walkers = (page: Page) => page.locator('svg.walker-layer g[opacity]')
const stepBackwards = (page: Page) => page.getByRole('button', { name: 'step backwards' })
const stepForwards = (page: Page) => page.getByRole('button', { name: 'step forwards' })
const goToCurrent = (page: Page) => page.getByRole('button', { name: 'go to current' })

async function openHistory(page: Page) {
    await page.getByText('History', { exact: true }).click()
}

// Fountain 8's visitors enter the yellow and purple shops bought in the opening round.
async function moveIntoOwnedShops(page: Page) {
    await page.getByRole('button', { name: 'Fountain 8', exact: true }).click()
    await page.getByRole('button', { name: 'Move visitors to fountain 4' }).click()
    await expect(page.getByRole('button', { name: 'Fountain 4', exact: true })).toBeVisible()
}

// Records how long walker pawns are on screen, from the first one mounting to the last leaving.
async function watchWalkers(page: Page) {
    await page.evaluate(() => {
        const layer = document.querySelector('svg.walker-layer')
        if (!layer) throw Error('No walker layer')
        const record: { firstAdded?: number; lastRemoved?: number } = {}
        Object.assign(window, { walkerRecord: record })
        new MutationObserver(() => {
            const count = layer.querySelectorAll('g[opacity]').length
            if (count > 0 && record.firstAdded === undefined) record.firstAdded = performance.now()
            if (count === 0 && record.firstAdded !== undefined)
                record.lastRemoved = performance.now()
        }).observe(layer, { childList: true, subtree: true })
    })
}

async function walkerMilliseconds(page: Page): Promise<number> {
    await expect(walkers(page)).toHaveCount(0)
    return page.evaluate(() => {
        const { walkerRecord } = window as unknown as {
            walkerRecord: { firstAdded?: number; lastRemoved?: number }
        }
        if (walkerRecord.firstAdded === undefined || walkerRecord.lastRemoved === undefined) {
            throw Error('No pawns moved')
        }
        return walkerRecord.lastRemoved - walkerRecord.firstAdded
    })
}

const movedReport = /moved \d+ visitors/
const latestEntry = (page: Page) => page.locator('.history [role=button]').first()

test('stepping back and forward over a move glides pawns and hides staged choices', async ({
    page
}) => {
    await createGame(page)
    await playOpeningRound(page)
    await moveIntoOwnedShops(page)
    await expect(actionPanel(page)).not.toContainText(movedReport)
    await page.getByRole('button', { name: 'Fountain 4', exact: true }).click()
    await expect(destinationFountains(page)).not.toHaveCount(0)
    await openHistory(page)
    await expect(latestEntry(page)).toContainText('moved')

    await watchWalkers(page)
    await stepBackwards(page).click()
    expect(await walkerMilliseconds(page)).toBeLessThan(500)
    await expect(destinationFountains(page)).toHaveCount(0)
    await expect(auctionableShops(page)).toHaveCount(0)
    await expect(page.locator('g[role="button"][aria-label^="Fountain"]')).toHaveCount(0)
    await expect(latestEntry(page)).not.toContainText('moved')
    await expect(actionPanel(page)).toContainText('All bids are in.')
    await expect(board(page).locator('path[filter*="candidate-halo"]')).toHaveCount(1)

    await watchWalkers(page)
    await stepForwards(page).click()
    expect(await walkerMilliseconds(page)).toBeLessThan(500)
    await expect(latestEntry(page)).toContainText('moved')

    await goToCurrent(page).click()
    await expect(page.getByRole('button', { name: 'Fountain 4', exact: true })).toBeVisible()
    await expect(destinationFountains(page)).toHaveCount(0)
})

test('playing the history replays a move as a walk', async ({ page }) => {
    await createGame(page)
    await playOpeningRound(page)
    await moveIntoOwnedShops(page)
    await openHistory(page)
    await stepBackwards(page).click()
    await expect(actionPanel(page)).toContainText('All bids are in.')

    await watchWalkers(page)
    await page.getByRole('button', { name: 'play history' }).click()
    expect(await walkerMilliseconds(page)).toBeGreaterThan(500)
    await expect(latestEntry(page)).toContainText('moved')
})

test('history controls pressed during a walk let it finish on the moved state', async ({
    page
}) => {
    await createGame(page)
    await playOpeningRound(page)
    await openHistory(page)

    await page.getByRole('button', { name: 'Fountain 8', exact: true }).click()
    await page.getByRole('button', { name: 'Move visitors to fountain 4' }).click()
    await expect(walkers(page)).not.toHaveCount(0)
    await stepBackwards(page).click()
    await expect(walkers(page)).toHaveCount(0)
    await expect(latestEntry(page)).toContainText('moved')

    await stepBackwards(page).click()
    await expect(actionPanel(page)).toContainText('All bids are in.')
    await page.getByRole('button', { name: 'play history' }).click()
    await expect(walkers(page)).not.toHaveCount(0)
    await stepBackwards(page).click()
    await goToCurrent(page).click()
    await expect(walkers(page)).toHaveCount(0)
    await expect(latestEntry(page)).toContainText('moved')
    await expect(page.getByRole('button', { name: 'Fountain 4', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Fountain 8', exact: true })).toHaveCount(0)
})

test('reduced motion glides a move instead of walking it and stills the turn border', async ({
    page
}) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await createGame(page)
    await playOpeningRound(page)
    const pulsing = page.locator('.pulse-border').first()
    await expect(pulsing).toBeVisible()
    expect(await pulsing.evaluate((element) => getComputedStyle(element).animationName)).toBe(
        'none'
    )

    await watchWalkers(page)
    await page.getByRole('button', { name: 'Fountain 8', exact: true }).click()
    await page.getByRole('button', { name: 'Move visitors to fountain 4' }).click()
    expect(await walkerMilliseconds(page)).toBeLessThan(500)
    await expect(page.getByRole('button', { name: 'Fountain 4', exact: true })).toBeVisible()
})
