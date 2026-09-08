import { expect, type Page } from '@playwright/test'

export async function drawCount(page: Page) {
    return page.evaluate(() => Number(document.documentElement.dataset.draws ?? 0))
}

export async function waitForFrames(page: Page) {
    await page.evaluate(
        () =>
            new Promise<void>((resolve) => {
                let frames = 0
                function sample() {
                    if (++frames === 10) resolve()
                    else requestAnimationFrame(sample)
                }
                requestAnimationFrame(sample)
            })
    )
}

export async function expectIdle(page: Page) {
    await expect
        .poll(
            async () => {
                const before = await drawCount(page)
                await waitForFrames(page)
                return (await drawCount(page)) - before
            },
            { timeout: 15_000, message: 'The settled board must stop drawing' }
        )
        .toBe(0)
}

export async function createGame(page: Page, name = 'Render check') {
    await page.goto('/')
    await page.getByRole('button', { name: 'New game', exact: true }).click()
    await page.getByPlaceholder('choose a name for your game').fill(name)
    await page.getByPlaceholder('optional game seed').fill('12345')
    const names = page.getByPlaceholder('player name')
    for (let i = 1; i < (await names.count()); i++) {
        await names.nth(i).fill(`Player ${i + 1}`)
    }
    await page.getByRole('button', { name: 'Create Game', exact: true }).click()
    await expect(page.getByText('Choose a piece to auction', { exact: true })).toBeVisible()
}
