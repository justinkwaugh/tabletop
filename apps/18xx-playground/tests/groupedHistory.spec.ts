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
    await expect(firstLine).toContainText(/^\s*Player \d+\s+\S/)
    await expect(firstLine).toContainText(/Player \d+\s+split Belfast Branch/)
    await expect(page.getByRole('list', { name: 'Action history', exact: true })
        .locator('.stock-action.player-tinted-header').filter({ hasText: /bought 1/ }).first())
        .toContainText(/Player \d+\s+bought 1/)
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
    await expect(page.getByRole('list', { name: 'Action history', exact: true })
        .locator('.stock-action').filter({ hasText: 'Murray River floated' }).first()).toBeVisible()
    await expect(flotation.locator('.flotation-token svg')).toHaveCount(1)
    await expect(flotation.locator('small')).not.toBeEmpty()
    const flotationColumns = await flotation.evaluate((line) => {
        const token = line.querySelector('.flotation-token')?.getBoundingClientRect()
        const summary = line.querySelector('.flotation-token + span')?.getBoundingClientRect()
        const detail = line.querySelector('small')?.getBoundingClientRect()
        return token && summary && detail
            ? { tokenRight: token.right, summaryLeft: summary.left, detailLeft: detail.left }
            : undefined
    })
    expect(flotationColumns).toBeDefined()
    if (!flotationColumns) throw new Error('Flotation row requires a token, summary, and detail')
    expect(flotationColumns.tokenRight).toBeLessThan(flotationColumns.summaryLeft)
    expect(flotationColumns.tokenRight).toBeLessThan(flotationColumns.detailLeft)
    const stock = page
        .getByRole('list', { name: 'SR 6 actions', exact: true })
        .locator('article.stock')
        .filter({ hasText: 'split Belfast Branch from Summerside' })
    await expect(stock).toContainText('split Belfast Branch from Summerside')
    await expect(stock.locator('header')).toHaveCount(0)
    await expect(stock.getByRole('button', { name: /^Details/ })).toHaveCount(0)
    const company = page
        .getByRole('list', { name: 'OR 6.1 actions', exact: true })
        .getByRole('article', { name: 'C operation history', exact: true })
    const companyHeader = company.locator('header')
    await expect(companyHeader).toHaveClass(/player-tinted-header/)
    const operationTint = await companyHeader.evaluate((header) => ({
        color: getComputedStyle(header).getPropertyValue('--player-color').trim(),
        background: getComputedStyle(header).backgroundColor
    }))
    expect(operationTint.color).not.toBe('')
    expect(operationTint.background).not.toBe('rgba(0, 0, 0, 0)')
    await expect(company).toContainText('Withheld')
    await expect(company.getByText('Finished track', { exact: true })).toHaveCount(0)
    await expect(company.getByRole('button', { name: 'Details', exact: true })).toHaveCount(0)
    await expect(company.getByText('Finished track', { exact: true })).toHaveCount(0)
    await expect(company.getByText(/^Tile /)).toHaveCount(0)
    await expect(page.getByRole('article', { name: 'PEIR operation history' }).first()
        .locator('.company-heading strong')).toHaveText('PEIR')
    const round = page.locator('.round-section[data-round-id="OR 1.1"]')
    const divider = round.locator('.round-divider')
    await expect(divider.locator('.round-order svg')).toHaveCount(2)
    await expect(round.getByText('Operating order', { exact: true })).toHaveCount(0)
    const history = page.locator('.round-history')
    await history.evaluate((element) => element.style.width = '260px')
    await expect(divider).toHaveClass(/order-on-second-line/)
    const narrow = await divider.evaluate((element) => {
        const title = element.querySelector('.round-title')?.getBoundingClientRect()
        const phase = element.querySelector('.round-phase')?.getBoundingClientRect()
        const order = element.querySelector('.round-order')?.getBoundingClientRect()
        if (!title || !phase || !order) throw new Error('Operating round divider is incomplete')
        return { titleCenter: (title.top + title.bottom) / 2,
            phaseCenter: (phase.top + phase.bottom) / 2, titleBottom: title.bottom, orderTop: order.top }
    })
    expect(Math.abs(narrow.titleCenter - narrow.phaseCenter)).toBeLessThan(2)
    expect(narrow.orderTop).toBeGreaterThan(narrow.titleBottom)
    await history.evaluate((element) => element.style.width = '600px')
    await expect(divider).not.toHaveClass(/order-on-second-line/)
    const wide = await divider.evaluate((element) => {
        const title = element.querySelector('.round-title')?.getBoundingClientRect()
        const phase = element.querySelector('.round-phase')?.getBoundingClientRect()
        const order = element.querySelector('.round-order')?.getBoundingClientRect()
        if (!title || !phase || !order) throw new Error('Operating round divider is incomplete')
        return { titleRight: title.right, orderLeft: order.left, orderRight: order.right,
            phaseLeft: phase.left, titleCenter: (title.top + title.bottom) / 2,
            phaseCenter: (phase.top + phase.bottom) / 2 }
    })
    expect(wide.titleRight).toBeLessThan(wide.orderLeft)
    expect(wide.orderRight).toBeLessThan(wide.phaseLeft)
    expect(Math.abs(wide.titleCenter - wide.phaseCenter)).toBeLessThan(2)
    await history.evaluate((element) => element.style.removeProperty('width'))
    await expect(companyHeader.getByRole('button', { name: 'Jump to Charlottetown operations in history', exact: true })).toHaveCount(1)
    await page.locator('.round-section[data-round-id="OR 1.1"]').getByRole('button', { name: 'Jump to OR 1.1 in history', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Player 2 wins', exact: true })).not.toBeVisible()
})
