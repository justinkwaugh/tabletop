import { expect, test, type Page } from '@playwright/test'

// Contract, "Phone layout": 390 × 844, held upright, by touch.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

const pageErrors = new WeakMap<Page, string[]>()

test.beforeEach(({ page }) => {
    const errors: string[] = []
    pageErrors.set(page, errors)
    page.on('pageerror', (error) => errors.push(error.message))
})

test.afterEach(({ page }) => {
    expect(pageErrors.get(page)).toEqual([])
})

// Set up by touch too, so no mouse is left resting where a later layout puts a piece.
async function createGame(page: Page) {
    await page.goto('/')
    await page.getByRole('button', { name: 'New game', exact: true }).tap()
    await page.getByPlaceholder('choose a name for your game').fill('Phone')
    await page
        .getByPlaceholder('optional reproduction seed')
        .fill('0123456789abcdef0123456789abcdef')
    const names = page.getByPlaceholder('player name')
    for (let i = 1; i < (await names.count()); i++) await names.nth(i).fill(`Player ${i + 1}`)
    await page.getByRole('button', { name: 'Create Game', exact: true }).tap()
    await expect(page.locator('svg.board')).toBeVisible()
}

const board = (page: Page) => page.locator('svg.board')
const firstPiece = (page: Page) =>
    page.locator('[aria-label="Turn pieces"] button:not([disabled])').first()

async function fingerPan(
    page: Page,
    from: { x: number; y: number },
    by: { x: number; y: number }
): Promise<void> {
    const client = await page.context().newCDPSession(page)
    const at = (step: number) => [
        { x: from.x + (by.x * step) / 6, y: from.y + (by.y * step) / 6, id: 1 }
    ]
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(0) })
    for (let step = 1; step <= 6; step++) {
        await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(step) })
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await client.detach()
}

async function hexWidth(page: Page, spaceId: string): Promise<number> {
    const box = await board(page)
        .locator(`[data-layer="hit-targets"] [data-space-id="${spaceId}"]`)
        .boundingBox()
    return box?.width ?? 0
}

function litSpaces(page: Page): Promise<string[]> {
    return board(page)
        .locator('[data-lit]')
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-lit') ?? '').sort())
}

// The board at rest: the hex field fitted to the column's width, about 30 px a hex.
async function restingHexWidth(page: Page): Promise<number> {
    await expect.poll(() => hexWidth(page, 'space.0.0')).toBeLessThan(36)
    await page.waitForTimeout(300)
    return hexWidth(page, 'space.0.0')
}

const trackerBar = (page: Page) => page.locator('[data-end-tracker-bar]')

async function boxOf(page: Page, selector: string) {
    const box = await page.locator(selector).boundingBox()
    if (box === null) throw Error(`${selector} has a box`)
    return box
}

test('R-6.1, R-6.1-H1, R-6.1-H2: under the board the end tracker takes the seat strip’s place: both conditions with their ticks, "or", and the bag', async ({
    page
}) => {
    await createGame(page)
    await expect(page.locator('[data-seat-strip], [data-seat-chip]')).toHaveCount(0)
    const bar = trackerBar(page)
    await expect(bar).toBeVisible()

    // The same reading as the tracker in the strip beside the map.
    const tracker = board(page).locator('[data-end-tracker]')
    const red = await tracker.getAttribute('data-red-tiles-uncovered')
    await expect(bar).toHaveAttribute('data-red-tiles-uncovered', red ?? '')
    await expect(bar).toHaveAttribute('data-promontory-taken', 'false')
    await expect(bar.locator('[data-end-line="red"]')).toHaveText(`Red towns open: ${red}`)
    await expect(bar.locator('[data-end-line="promontory"]')).toHaveText('Promontory open')
    await expect(bar.locator('[data-end-tick="open"]')).toHaveCount(2)
    await expect(bar.locator('[data-end-tick="met"]')).toHaveCount(0)
    await expect(bar.locator('[data-end-or]')).toHaveText('or')
    const bag = await board(page).locator('[data-bag]').getAttribute('data-bag')
    await expect(bar.locator('[data-bag]')).toHaveAttribute('data-bag', bag ?? '')
    await expect(bar.locator('[data-bag]')).toHaveText(`${bag} pieces left in the bag`)

    // Right under the hand bar, inside the window.
    const hand = await boxOf(page, '[data-your-hand]')
    const placed = await boxOf(page, '[data-end-tracker-bar]')
    expect(Math.abs(placed.y - (hand.y + hand.height))).toBeLessThanOrEqual(2)
    expect(placed.y + placed.height).toBeLessThanOrEqual(844)

    await page.setViewportSize({ width: 1280, height: 900 })
    await expect(bar).toHaveCount(0)
})

