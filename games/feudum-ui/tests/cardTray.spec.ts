import type { Locator, Page } from '@playwright/test'
import { expect, test } from './test.js'
import { pressGuildArea, settled, shot } from './helpers.js'

/**
 * Contract, Playing a card: the picked card's tray fits what it holds, and the hand's cards keep
 * their places while the tray's contents change from step to step.
 */

async function openTable(page: Page, scene: string) {
    await page.goto('/')
    await page.addScriptTag({
        type: 'module',
        content: `import { openBenchTable } from '/src/lib/testing/benchTablePage.ts'
            await openBenchTable('${scene}')
            document.body.dataset.benchTable = ''`
    })
    await page.waitForSelector('body[data-bench-table]', { timeout: 45_000 })
    await settled(page)
}

const panel = (page: Page) => page.locator('[data-action-panel]')
const hand = (page: Page) => panel(page).locator('[data-hand-line]')
const tray = (page: Page) => panel(page).locator('[data-card-tray]')

async function pressCard(page: Page, name: RegExp) {
    await hand(page).getByRole('button', { name }).first().click()
    await settled(page)
}

/** Where each card of the hand stands, by its name, but the one named. */
async function cardsBut(page: Page, picked: string): Promise<Record<string, string>> {
    return hand(page)
        .locator('.hand-card [data-row]')
        .evaluateAll(
            (rows, skip) =>
                Object.fromEntries(
                    rows
                        .filter((row) => row.getAttribute('data-row') !== skip)
                        .map((row) => {
                            const { x, y } = row.getBoundingClientRect()
                            return [
                                row.getAttribute('data-row'),
                                `${Math.round(x)},${Math.round(y)}`
                            ]
                        })
                ),
            picked
        )
}

/** The tray's width, and what its contents span with its padding and border. */
async function trayFit(box: Locator) {
    return box.evaluate((node) => {
        const outer = node.getBoundingClientRect()
        const style = getComputedStyle(node)
        const inner = [...node.children].map((child) => child.getBoundingClientRect())
        const left = Math.min(...inner.map(({ left }) => left))
        const right = Math.max(...inner.map(({ right }) => right))
        const around =
            parseFloat(style.paddingLeft) +
            parseFloat(style.paddingRight) +
            parseFloat(style.borderLeftWidth) +
            parseFloat(style.borderRightWidth)
        return { width: outer.width, content: right - left + around }
    })
}

test('Playing a card: a tray of mode buttons is as wide as they are, and the cards stay put as its step changes', async ({
    page
}) => {
    await openTable(page, 'cardTray')
    await pressCard(page, /^Influence/)
    await expect(tray(page)).toBeVisible()
    await expect(tray(page).getByRole('button', { name: 'Forfeit', exact: true })).toBeVisible()
    const fit = await trayFit(tray(page))
    expect(fit.width).toBeLessThanOrEqual(fit.content + 2)
    const line = await hand(page).boundingBox()
    const last = await hand(page).locator('.hand-card').last().boundingBox()
    expect(
        Math.abs((last?.x ?? 0) + (last?.width ?? 0) - ((line?.x ?? 0) + (line?.width ?? 0)))
    ).toBeLessThanOrEqual(1)
    await shot(page, 'tray-two-buttons')

    // Move's tray changes as its steps go by: a pick on the map moves the pawn, and the tray says so.
    await pressCard(page, /^Move/)
    const before = await cardsBut(page, 'Move')
    const step = await tray(page).innerText()
    await page
        .locator('[data-board-surface] [data-pick^="space:"][data-pick-role="lit"]')
        .first()
        .click()
    await settled(page)
    expect(await tray(page).innerText()).not.toBe(step)
    expect(await cardsBut(page, 'Move')).toEqual(before)
})

test('Playing a card: the trade picker’s tray still takes the line’s room', async ({ page }) => {
    await openTable(page, 'merchantTrade')
    await pressCard(page, /^Guild/)
    if ((await page.locator('[data-board-popup]').count()) === 0) {
        await pressGuildArea(page, 'merchant')
    }
    await page
        .locator('[data-board-popup] button')
        .filter({ hasText: /^\s*Trade/ })
        .first()
        .click()
    await settled(page)
    const box = await tray(page).boundingBox()
    expect(box?.width ?? 0).toBeGreaterThan(600)
    await shot(page, 'tray-trade-picker')
})

test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

    test('Playing a card: the tray takes the line under the hand, and the cards stay put', async ({
        page
    }) => {
        await openTable(page, 'cardTray')
        const before = await cardsBut(page, 'Influence')
        await pressCard(page, /^Influence/)
        await expect(tray(page)).toBeVisible()
        expect(await cardsBut(page, 'Influence')).toEqual(before)
        const cards = await hand(page).locator('.hand-card').last().boundingBox()
        const box = await tray(page).boundingBox()
        expect(box?.y ?? 0).toBeGreaterThan((cards?.y ?? 0) + (cards?.height ?? 0) - 6)
        await shot(page, 'tray-two-buttons-phone')
    })
})
