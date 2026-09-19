import { expect, test } from '@playwright/test'

test('compact stock rows and operating groups retain details and action navigation', async ({
    page
}) => {
    test.setTimeout(60000)
    await page.goto('/table')
    await page.getByRole('tab', { name: 'Map', exact: true }).waitFor()
    await page.getByLabel('Position', { exact: true }).selectOption('finished')
    await expect(page.getByRole('heading', { name: 'Player 2 wins', exact: true })).toBeVisible({
        timeout: 30000
    })
    await page.getByRole('tab', { name: 'History', exact: true }).click()
    const stockRound = page.getByRole('list', { name: 'SR 6 actions', exact: true })
    const playerLines = stockRound.locator('.stock-action.player-tinted-header')
    expect(await playerLines.count()).toBeGreaterThan(1)
    const firstLine = playerLines.first()
    await expect(firstLine).toContainText(/^Player \d+\s+\S/)
    await expect(firstLine.locator('.color-dot')).toHaveCount(0)
    const typography = await firstLine.evaluate((line) => {
        const name = line.querySelector('span')
        const description = name?.nextElementSibling
        return {
            name: name && `${getComputedStyle(name).fontSize} ${getComputedStyle(name).fontWeight}`,
            description: description && `${getComputedStyle(description).fontSize} ${getComputedStyle(description).fontWeight}`,
            background: getComputedStyle(line).backgroundColor
        }
    })
    expect(typography.name).toBe(typography.description)
    expect(typography.name).toMatch(/ 400$/)
    expect(typography.background).not.toBe('rgba(0, 0, 0, 0)')
    await expect(stockRound.locator('.stock-action strong')).toHaveCount(0)
    const passes = stockRound.locator('.passes .stock-action.player-tinted-header')
    expect(await passes.count()).toBeGreaterThan(0)
    await expect(passes.first()).toHaveText(/^Player \d+ passed$/)
    await expect(passes.first().locator('.color-dot')).toHaveCount(0)
    const flotation = page.getByRole('list', { name: 'Action history', exact: true })
        .locator('.stock-action').filter({ hasText: /floated/ }).first()
    await expect(flotation).toContainText('floated')
    await expect(flotation).not.toContainText(/Player \d/)
    await expect(flotation).not.toHaveClass(/player-tinted-header/)
    const stock = page
        .getByRole('list', { name: 'SR 6 actions', exact: true })
        .locator('article.stock')
        .filter({ hasText: 'Split BR:BB from Summerside' })
    await expect(stock).toContainText('Split BR:BB from Summerside')
    await expect(stock.locator('header')).toHaveCount(0)
    await expect(stock.getByRole('button', { name: /^Details/ })).toHaveCount(0)
    const company = page
        .getByRole('list', { name: 'OR 6.1 actions', exact: true })
        .getByRole('article', { name: 'C operation history', exact: true })
    await expect(company).toContainText('Withheld')
    await expect(company.getByText('Finished track', { exact: true })).toHaveCount(0)
    await expect(company.getByRole('button', { name: 'Details', exact: true })).toHaveCount(0)
    await expect(company.getByText('Finished track', { exact: true })).toHaveCount(0)
    await expect(company.getByText(/^Tile /)).toHaveCount(0)
    await company.getByRole('button', { name: 'Jump to Charlottetown operations in history', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Player 2 wins', exact: true })).not.toBeVisible()
})
