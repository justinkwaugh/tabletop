import { expect, test, type Page } from '@playwright/test'
import {
    createGame,
    playToCards,
    playToPawn,
    scoreSpacesCovered,
    settled,
    shot,
    zoomToLowerLeft
} from './helpers.js'

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
    // The board fills the table's width; the guild standings stand under it.
    const row = await page.locator('[data-board-row]').boundingBox()
    expect(row?.x).toBeGreaterThanOrEqual(330)
    expect((row?.x ?? 0) + (row?.width ?? 0)).toBeLessThanOrEqual(1280)
    expect(row?.width).toBeGreaterThan(900)
    expect(row?.width).toBeLessThan(1000)
    const box = await board(page).boundingBox()
    // R-1.2 Whole: the aspect stands.
    // Contract, Supply: nothing under the board, so the surface is the board's own proportions.
    expect((box?.width ?? 0) / (box?.height ?? 1)).toBeCloseTo(2500 / 953, 1)
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

    // Contract, Supply: the deck's stack view opens from the Supply card, which closes.
    await page.locator('[data-supply-toggle]').click()
    await page.locator('[data-open-stack="deck"]').click()
    await expect(page.locator('[data-supply-card]')).toHaveCount(0)
    await expect(stackLayer(page)).toBeVisible()
    await stackLayer(page)
        .locator('[data-backdrop]')
        .click({ position: { x: 5, y: 5 } })
    await expect(stackLayer(page)).toHaveCount(0)

    expect(await page.evaluate(() => JSON.stringify(window.feudumSession.gameState))).toBe(before)
})

test('S59 a press on the enlarged piece closes it, as a press beside it does; no close button stands over it', async ({
    page
}) => {
    await createGame(page)
    await playToCards(page)
    const before = await page.evaluate(() => JSON.stringify(window.feudumSession.gameState))
    const layer = page.locator('[data-table-layer="enlarged"]')
    const close = layer.getByRole('button', { name: 'Close', exact: true })

    await page.locator('[data-enlarge="bead"]').first().click()
    await expect(enlarged(page)).toBeVisible()
    await expect(layer.getByText('Close', { exact: true })).toHaveCount(0)
    await enlarged(page).click()
    await expect(enlarged(page)).toHaveCount(0)

    await page.locator('[data-enlarge="bead"]').first().click()
    await expect(close).toBeVisible()
    await close.press('Enter')
    await expect(enlarged(page)).toHaveCount(0)

    await page.locator('[data-enlarge="bead"]').first().click()
    await layer.locator('[data-backdrop]').click({ position: { x: 5, y: 5 } })
    await expect(enlarged(page)).toHaveCount(0)

    expect(await page.evaluate(() => JSON.stringify(window.feudumSession.gameState))).toBe(before)
})

for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1440, height: 640 }
]) {
    test(`R-1.2.5 the zoom row, Key and Supply in it, covers no score-track space at ${viewport.width} x ${viewport.height}, at rest or zoomed to the corner`, async ({
        page
    }) => {
        await page.setViewportSize(viewport)
        await createGame(page)
        await playToCards(page)
        await settled(page)
        expect(await scoreSpacesCovered(page)).toEqual([])
        // Each step zooms in further: one press, three in all, then six.
        for (const [more, total] of [
            [1, 1],
            [2, 3],
            [3, 6]
        ]) {
            await zoomToLowerLeft(page, more)
            expect(await scoreSpacesCovered(page), `zoomed in ${total}`).toEqual([])
        }
        await shot(page, `zoom-row-${viewport.height}`)
    })
}

test('S59 R-1.3 a press on a guild area on the board enlarges it with its state; a press on it closes it', async ({
    page
}) => {
    await createGame(page)
    await playToCards(page)
    const before = await page.evaluate(() => JSON.stringify(window.feudumSession.gameState))
    const area = board(page).locator('[data-enlarge="Merchant guild"]')

    await area.click({ position: { x: 12, y: 12 } })
    await expect(enlarged(page)).toHaveAttribute('data-enlarged', 'guild')
    await expect(enlarged(page).locator('[data-guild="merchant"]')).toBeVisible()
    const box = await enlarged(page).boundingBox()
    // Upright, as the trade picker shows it: the long side stands, 640 px.
    expect(box?.height).toBeCloseTo(640, 0)
    expect(box?.width).toBeCloseTo((640 * 354) / 500, 0)
    // No piece inside answers the pointer, so no piece's name (its SVG title) rises over the art.
    const hit = await page.evaluate(
        ({ x, y }) => {
            const under = document.elementFromPoint(x, y)
            return {
                svg: under?.closest('svg') !== null,
                close: under?.closest('[data-enlarged]') !== null
            }
        },
        { x: (box?.x ?? 0) + (box?.width ?? 0) / 2, y: (box?.y ?? 0) + (box?.height ?? 0) / 2 }
    )
    expect(hit).toEqual({ svg: false, close: true })
    // R-4.6 Its functions read beside it, and reading them closes nothing.
    const note = page.locator('[data-rules-note]')
    await expect(note).toContainText('Trade (anyone)')
    const beside = await note.boundingBox()
    expect(beside?.x).toBeGreaterThanOrEqual((box?.x ?? 0) + (box?.width ?? 0))
    await note.click()
    await expect(enlarged(page)).toBeVisible()
    await shot(page, 'enlarged-guild')
    await enlarged(page).click()
    await expect(enlarged(page)).toHaveCount(0)

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

test('R-X.1 the log has a line for each Action, spoken, with no raw name in it', async ({
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

    test('S60 the board rests at a cover fit; a tap on a card stands in for hover', async ({
        page
    }) => {
        await createGame(page)
        await playToCards(page)
        const box = await board(page).boundingBox()
        // Fit would be 375 wide; the cover fit fills the view and pans.
        expect(box?.width).toBeGreaterThan(600)
        await shot(page, 'phone-cover')

        await expect(panel(page).locator('[data-preview="Move"]')).toBeHidden()
        await expect(bright(page)).toHaveCount(0)
        await panel(page).locator('button.face[aria-label="Move"]').tap()
        await expect.poll(() => lit(page).count()).toBeGreaterThan(0)
        await shot(page, 'phone-preview')
    })
})
