import { expect, test, type Page } from '@playwright/test'
import type { PromontoryPointGameSession } from '../src/lib/model/session.svelte.js'

declare global {
    interface Window {
        promontoryPointFlightSession: PromontoryPointGameSession
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
        await route.fulfill({
            response,
            body: body.replace(
                'return getContext();',
                'return window.promontoryPointFlightSession = getContext();'
            )
        })
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'New game', exact: true }).click()
    await page.getByPlaceholder('choose a name for your game').fill('Flights')
    await page
        .getByPlaceholder('optional reproduction seed')
        .fill('0123456789abcdef0123456789abcdef')
    const names = page.getByPlaceholder('player name')
    for (let i = 1; i < (await names.count()); i++) await names.nth(i).fill(`Player ${i + 1}`)
    await page.getByRole('button', { name: 'Create Game', exact: true }).click()
    await expect(page.locator('svg.board')).toBeVisible()
    await expect.poll(() => page.evaluate(() => !!window.promontoryPointFlightSession)).toBe(true)
}

// Picks the first piece in the panel and returns the hex it would go to.
async function pickTarget(page: Page): Promise<string> {
    return page.evaluate(() => {
        const session = window.promontoryPointFlightSession
        session.pressPiece(session.pickablePieces[0])
        const target = session.boardOffer.lit[0]
        if (target === undefined) throw Error('A hex is lit')
        return target
    })
}

const board = (page: Page) => page.locator('svg.board')
const copies = (page: Page, kind?: string) =>
    page.locator(
        kind ? `[data-flight-layer] [data-flight="${kind}"]` : '[data-flight-layer] [data-flight]'
    )
// The table's pieces and cards a flight hides, all shown again once the state lands.
const hidden = (page: Page) =>
    page.evaluate(
        () =>
            [
                ...document.querySelectorAll<HTMLElement | SVGElement>(
                    '[data-turn-piece] svg, [data-hand-piece], [data-seat-share] img, [data-share-deck] image'
                )
            ].filter((node) => node.style.visibility === 'hidden').length
    )

test('R-3.3: a placed piece flies from the panel, its hand piece hidden, and lands on its hex', async ({
    page
}) => {
    await createGame(page)
    const target = await pickTarget(page)
    await board(page).locator(`[data-layer="hit-targets"] [data-space-id="${target}"]`).click()

    const copy = copies(page, 'Piece')
    await expect(copy).toHaveCount(1)
    // While it flies the hex is empty and the panel's piece is hidden.
    await expect(board(page).locator(`[data-track-piece][data-space-id="${target}"]`)).toHaveCount(
        0
    )
    await expect.poll(() => hidden(page)).toBeGreaterThan(0)
    // The copy moves between the panel and the board.
    const first = await copy.evaluate((node) => node.getBoundingClientRect().top)
    await expect
        .poll(() => copy.evaluate((node) => node.getBoundingClientRect().top))
        .not.toBe(first)

    await expect(copy).toHaveCount(0)
    await expect(board(page).locator(`[data-track-piece][data-space-id="${target}"]`)).toHaveCount(
        1
    )
    await expect.poll(() => hidden(page)).toBe(0)
})

test('R-3.1: a bought share flies from its deck to the seat card; the counts change on landing', async ({
    page
}) => {
    await createGame(page)
    const seat = page.locator('[data-seat-card][data-active="true"]').first()
    const before = await seat
        .locator('[data-seat-share]')
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-count')))
    await page.getByRole('button', { name: /^Buy/ }).first().click()

    await expect(copies(page, 'Share')).toHaveCount(1)
    // In flight, the buyer's stack still shows what it held.
    expect(
        await seat
            .locator('[data-seat-share]')
            .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-count')))
    ).toEqual(before)

    await expect(copies(page, 'Share')).toHaveCount(0)
    await expect
        .poll(() =>
            seat
                .locator('[data-seat-share]')
                .evaluateAll((nodes) =>
                    nodes.map((node) => Number(node.getAttribute('data-count')))
                )
        )
        .not.toEqual(before.map(Number))
    await expect.poll(() => hidden(page)).toBe(0)
})

test('R-2.2, R-5: End turn flies the draw from the bag, then the next hand turns face up', async ({
    page
}) => {
    await createGame(page)
    await page.evaluate(async () => {
        const session = window.promontoryPointFlightSession
        const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
        for (let placement = 0; placement < 3; placement++) {
            session.pressPiece(session.pickablePieces[0])
            await settle(20)
            if (session.pickedPieceHasNoRoom) await session.scrapTrack()
            else await session.placeTrack(session.boardOffer.lit[0])
            await session.waitForVisibleTransitionSettled()
        }
    })
    await page.getByRole('button', { name: /^End turn/ }).click()

    // Three discs leave the bag; then the next seat's discs turn over, two copies each.
    await expect(copies(page, 'Piece')).toHaveCount(3)
    await expect(copies(page, 'Piece')).toHaveCount(6)
    await expect(copies(page)).toHaveCount(0)
    await expect.poll(() => hidden(page)).toBe(0)
})

test('contract, "Flight layer": in full screen the flights fly inside the dialog', async ({
    page
}) => {
    await createGame(page)
    await page.getByRole('button', { name: 'Enter full screen' }).click()
    const dialog = page.getByRole('dialog', { name: 'Full screen view' })
    await expect(dialog.locator('[data-flight-layer]')).toHaveCount(1)
    await expect(page.locator('[data-flight-layer]')).toHaveCount(1)

    // The piece leaves the panel drawn inside the dialog.
    const target = await pickTarget(page)
    await dialog.locator(`[data-layer="hit-targets"] [data-space-id="${target}"]`).click()
    await expect(dialog.locator('[data-flight-layer] [data-flight="Piece"]')).toHaveCount(1)
    await expect.poll(() => hidden(page)).toBeGreaterThan(0)
    // Closing full screen mid-flight leaves nothing in flight and nothing hidden.
    await dialog.getByRole('button', { name: 'Exit full screen' }).click()
    await expect(copies(page)).toHaveCount(0)
    await expect.poll(() => hidden(page)).toBe(0)
    await expect(board(page).locator(`[data-track-piece][data-space-id="${target}"]`)).toHaveCount(
        1
    )
})

test('reduced motion: a placement shows the piece on its hex with no flight', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await createGame(page)
    const target = await pickTarget(page)
    await board(page).locator(`[data-layer="hit-targets"] [data-space-id="${target}"]`).click()
    await expect(board(page).locator(`[data-track-piece][data-space-id="${target}"]`)).toHaveCount(
        1
    )
    await expect(copies(page)).toHaveCount(0)
})