test('contract, "Phone layout": no status line under the turn header; the action area follows it', async ({
    page
}) => {
    await createGame(page)
    await expect(page.locator('[data-status-strip]')).toHaveCount(0)
    const headerBottom = await page
        .locator('h2')
        .first()
        .evaluate((node) => node.closest('.turn')?.getBoundingClientRect().bottom ?? 0)
    const area = await boxOf(page, '.action-area')
    expect(headerBottom).toBeGreaterThan(0)
    expect(area.y - headerBottom).toBeLessThanOrEqual(8)
    // The panel is the header and the action area, nothing between: prices are read from the
    // share block, the price track and the ledger's column headers.
    const panelParts = await page
        .locator('h2')
        .first()
        .evaluate((node) =>
            [...(node.closest('.turn')?.parentElement?.children ?? [])].map((child) =>
                child.classList.contains('turn') ? 'header' : child.className.split(' ')[0]
            )
        )
    expect(panelParts).toEqual(['header', 'action-area'])
})

test('contract, "Open seat": on a phone a seat ledger row opens its seat as a bottom sheet', async ({
    page
}) => {
    await createGame(page)
    const rows = page.locator('[data-seat-ledger] [data-ledger-row]')
    await expect(rows).toHaveCount(4)
    const playerId = await rows.nth(1).getAttribute('data-ledger-row')

    await rows.nth(1).locator('[data-ledger-seat]').tap()
    const sheet = page.locator(`[data-open-seat="${playerId}"]`)
    await expect(sheet).toBeVisible()
    const box = await sheet.boundingBox()
    expect(box).not.toBeNull()
    if (box) {
        expect(Math.round(box.y + box.height)).toBe(844)
        expect(box.height).toBeLessThanOrEqual(0.85 * 844 + 1)
        expect(box.width).toBe(390)
    }
    await page.getByRole('button', { name: 'Close', exact: true }).tap()
    await expect(sheet).toHaveCount(0)
})

test('contract, "Phone layout": every button in the panel, header and hand bar is at least 44 px tall', async ({
    page
}) => {
    await createGame(page)
    await firstPiece(page).tap()
    await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible()
    const heights = await page
        .locator('.action-area button, [data-your-hand] button')
        .or(page.getByRole('button', { name: 'Undo' }))
        .evaluateAll((nodes) =>
            nodes
                .filter((node) => node.getClientRects().length > 0)
                .map((node) => [
                    node.textContent?.trim() ?? '',
                    node.getBoundingClientRect().height
                ])
        )
    expect(heights.length).toBeGreaterThan(8)
    expect(heights.filter(([, height]) => Number(height) < 44)).toEqual([])
})

test('contract, "Hover preview": a tap never sets the preview, even when it focuses the piece', async ({
    page
}) => {
    await createGame(page)
    await firstPiece(page).tap()
    await expect(board(page).locator('[data-lit]').first()).toBeVisible()
    await firstPiece(page).tap()
    await expect(board(page).locator('[data-lit]')).toHaveCount(0)
    await expect(board(page).locator('[data-previewed]')).toHaveCount(0)
})

test('R-3.3: a pick frames its lit hexes up to 2× and returns when it ends; the offer is unchanged', async ({
    page
}) => {
    await createGame(page)
    const rest = await restingHexWidth(page)
    expect(rest).toBeGreaterThan(22)

    await firstPiece(page).tap()
    const lit = await litSpaces(page)
    expect(lit.length).toBeGreaterThan(0)
    await expect.poll(() => hexWidth(page, 'space.0.0')).toBeGreaterThan(1.5 * rest)
    await page.waitForTimeout(300)
    expect(await hexWidth(page, 'space.0.0')).toBeLessThanOrEqual(2 * rest + 1)
    // Framing moves the view only: the same hexes are lit.
    expect(await litSpaces(page)).toEqual(lit)

    await firstPiece(page).tap()
    await expect(board(page).locator('[data-lit]')).toHaveCount(0)
    await expect.poll(() => hexWidth(page, 'space.0.0')).toBeLessThan(rest + 1)
})

