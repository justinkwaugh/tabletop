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
    await page.getByPlaceholder('choose a name for your game').fill('Animation')
    await page
        .getByPlaceholder('optional reproduction seed')
        .fill('0123456789abcdef0123456789abcdef')
    const names = page.getByPlaceholder('player name')
    for (let i = 1; i < (await names.count()); i++) await names.nth(i).fill(`Player ${i + 1}`)
    await page.getByRole('button', { name: 'Create Game', exact: true }).click()
    await expect(page.locator('svg.board')).toBeVisible()
}

// The buyer's marker as drawn: its inner group's offset from the place the state gives it.
function moneyMotion(page: Page) {
    return page.evaluate(() =>
        [...document.querySelectorAll('[data-money-marker] > .motion')].map(
            (node) => node.getAttribute('transform') ?? ''
        )
    )
}

const AT_REST = 'translate(0 0) scale(1)'

test('R-1.3-H1: a buy steps the money marker and raises a cost chip from the seat card', async ({
    page
}) => {
    await createGame(page)
    const buy = page.getByRole('button', { name: /^Buy/ }).first()
    await expect(buy).toBeEnabled()
    await buy.click()

    const chip = page.locator('[data-money-chip]')
    await expect(chip).toHaveCount(1)
    await expect(chip).toHaveText(/^−\$\d+$/)
    // While it steps, the marker stands away from its place in the state on screen.
    await expect.poll(async () => (await moneyMotion(page)).some((t) => t !== AT_REST)).toBe(true)

    // Once the state lands, every marker rests at its new place and the chip is gone.
    await expect(chip).toHaveCount(0)
    await expect.poll(async () => (await moneyMotion(page)).every((t) => t === AT_REST)).toBe(true)
})

test('reduced motion: a buy moves no marker and the chip does not rise', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await createGame(page)
    await page.getByRole('button', { name: /^Buy/ }).first().click()

    const chip = page.locator('[data-money-chip]')
    await expect(chip).toHaveCount(1)
    const shown = await chip.evaluate((node) => getComputedStyle(node).transform)
    expect(shown === 'none' || shown === 'matrix(1, 0, 0, 1, 0, 0)').toBe(true)
    await expect(chip).toHaveCount(0)
    await expect.poll(async () => (await moneyMotion(page)).every((t) => t === AT_REST)).toBe(true)
})
