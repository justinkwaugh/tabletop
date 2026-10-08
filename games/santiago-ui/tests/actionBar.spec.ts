import { expect, test, type Page } from '@playwright/test'

async function createGame(page: Page) {
    await page.goto('/')
    await page.getByRole('button', { name: 'New game', exact: true }).click()
    await page.getByPlaceholder('choose a name for your game').fill('Santiago action bar')
    await page
        .getByPlaceholder('optional reproduction seed')
        .fill('0123456789abcdef0123456789abcdef')
    const names = page.getByPlaceholder('player name')
    for (let i = 1; i < (await names.count()); i++) await names.nth(i).fill(`Player ${i + 1}`)
    await page.getByRole('button', { name: 'Create Game', exact: true }).click()
    await page.getByRole('button', { name: "Reveal this round's fields", exact: true }).click()
}

async function placeBid(page: Page, amount: number) {
    for (let i = 0; i < amount; i++) await page.getByRole('button', { name: '+', exact: true }).click()
    await page.getByRole('button', { name: 'Place Bid', exact: true }).click()
}

async function boardTopsWhile(page: Page, act: () => Promise<void>): Promise<number[]> {
    await page.evaluate(() => {
        const board = document.querySelector('.board-shell')
        if (!board) throw new Error('board not rendered')
        const tops: number[] = []
        Reflect.set(window, '__boardTops', tops)
        const start = performance.now()
        const sample = () => {
            tops.push(Math.round(board.getBoundingClientRect().top))
            if (performance.now() - start < 1200) requestAnimationFrame(sample)
        }
        requestAnimationFrame(sample)
    })
    await act()
    await page.waitForTimeout(1400)
    return page.evaluate(() => {
        const tops: unknown = Reflect.get(window, '__boardTops')
        return Array.isArray(tops) ? tops.filter((top) => typeof top === 'number') : []
    })
}

test('the board slides up as bidding hands the action bar to the first planter', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await createGame(page)
    for (const amount of [0, 1, 2]) {
        await expect(page.getByRole('button', { name: 'Place Bid', exact: true })).toBeVisible()
        await placeBid(page, amount)
    }
    await expect(page.getByRole('button', { name: 'Place Bid', exact: true })).toBeVisible()

    const tops = await boardTopsWhile(page, () => placeBid(page, 3))

    await expect(page.getByText('Choose a field and plant it on the board', { exact: true })).toBeVisible()
    const start = tops[0]
    const end = tops[tops.length - 1]
    expect(end).toBeLessThan(start)
    const between = new Set(tops.filter((top) => top < start && top > end))
    expect(between.size).toBeGreaterThanOrEqual(3)
    expect(tops.every((top, i) => i === 0 || top <= tops[i - 1])).toBe(true)
    expect(errors).toEqual([])
})
