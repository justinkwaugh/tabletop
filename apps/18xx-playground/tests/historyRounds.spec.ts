import { expect, test, type Page } from '@playwright/test'

async function topWithinScroll(page: Page, round: string) {
    const viewport = (await page.locator('.history-scroll').boundingBox())!
    const actions = (await page.getByRole('list', { name: `${round} actions`, exact: true }).boundingBox())!
    return actions.y - viewport.y
}

test('the round index scrolls history to a round without changing the game position', async ({
    page
}) => {
    test.setTimeout(60000)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/table')
    await page.getByRole('tab', { name: 'Map', exact: true }).waitFor()
    await page.getByLabel('Position', { exact: true }).selectOption('finished')
    await expect(page.getByRole('heading', { name: 'Player 2 wins', exact: true })).toBeVisible({
        timeout: 30000
    })
    await page.getByRole('tab', { name: 'History', exact: true }).click()
    const scroll = page.locator('.history-scroll')
    const index = page.getByRole('navigation', { name: 'History round index' })
    const openIndex = page.getByRole('button', { name: 'Index', exact: true })

    await openIndex.click()
    for (const round of ['OR 8.3', 'OR 8.2', 'SR 8'])
        await expect(index.getByRole('button', { name: new RegExp(`^${round.replace('.', '\\.')}`) })).toBeVisible()
    await index.getByRole('button', { name: /^OR 7\.1/ }).click()
    await expect.poll(() => topWithinScroll(page, 'OR 7.1')).toBeGreaterThanOrEqual(-1)
    const viewportHeight = (await scroll.boundingBox())!.height
    expect(await topWithinScroll(page, 'OR 7.1')).toBeLessThan(viewportHeight)
    const atEarlierRound = await scroll.evaluate((element) => element.scrollTop)

    await openIndex.click()
    await index.getByRole('button', { name: /^OR 8\.3/ }).click()
    await expect
        .poll(() => scroll.evaluate((element) => element.scrollTop))
        .not.toBe(atEarlierRound)
    expect(await topWithinScroll(page, 'OR 8.3')).toBeLessThan(viewportHeight)

    await expect(page.getByRole('heading', { name: 'Player 2 wins', exact: true })).toBeVisible()
    expect(errors).toEqual([])
})