test('R-3.3: a hand pan clears the framing, and the pick ending leaves the view where the hand put it', async ({
    page
}) => {
    await createGame(page)
    const rest = await restingHexWidth(page)
    await firstPiece(page).tap()
    await expect.poll(() => hexWidth(page, 'space.0.0')).toBeGreaterThan(1.5 * rest)
    await page.waitForTimeout(300)
    const framed = await hexWidth(page, 'space.0.0')
    const promontory = board(page).locator('[data-layer="hit-targets"] [data-space-id="space.0.0"]')
    const before = await promontory.boundingBox()

    // A one-finger pan on the board, as a phone sends it, a little above the hand bar.
    const hand = await boxOf(page, '[data-your-hand]')
    await fingerPan(page, { x: 195, y: hand.y - 64 }, { x: 60, y: 40 })
    await expect.poll(async () => (await promontory.boundingBox())?.x).not.toBe(before?.x)
    await expect(board(page).locator('[data-track-piece]')).toHaveCount(0)

    await firstPiece(page).tap()
    await expect(board(page).locator('[data-lit]')).toHaveCount(0)
    await page.waitForTimeout(500)
    expect(Math.abs((await hexWidth(page, 'space.0.0')) - framed)).toBeLessThan(1)
})

test('R-3.3: the view holds while a placed piece flies, then the pick ends', async ({ page }) => {
    await createGame(page)
    const rest = await restingHexWidth(page)
    await firstPiece(page).tap()
    await expect.poll(() => hexWidth(page, 'space.0.0')).toBeGreaterThan(1.5 * rest)
    await page.waitForTimeout(300)
    const framed = await hexWidth(page, 'space.0.0')

    const [spaceId] = await litSpaces(page)
    expect(spaceId).toBeDefined()
    // Sample the view each frame from the press until the flight has landed.
    const sampling = page.evaluate(
        () =>
            new Promise<number[]>((resolve) => {
                const widths: number[] = []
                let flew = false
                const sample = () => {
                    const flying = document.querySelector(
                        '[data-flight-layer] [data-flight="Piece"]'
                    )
                    flew ||= flying !== null
                    if (flew && !flying) return resolve(widths)
                    if (flying) {
                        const hex = document.querySelector(
                            'svg.board [data-layer="hit-targets"] [data-space-id="space.0.0"]'
                        )
                        widths.push(hex?.getBoundingClientRect().width ?? 0)
                    }
                    requestAnimationFrame(sample)
                }
                requestAnimationFrame(sample)
            })
    )
    await board(page).locator(`[data-layer="hit-targets"] [data-space-id="${spaceId}"]`).tap()
    const widths = await sampling
    expect(widths.length).toBeGreaterThan(0)
    for (const width of widths) expect(Math.abs(width - framed)).toBeLessThan(1)
    await expect(board(page).locator(`[data-track-piece][data-space-id="${spaceId}"]`)).toHaveCount(
        1
    )
})

test('contract, "Full screen": on a phone the toolbar keeps the end tracker and a Seats button; the ledger opens there and a row opens its seat', async ({
    page
}) => {
    await createGame(page)
    await page.getByRole('button', { name: 'Enter full screen' }).tap()
    const dialog = page.locator('dialog[aria-label="Full screen view"]')
    await expect(dialog.locator('[data-fullscreen-panel]')).toBeVisible()
    await expect(dialog.locator('[data-seat-chip]')).toHaveCount(0)
    await expect(dialog.locator('[data-end-tracker-bar]')).toBeVisible()
    await expect(dialog.locator('[data-end-tracker-bar] [data-end-or]')).toHaveText('or')

    await dialog.getByRole('button', { name: 'Seats', exact: true }).tap()
    const ledger = dialog.locator('[data-seats-sheet] [data-seat-ledger]')
    await expect(ledger).toBeVisible()
    const row = ledger.locator('[data-ledger-row]').nth(2)
    const playerId = await row.getAttribute('data-ledger-row')
    await row.locator('[data-ledger-seat]').tap()
    await expect(dialog.locator(`[data-open-seat="${playerId}"]`)).toBeVisible()
    await expect(dialog.locator('[data-seats-sheet]')).toHaveCount(0)
})
