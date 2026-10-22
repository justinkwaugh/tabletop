import { expect, test } from '@playwright/test'
test('only absent widgets can be added and the add section disappears once all are present', async ({
    page
}) => {
    await page.goto('/table')
    const boardPaneOptions = page.getByRole('button', {
        name: 'Pane options for Table views pane 5',
        exact: true
    })
    const openMenu = page.locator('.widget-menu:popover-open')
    await expect(page.getByRole('tab', { name: 'Board', exact: true })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Operating Order', exact: true })).toHaveCount(0)
    await boardPaneOptions.click()
    await expect(openMenu.getByRole('button', { name: 'Board', exact: true })).toHaveCount(0)
    await openMenu.getByRole('button', { name: 'Operating Order', exact: true }).click()
    await expect(page.getByRole('tabpanel', { name: 'Operating Order', exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('tab', { name: 'Depot', exact: true })).toHaveCount(0)
    await boardPaneOptions.click()
    await openMenu.getByRole('button', { name: 'Depot', exact: true }).click()
    const depot = page.getByRole('tabpanel', { name: 'Depot', exact: true })
    await expect(depot.getByRole('columnheader', { name: 'Remaining', exact: true })).toBeVisible()
    await expect(depot.locator('tbody .number').first()).toHaveText(/^(\d+|∞)$/)
    await expect(depot.locator('tr.current').first()).toBeVisible()
    await page.keyboard.press('Escape')
    await boardPaneOptions.click()
    await openMenu.getByRole('button', { name: 'Map', exact: true }).click()
    await expect(page.getByRole('tabpanel', { name: 'Map', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Layout unsaved', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('tab', { name: 'Board', exact: true })).toHaveAttribute(
        'aria-selected',
        'true'
    )
    await expect(page.getByRole('tab', { name: 'Map', exact: true })).toHaveAttribute(
        'aria-selected',
        'false'
    )
    await page.getByRole('tab', { name: 'Operating Order', exact: true }).click()
    await expect(page.getByRole('tabpanel', { name: 'Operating Order', exact: true })).toBeVisible()
    for (const tab of ['Market', 'Player Aid', 'Game info', 'Stats']) {
        await boardPaneOptions.click()
        await openMenu.getByRole('button', { name: tab, exact: true }).click()
        await expect(page.getByRole('tab', { name: tab, exact: true })).toHaveCount(1)
    }
    await page
        .getByRole('button', { name: 'Pane options for Table views pane 1', exact: true })
        .click()
    await expect(openMenu.getByText('Add tabs', { exact: true })).toHaveCount(0)
    await expect(
        page.getByRole('button', { name: 'Split pane 1 vertically', exact: true })
    ).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Operating Order', exact: true })).toHaveCount(1)
})

test('tabs can close and reopen while Actions stays protected', async ({ page }) => {
    await page.goto('/table')
    await page
        .getByRole('button', { name: 'Pane options for Table views pane 3', exact: true })
        .click()
    await expect(page.getByRole('button', { name: 'Close Actions tab', exact: true })).toHaveCount(
        0
    )
    await page.keyboard.press('Escape')
    await page
        .getByRole('button', { name: 'Pane options for Table views pane 5', exact: true })
        .click()
    await page.getByRole('button', { name: 'Close Tiles tab', exact: true }).click()
    await expect(page.getByRole('tab', { name: 'Tiles', exact: true })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Layout unsaved', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('tab', { name: 'Board', exact: true })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Tiles', exact: true })).toHaveCount(0)
    await page
        .getByRole('button', { name: 'Pane options for Table views pane 5', exact: true })
        .click()
    await page.getByRole('button', { name: 'Tiles', exact: true }).click()
    await expect(page.getByRole('tab', { name: 'Tiles', exact: true })).toBeVisible()
})

test('operating order starts as miniature tokens and toggles its detailed chips', async ({
    page
}) => {
    await page.goto('/table')
    await page
        .getByRole('button', { name: 'Pane options for Table views pane 4', exact: true })
        .click()
    await page.getByRole('button', { name: 'Operating Order', exact: true }).click()
    const panel = page.getByRole('tabpanel', { name: 'Operating Order', exact: true })
    const chips = panel.getByRole('button', { name: 'Operating order chips', exact: true })
    const companyOrder = panel.getByRole('region', { name: 'Company order', exact: true })
    await expect(chips).toHaveAttribute('aria-expanded', 'false')
    await expect(companyOrder).toHaveCount(0)
    await chips.click()
    await expect(chips).toHaveAttribute('aria-expanded', 'true')
    await expect(companyOrder.locator('.details').first()).toBeVisible()
    await expect(panel.getByRole('button', { name: 'Tokens only', exact: true })).toHaveCount(0)
    await chips.click()
    await expect(chips).toHaveAttribute('aria-expanded', 'false')
    await expect(companyOrder).toHaveCount(0)
})
