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

async function createGame(page: Page) {
    await page.goto('/')
    await page.getByRole('button', { name: 'New game', exact: true }).click()
    await page.getByPlaceholder('choose a name for your game').fill('Phone')
    await page
        .getByPlaceholder('optional reproduction seed')
        .fill('0123456789abcdef0123456789abcdef')
    const names = page.getByPlaceholder('player name')
    for (let i = 1; i < (await names.count()); i++) await names.nth(i).fill(`Player ${i + 1}`)
    await page.getByRole('button', { name: 'Create Game', exact: true }).click()
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

test('O-4: the status strip tells the four prices, the bag and the red tiles uncovered from data', async ({
    page
}) => {
    await createGame(page)
    const strip = page.locator('[data-status-strip]')
    await expect(strip).toBeVisible()
    await expect(strip.locator('[data-strip-price]')).toHaveText([
        /CP \$\d+/,
        /UP \$\d+/,
        /KP \$\d+/,
        /SP \$\d+/
    ])
    const bag = await board(page).locator('[data-bag]').getAttribute('data-bag')
    const red = await board(page)
        .locator('[data-end-tracker]')
        .getAttribute('data-red-tiles-uncovered')
    await expect(strip.locator('[data-strip-bag]')).toHaveText(`bag ${bag} · red ${red}`)
    expect((await strip.boundingBox())?.height).toBe(30)

    await page.setViewportSize({ width: 1280, height: 900 })
    await expect(strip).toBeHidden()
    await expect(page.locator('[data-seat-strip]')).toBeHidden()
})

test('R-X.1, R-1.3-H1: the seat strip rings the deciding seat; a press opens its seat as a bottom sheet', async ({
    page
}) => {
    await createGame(page)
    const chips = page.locator('[data-seat-chip]')
    await expect(chips).toHaveCount(4)
    await expect(chips.first()).toHaveAttribute('data-active', 'true')
    await expect(chips.nth(1)).toHaveAttribute('data-active', 'false')
    await expect(chips.first()).toContainText('$20')

    await chips.nth(1).tap()
    const sheet = page.locator('[data-open-seat]')
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

test('contract, "Phone layout": every button in the panel, header and seat strip is at least 44 px tall', async ({
    page
}) => {
    await createGame(page)
    await firstPiece(page).tap()
    await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible()
    const heights = await page
        .locator('.action-area button, [data-seat-strip] button')
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

    // A one-finger pan on the board, as a phone sends it.
    const area = await page.locator('[data-seat-strip]').boundingBox()
    expect(area).not.toBeNull()
    await fingerPan(page, { x: 195, y: (area?.y ?? 800) - 120 }, { x: 60, y: 40 })
    await expect.poll(async () => (await promontory.boundingBox())?.x).not.toBe(before?.x)
    await expect(board(page).locator('[data-track-piece]')).toHaveCount(0)

    await firstPiece(page).tap()
    await expect(board(page).locator('[data-lit]')).toHaveCount(0)
    await page.waitForTimeout(500)
    expect(Math.abs((await hexWidth(page, 'space.0.0')) - framed)).toBeLessThan(1)
})
