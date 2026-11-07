import { expect, test, type Page } from '@playwright/test'
import { createGame, playToCards, playToPawn, settled, shot } from './helpers.js'

/** A real session in a browser: what the specs on the session cannot see. */

const problems = new WeakMap<Page, string[]>()

test.beforeEach(({ page }) => {
    const seen: string[] = []
    problems.set(page, seen)
    page.on('pageerror', (error) => seen.push(error.message))
    page.on('console', (message) => {
        if (/Error (applying|handling)/.test(message.text())) {
            seen.push(message.text())
        }
    })
})

test.afterEach(({ page }) => {
    expect(problems.get(page)).toEqual([])
})

const board = (page: Page) => page.locator('[data-board-surface]')
const lit = (page: Page) => page.locator('[data-pick-role="lit"]')
const bright = (page: Page) => page.locator('[data-bright]')
const panel = (page: Page) => page.locator('[data-action-panel]')
const enlarged = (page: Page) => page.locator('[data-enlarged]')
const stackLayer = (page: Page) => page.locator('[data-table-layer="stack"]')
const seatLayer = (page: Page) => page.locator('[data-table-layer="seat"]')
const popup = (page: Page) => page.locator('[data-board-popup]')

async function pressRow(page: Page, label: string) {
    await panel(page).getByRole('button', { name: label, exact: true }).click()
}

test('the board fits the table beside the panel, and scales down with it', async ({ page }) => {
    await createGame(page)
    await settled(page)
    const box = await board(page).boundingBox()
    expect(box?.x).toBeGreaterThanOrEqual(330)
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(1280)
    expect(box?.width).toBeGreaterThan(900)
    expect(box?.width).toBeLessThan(1000)
    // R-1.2 Whole: the aspect stands.
    expect((box?.width ?? 0) / (box?.height ?? 1)).toBeCloseTo(2500 / 1103, 1)
    const noPageScroll = await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
    )
    expect(noPageScroll).toBe(true)
    await shot(page, 'fit-1280')
})

test('S59 a stack, a tile in it and a bead enlarge; Escape closes one layer at a time', async ({
    page
}) => {
    await createGame(page)
    await playToCards(page)
    const before = await page.evaluate(() => JSON.stringify(window.feudumSession.gameState))

    await page.locator('[data-enlarge="bead"]').first().click()
    await expect(enlarged(page)).toHaveAttribute('data-enlarged', 'bead')
    await shot(page, 'enlarged-bead')
    await page.keyboard.press('Escape')
    await expect(enlarged(page)).toHaveCount(0)

    await page.locator('[data-open-stack]').first().click()
    await expect(stackLayer(page)).toBeVisible()
    await settled(page)
    await shot(page, 'stack-view')
    await stackLayer(page).locator('[data-enlarge="tile back"]').first().click()
    await expect(enlarged(page)).toHaveAttribute('data-enlarged', 'tile')
    await shot(page, 'enlarged-tile')
    await page.keyboard.press('Escape')
    await expect(enlarged(page)).toHaveCount(0)
    await expect(stackLayer(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(stackLayer(page)).toHaveCount(0)

    await page.locator('[data-open-stack="deck"]').click()
    await expect(stackLayer(page)).toBeVisible()
    await stackLayer(page)
        .locator('[data-backdrop]')
        .click({ position: { x: 5, y: 5 } })
    await expect(stackLayer(page)).toHaveCount(0)

    expect(await page.evaluate(() => JSON.stringify(window.feudumSession.gameState))).toBe(before)
})

test('a popup sits beside its anchor; a press outside does nothing; Undo removes it', async ({
    page
}) => {
    await createGame(page)
    await playToPawn(page)
    await settled(page)
    await shot(page, 'pawn-lit')
    expect(await lit(page).count()).toBeGreaterThan(1)

    const spaces = lit(page).locator('[role="button"]')
    await spaces.first().click()
    await expect(popup(page)).toBeVisible()
    await settled(page)
    await shot(page, 'popup')
    const anchorName = await popup(page).getAttribute('data-board-popup')
    const anchor = await page.locator(`[data-pick="${anchorName}"]`).boundingBox()
    const box = await popup(page).boundingBox()
    if (!anchor || !box) {
        throw new Error('no box')
    }
    const beside = box.x >= anchor.x + anchor.width || box.x + box.width <= anchor.x
    expect(beside).toBe(true)
    expect(Math.abs(box.y - anchor.y)).toBeLessThan(anchor.height + box.height)

    // Another lit space, under an open popup.
    await spaces.nth(1).click({ force: true })
    await expect(popup(page)).toHaveAttribute('data-board-popup', anchorName ?? '')

    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(popup(page)).toHaveCount(0)
})

test('S60 hover on a mode brightens what its press would light, and only that', async ({
    page
}) => {
    await createGame(page)
    await playToCards(page)
    await expect(bright(page)).toHaveCount(0)
    const moveRow = panel(page).getByRole('button', { name: 'Move', exact: true })
    await moveRow.hover()
    await expect.poll(() => bright(page).count()).toBeGreaterThan(0)
    const hovered = await bright(page).evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute('data-pick'))
    )
    await shot(page, 'hover-move')
    await page.mouse.move(5, 5)
    await expect(bright(page)).toHaveCount(0)
    expect(await lit(page).count()).toBe(0)
    await moveRow.click()
    await settled(page)
    const shown = page.locator('[data-pick-role="lit"], [data-pick-role="picked"]')
    const lights = await shown.evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute('data-pick'))
    )
    expect(hovered.toSorted()).toEqual(lights.toSorted())
    await shot(page, 'move-lit')
})

