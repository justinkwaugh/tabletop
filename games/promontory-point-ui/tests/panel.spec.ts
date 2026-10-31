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
    await page.getByPlaceholder('choose a name for your game').fill('Panel')
    await page
        .getByPlaceholder('optional reproduction seed')
        .fill('0123456789abcdef0123456789abcdef')
    const names = page.getByPlaceholder('player name')
    for (let i = 1; i < (await names.count()); i++) await names.nth(i).fill(`Player ${i + 1}`)
    await page.getByRole('button', { name: 'Create Game', exact: true }).click()
    await expect(page.locator('svg.board')).toBeVisible()
}

const enlarged = (page: Page) => page.locator('[data-enlarged-view]')

test('contract, "The principle": a share face in the turn panel enlarges, and the press buys nothing', async ({
    page
}) => {
    await createGame(page)
    const heading = page.locator('.pp-block-heading').filter({ hasText: 'Shares ·' })
    await expect(heading).toHaveText('Shares · 2 actions left')
    await page.getByRole('button', { name: 'Enlarge the Union Pacific share' }).first().click()
    await expect(enlarged(page)).toHaveAttribute('data-enlarged-view', 'Share')
    await expect(enlarged(page).getByRole('img')).toHaveAttribute('alt', 'Union Pacific share')
    await page.keyboard.press('Escape')
    await expect(enlarged(page)).toHaveCount(0)
    await expect(heading).toHaveText('Shares · 2 actions left')
})
