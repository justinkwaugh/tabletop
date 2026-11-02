import { expect, test, type Page } from '@playwright/test'
import type { PromontoryPointGameSession } from '../src/lib/model/session.svelte.js'

declare global {
    interface Window {
        promontoryPointFlightSession: PromontoryPointGameSession
        promontoryPointFlightLog: {
            copies: number
            probe: (string | null)[]
            // The first copy's centre on screen when the count changed.
            centre?: { x: number; y: number }
        }[]
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
// Logs each change in how many copies of a kind fly, with the probe's data-count values at that
// moment, so a short flight phase on a busy machine is not missed between polls.
async function recordFlights(page: Page, kind: string, probe?: string) {
    await page.evaluate(
        ({ kind, probe }) => {
            const log: Window['promontoryPointFlightLog'] = []
            window.promontoryPointFlightLog = log
            const count = () =>
                document.querySelectorAll(`[data-flight-layer] [data-flight="${kind}"]`).length
            let last = count()
            new MutationObserver(() => {
                const copies = count()
                if (copies === last) return
                last = copies
                const nodes = probe ? [...document.querySelectorAll(probe)] : []
                const first = document
                    .querySelector(`[data-flight-layer] [data-flight="${kind}"]`)
                    ?.getBoundingClientRect()
                log.push({
                    copies,
                    probe: nodes.map((node) => node.getAttribute('data-count')),
                    ...(first && {
                        centre: { x: first.x + first.width / 2, y: first.y + first.height / 2 }
                    })
                })
            }).observe(document.body, { childList: true, subtree: true })
        },
        { kind, probe }
    )
}
const flightLog = (page: Page) => page.evaluate(() => window.promontoryPointFlightLog)

// Whether a point on screen lies inside an element's box.
async function inside(page: Page, selector: string, point: { x: number; y: number } | undefined) {
    const box = await page.locator(selector).first().boundingBox()
    return (
        !!box &&
        !!point &&
        point.x >= box.x &&
        point.x <= box.x + box.width &&
        point.y >= box.y &&
        point.y <= box.y + box.height
    )
}

// The table's pieces and cards a flight hides, all shown again once the state lands.
const hidden = (page: Page) =>
    page.evaluate(
        () =>
            [
                ...document.querySelectorAll<HTMLElement | SVGElement>(
                    '[data-turn-piece-art], [data-hand-piece], [data-seat-share] img, [data-share-deck] image'
                )
            ].filter((node) => node.style.visibility === 'hidden').length
    )

test('R-3.3: a placed piece flies from the hand beside the map, its hand piece hidden, and lands on its hex', async ({
    page
}) => {
    await createGame(page)
    const target = await pickTarget(page)
    const picked = await board(page)
        .locator('[data-your-hand] [aria-pressed="true"] [data-piece-disc]')
        .boundingBox()
    await recordFlights(page, 'Piece')
    await board(page).locator(`[data-layer="hit-targets"] [data-space-id="${target}"]`).click()

    const copy = copies(page, 'Piece')
    await expect(copy).toHaveCount(1)
    // It leaves the picked piece in the hand at the top of the strip.
    await expect.poll(() => flightLog(page).then((log) => log.length)).toBeGreaterThan(0)
    const start = (await flightLog(page))[0].centre
    expect(picked).not.toBeNull()
    if (picked && start) {
        expect(Math.abs(start.x - (picked.x + picked.width / 2))).toBeLessThan(picked.width / 2)
        expect(Math.abs(start.y - (picked.y + picked.height / 2))).toBeLessThan(picked.height / 2)
    }
    // While it flies the hex is empty and the hand's piece is hidden.
    await expect(board(page).locator(`[data-track-piece][data-space-id="${target}"]`)).toHaveCount(
        0
    )
    await expect.poll(() => hidden(page)).toBeGreaterThan(0)
    // The copy moves between the hand and the hex.
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

test('R-3.1: a bought share flies from its deck to the buyer’s row in the seat ledger; the counts change on landing', async ({
    page
}) => {
    await createGame(page)
    const seat = page.locator('[data-seat-ledger] [data-ledger-row][data-active="true"]')
    const before = await seat
        .locator('[data-ledger-share]')
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-count')))
    await recordFlights(
        page,
        'Share',
        '[data-seat-ledger] [data-ledger-row][data-active="true"] [data-ledger-share]'
    )
    await page.getByRole('button', { name: /^Buy/ }).first().click()

    // One copy flies, and in flight the buyer's stack still shows what it held; then it lands.
    await expect.poll(() => flightLog(page).then((log) => log.at(-1)?.copies)).toBe(0)
    const log = await flightLog(page)
    expect(log.map((entry) => entry.copies)).toEqual([1, 0])
    expect(log[0].probe).toEqual(before)
    // O-8: it leaves its deck in the strip left of the map.
    expect(await inside(page, 'svg.board [data-share-deck="railroad.cp"]', log[0].centre)).toBe(
        true
    )
    await expect
        .poll(() =>
            seat
                .locator('[data-ledger-share]')
                .evaluateAll((nodes) =>
                    nodes.map((node) => Number(node.getAttribute('data-count')))
                )
        )
        .not.toEqual(before.map(Number))
    await expect.poll(() => hidden(page)).toBe(0)
})

test('R-2.2, R-5: End turn flies the draw from the bag into the hand, then the ledger names the next hand', async ({
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
    await recordFlights(page, 'Piece')
    await page.getByRole('button', { name: /^End turn/ }).click()

    // Three discs leave the bag for the drawer's own hand beside the map. No seat is open, so
    // nothing turns over: the ledger names the next seat's revealed hand once it shows.
    await expect.poll(() => flightLog(page).then((log) => log.at(-1)?.copies)).toBe(0)
    const log = await flightLog(page)
    const counts = log.map((entry) => entry.copies)
    expect(counts.indexOf(3)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...counts)).toBe(3)
    // O-8: the draw leaves the bag at the end tracker's foot, in the strip left of the map.
    expect(await inside(page, 'svg.board [data-end-tracker] [data-bag]', log[0].centre)).toBe(true)
    await expect(copies(page)).toHaveCount(0)
    await expect.poll(() => hidden(page)).toBe(0)
    await expect(
        page.locator('[data-ledger-row][data-active="true"] [data-ledger-hand] [data-railroad-tag]')
    ).toHaveCount(3)
})

test('contract, "Flight layer": in full screen the flights fly inside the dialog', async ({
    page
}) => {
    await createGame(page)
    await page.getByRole('button', { name: 'Enter full screen' }).click()
    const dialog = page.getByRole('dialog', { name: 'Full screen view' })
    await expect(dialog.locator('[data-flight-layer]')).toHaveCount(1)
    await expect(page.locator('[data-flight-layer]')).toHaveCount(1)

    // The piece leaves the hand beside the map, drawn inside the dialog.
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
