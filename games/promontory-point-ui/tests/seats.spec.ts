import { expect, test, type Page } from '@playwright/test'

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
    await page.getByPlaceholder('choose a name for your game').fill('Seats')
    await page
        .getByPlaceholder('optional reproduction seed')
        .fill('0123456789abcdef0123456789abcdef')
    const names = page.getByPlaceholder('player name')
    for (let i = 1; i < (await names.count()); i++) await names.nth(i).fill(`Player ${i + 1}`)
    await page.getByRole('button', { name: 'Create Game', exact: true }).click()
    await expect(page.locator('svg.board')).toBeVisible()
}

const seatCards = (page: Page) => page.locator('[data-seat-cards] [data-seat-card]')
const enlarged = (page: Page) => page.locator('[data-enlarged-view]')
const openSeat = (page: Page) => page.locator('[data-open-seat]')

test('contract, "Seat card": one ledger per seat in seat order, the turn player ringed and revealed', async ({
    page
}) => {
    await createGame(page)
    const cards = seatCards(page)
    await expect(cards).toHaveCount(4)
    await expect(cards.first()).toHaveAttribute('data-active', 'true')
    await expect(cards.first().locator('[data-seat-tag]')).toHaveText('placing')
    await expect(cards.first().locator('[data-hand-perspective]')).toHaveAttribute(
        'data-hand-perspective',
        'Revealed'
    )
    await expect(cards.first()).toContainText('hand, revealed')
    await expect(cards.nth(1)).toHaveAttribute('data-active', 'false')
    for (const card of await cards.all()) {
        await expect(card.locator('[data-seat-share]')).toHaveCount(4)
        await expect(card).toContainText('shares worth $')
    }
})

test('R-5: other seats show their concealed hands as grey discs, even in a game that holds them', async ({
    page
}) => {
    await createGame(page)
    const others = seatCards(page).filter({ hasText: 'hidden' })
    await expect(others.first()).toBeVisible()
    for (const card of await others.all()) {
        const pieces = card.locator('[data-hand-piece]')
        const faces = await pieces.evaluateAll((nodes) =>
            nodes.map((node) => node.getAttribute('data-hand-piece'))
        )
        const text = (await card.textContent()) ?? ''
        if (text.includes('yours, hidden')) {
            expect(faces.every((face) => face !== 'hidden')).toBe(true)
        } else {
            expect(text).toMatch(/hand: \d+ hidden/)
            expect(faces.every((face) => face === 'hidden')).toBe(true)
        }
    }
})

test('contract, "The principle": a share stack, a deck and the bag enlarge or count, and the next press only closes', async ({
    page
}) => {
    await createGame(page)
    const firstCard = seatCards(page).first()
    await firstCard.locator('[data-seat-share="railroad.cp"]').click()
    await expect(enlarged(page)).toHaveAttribute('data-enlarged-view', 'Share')
    await expect(enlarged(page).getByRole('img')).toHaveAttribute('alt', 'Central Pacific share')
    await enlarged(page).click()
    await expect(enlarged(page)).toHaveCount(0)
    await expect(openSeat(page)).toHaveCount(0)

    await page.locator('[data-deck-target="railroad.kp"]').click()
    await expect(enlarged(page).getByRole('img')).toHaveAttribute('alt', 'Kansas Pacific share')
    await page.keyboard.press('Escape')
    await expect(enlarged(page)).toHaveCount(0)

    const remaining = await page.locator('[data-bag]').getAttribute('data-bag')
    await page.locator('[data-bag-target]').click()
    await expect(enlarged(page)).toHaveAttribute('data-enlarged-view', 'Bag')
    await expect(enlarged(page)).toContainText(`${remaining} pieces in the bag`)
    await expect(enlarged(page).getByRole('img')).toHaveCount(0)
    await enlarged(page).getByRole('button', { name: 'Close' }).click()
    await expect(enlarged(page)).toHaveCount(0)
})

test('contract, "Open seat": the name opens the seat; Escape closes one layer at a time', async ({
    page
}) => {
    await createGame(page)
    const second = seatCards(page).nth(1)
    const playerId = await second.getAttribute('data-seat-card')
    await second.getByRole('button', { name: /^Open .*'s seat$/ }).click()
    await expect(openSeat(page)).toHaveAttribute('data-open-seat', playerId ?? '')
    await expect(openSeat(page)).toContainText('Money this turn')

    await openSeat(page).locator('[data-seat-share="railroad.up"]').click()
    await expect(enlarged(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(enlarged(page)).toHaveCount(0)
    await expect(openSeat(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(openSeat(page)).toHaveCount(0)

    await second.getByRole('button', { name: /^Open .*'s seat$/ }).click()
    await openSeat(page)
        .getByRole('button', { name: /^Close .*'s seat$/ })
        .click()
    await expect(openSeat(page)).toHaveCount(0)
})