test('S61 History View of a turn with a Move offers no choices; enlarge and open seat work', async ({
    page
}) => {
    await createGame(page)
    await playToCards(page)
    await panel(page).getByRole('button', { name: 'Move', exact: true }).click()
    await settled(page)
    await lit(page).first().locator('[role="button"]').click()
    await settled(page)
    await shot(page, 'move-step')
    await pressRow(page, 'No pilfer')
    await settled(page)
    await shot(page, 'move-pilfer-answered')
    await panel(page).locator('[data-primary]').click()
    await settled(page)
    await shot(page, 'move-sent')
    await expect(page.locator('button[aria-label="step backwards"]:visible')).toBeEnabled()

    await page.locator('button[aria-label="step backwards"]:visible').click()
    await expect(panel(page)).toHaveCount(0)
    await expect(page.locator('[data-history-description]')).toBeVisible()
    await expect(page.locator('[data-history-description] [data-action-line]')).toHaveAttribute(
        'data-action-line',
        /^(You|[\w ]+) moved /
    )
    await expect(lit(page)).toHaveCount(0)
    await settled(page)
    await shot(page, 'history')

    await page.locator('[data-enlarge="bead"]').first().click()
    await expect(enlarged(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(enlarged(page)).toHaveCount(0)

    await page.locator('[data-open-seat-of]').first().click()
    await expect(seatLayer(page)).toBeVisible()
    await shot(page, 'history-open-seat')
    await page.keyboard.press('Escape')
    await expect(seatLayer(page)).toHaveCount(0)
})

test('S37 R-X.1 the log has a line for each Action, spoken, with no raw name in it', async ({
    page
}) => {
    await createGame(page)
    await playToCards(page)
    await panel(page).getByRole('button', { name: 'Move', exact: true }).click()
    await settled(page)
    await lit(page).first().locator('[role="button"]').click()
    await settled(page)
    await pressRow(page, 'No pilfer')
    await settled(page)
    await panel(page).locator('[data-primary]').click()
    await settled(page)

    await page.getByRole('tab', { name: 'History' }).click()
    const log = page.locator('[data-action-line]')
    await expect(log.first()).toBeVisible()
    await shot(page, 'log')
    const lines = await log.evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute('data-action-line') ?? '')
    )
    const held = await page.evaluate(() => {
        const session = window.feudumSession
        // Contract, Grouping: the round's start and a turn's advance are in no entry.
        return session.actions
            .filter(({ type }) => type !== 'StartRound' && type !== 'AdvanceTurn')
            .map((action) => session.actionLine(action) ?? '')
    })

    expect(lines.toSorted()).toEqual(held.filter(Boolean).toSorted())
    expect(lines.some((line) => /^(You|[\w ]+) moved /.test(line))).toBe(true)
    expect(lines.some((line) => /^(You|[\w ]+) chose /.test(line))).toBe(true)
    for (const line of lines) {
        expect(line).not.toMatch(/undefined|\[object|\bspace\.|\bwrit\.|\btile\.|\bseal\.\d/)
    }
})

test('S70 smoke: full screen holds the panel in the toolbar and Escape leaves it last', async ({
    page
}) => {
    await createGame(page)
    await playToCards(page)
    await page
        .locator('button[aria-label*="full" i]:visible, button[title*="full" i]:visible')
        .first()
        .click()
    const modal = page.locator('dialog:modal')
    await expect(modal).toHaveCount(1)
    await expect(modal.locator('[data-action-panel]')).toBeVisible()
    await settled(page)
    await shot(page, 'full-screen')

    await modal.locator('[data-enlarge="bead"]').first().click()
    await expect(modal.locator('[data-enlarged]')).toBeVisible()
    await shot(page, 'full-screen-enlarged')
    await page.keyboard.press('Escape')
    await expect(enlarged(page)).toHaveCount(0)
    await expect(modal).toHaveCount(1)
    await page.keyboard.press('Escape')
    await expect(modal).toHaveCount(0)
    await expect(panel(page)).toBeVisible()
})

test.describe('on a phone', () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true })

    test('S60 the board rests at a cover fit; a tap on the preview path stands in for hover', async ({
        page
    }) => {
        await createGame(page)
        await playToCards(page)
        const box = await board(page).boundingBox()
        // Fit would be 375 wide; the cover fit fills the view and pans.
        expect(box?.width).toBeGreaterThan(600)
        await shot(page, 'phone-cover')

        const preview = panel(page).locator('[data-preview="Move"]')
        await preview.tap()
        await expect.poll(() => bright(page).count()).toBeGreaterThan(0)
        await shot(page, 'phone-preview')
        await preview.tap()
        await expect(bright(page)).toHaveCount(0)
        expect(await lit(page).count()).toBe(0)
    })
})
