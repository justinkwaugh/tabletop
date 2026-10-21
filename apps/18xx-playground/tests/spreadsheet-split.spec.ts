import { expect, test, type Page } from '@playwright/test'

async function openPaneMenu(page: Page, pane: number) {
    await page
        .getByRole('button', { name: `Pane options for Table views pane ${pane}`, exact: true })
        .click()
}

async function deletePane(page: Page, pane: number) {
    await openPaneMenu(page, pane)
    await page.getByRole('button', { name: `Delete pane ${pane}`, exact: true }).click()
}

test('workspace splits, moves live tabs, resizes and stops at eight panes', async ({ page }) => {
    await page.setViewportSize({ width: 2200, height: 1100 })
    await page.goto('/table')
    await expect(page.getByRole('tab', { name: 'Board', exact: true })).toBeVisible()
    while ((await page.getByRole('region', { name: /^Table views pane / }).count()) > 1)
        await deletePane(page, 1)
    const board = page.getByRole('tabpanel', { name: 'Board', exact: true })
    await expect(board).toBeVisible()
    await board.evaluate((element) => (element.dataset.mountCheck = 'preserved'))
    await openPaneMenu(page, 1)
    await page.getByRole('button', { name: 'Split pane 1 vertically', exact: true }).click()
    await expect(page.getByText('Drag a tab here', { exact: true })).toHaveCount(1)
    await expect(
        page.getByRole('button', {
            name: 'Split pane 1 vertically',
            exact: true,
            includeHidden: true
        })
    ).toBeEnabled()
    const pane2 = page.getByRole('region', { name: 'Table views pane 2', exact: true })
    await page
        .getByRole('tab', { name: 'Board', exact: true })
        .dragTo(pane2.getByText('Drag a tab here'))
    await expect(board).toBeVisible()
    await expect(board).toHaveAttribute('data-mount-check', 'preserved')
    await openPaneMenu(page, 1)
    await page.getByRole('button', { name: 'Split pane 1 horizontally', exact: true }).click()
    await openPaneMenu(page, 3)
    await page.getByRole('button', { name: 'Split pane 3 horizontally', exact: true }).click()
    await openPaneMenu(page, 2)
    await page.getByRole('button', { name: 'Split pane 2 horizontally', exact: true }).click()
    await openPaneMenu(page, 5)
    await page.getByRole('button', { name: 'Split pane 5 horizontally', exact: true }).click()
    await openPaneMenu(page, 1)
    await page.getByRole('button', { name: 'Split pane 1 horizontally', exact: true }).click()
    await openPaneMenu(page, 4)
    await page.getByRole('button', { name: 'Split pane 4 horizontally', exact: true }).click()
    await expect(page.getByRole('region', { name: /^Table views pane / })).toHaveCount(8)
    await expect(
        page.getByRole('button', { name: /^Split pane /, includeHidden: true })
    ).toHaveCount(16)
    for (const button of await page
        .getByRole('button', { name: /^Split pane /, includeHidden: true })
        .all())
        await expect(button).toBeDisabled()
    const divider = page.getByRole('separator', { name: 'Resize vertical split' })
    const bounds = await divider.boundingBox()
    if (!bounds) throw new Error('Divider must be visible')
    await page.mouse.move(bounds.x + 4, bounds.y + 10)
    await page.mouse.down()
    await page.mouse.move(bounds.x + 120, bounds.y + 10)
    await page.mouse.up()
    await expect(divider).not.toHaveAttribute('aria-valuenow', '50')
    await divider.focus()
    await page.keyboard.press('Home')
    await expect(divider).toHaveAttribute('aria-valuenow', '5')
    await page.getByRole('tab', { name: 'Board', exact: true }).focus()
    await page.keyboard.press('Alt+Shift+ArrowRight')
    await expect(board).toHaveAttribute('data-mount-check', 'preserved')
    await expect(board).toBeVisible()
    await deletePane(page, 1)
    await expect(page.getByRole('region', { name: /^Table views pane / })).toHaveCount(7)
    for (const button of await page
        .getByRole('button', { name: /^Split pane /, includeHidden: true })
        .all())
        await expect(button).toBeEnabled()
    await page.setViewportSize({ width: 1280, height: 900 })
    await expect(board).toHaveAttribute('data-mount-check', 'preserved')
})

test('adding a tab closes the pane menu while other tabs remain available', async ({ page }) => {
    await page.setViewportSize({ width: 2200, height: 1100 })
    await page.goto('/table')
    await expect(page.getByRole('tab', { name: 'Board', exact: true })).toBeVisible()
    const menuId = await page
        .getByRole('button', { name: 'Pane options for Table views pane 2', exact: true })
        .getAttribute('popovertarget')
    const menu = page.locator(`[id="${menuId}"]`)
    await openPaneMenu(page, 2)
    await menu.getByRole('button', { name: 'Depot', exact: true }).click()
    await expect(page.getByRole('tab', { name: 'Depot', exact: true })).toBeVisible()
    await expect(menu).toBeHidden()
    await expect(
        menu.getByRole('button', { name: 'Player Aid', exact: true, includeHidden: true })
    ).toHaveCount(1)
})

test('tabs reorder and empty-pane deletion restores a single pane', async ({ page }) => {
    await page.setViewportSize({ width: 2200, height: 1100 })
    await page.goto('/table')
    await expect(page.getByRole('tab', { name: 'Board', exact: true })).toBeVisible()
    while ((await page.getByRole('region', { name: /^Table views pane / }).count()) > 1)
        await deletePane(page, 1)
    const tiles = page.getByRole('tab', { name: 'Tiles', exact: true })
    const board = page.getByRole('tab', { name: 'Board', exact: true })
    const paneTabs = page.getByRole('tablist', { name: 'Table views tabs 1' }).getByRole('tab')
    const otherTabs = ['SpreadsheetSheet', 'Actions', 'History', 'Chat', 'Players']
    await expect(paneTabs).toHaveText(['Companies', 'Board', 'Tiles', ...otherTabs])
    await tiles.dragTo(board)
    await expect(paneTabs).toHaveText(['Companies', 'Tiles', 'Board', ...otherTabs])
    await openPaneMenu(page, 1)
    await page.getByRole('button', { name: 'Split pane 1 horizontally', exact: true }).click()
    await deletePane(page, 2)
    await expect(page.getByRole('region', { name: /^Table views pane / })).toHaveCount(1)
    await expect(
        page.getByRole('button', {
            name: 'Split pane 1 horizontally',
            exact: true,
            includeHidden: true
        })
    ).toBeEnabled()
    await expect(
        page.getByRole('button', {
            name: 'Split pane 1 vertically',
            exact: true,
            includeHidden: true
        })
    ).toBeEnabled()
    await expect(page.getByRole('tabpanel', { name: 'Tiles', exact: true })).toBeVisible()
})

test('deleting a populated pane merges its tabs and preserves mounted content', async ({
    page
}) => {
    await page.setViewportSize({ width: 2200, height: 1100 })
    await page.goto('/table')
    await expect(page.getByRole('tab', { name: 'Board', exact: true })).toBeVisible()
    while ((await page.getByRole('region', { name: /^Table views pane / }).count()) > 1)
        await deletePane(page, 1)
    const board = page.getByRole('tabpanel', { name: 'Board', exact: true })
    await board.evaluate((element) => (element.dataset.mountCheck = 'preserved'))
    await openPaneMenu(page, 1)
    await page.getByRole('button', { name: 'Split pane 1 vertically', exact: true }).click()
    await page
        .getByRole('tab', { name: 'Board', exact: true })
        .dragTo(page.getByText('Drag a tab here', { exact: true }))
    await deletePane(page, 2)
    await expect(page.getByRole('region', { name: /^Table views pane / })).toHaveCount(1)
    await expect(
        page.getByRole('tablist', { name: 'Table views tabs 1' }).getByRole('tab')
    ).toHaveCount(8)
    await expect(
        page.getByRole('button', { name: /^Delete pane /, includeHidden: true })
    ).toHaveCount(0)
    await expect(board).toHaveAttribute('data-mount-check', 'preserved')
    await expect(board).toBeVisible()
})

test('actions start above the board and move without remounting', async ({ page }) => {
    await page.setViewportSize({ width: 2200, height: 1100 })
    await page.goto('/table')
    const actions = page.getByRole('tabpanel', { name: 'Actions', exact: true })
    const board = page.getByRole('tabpanel', { name: 'Board', exact: true })
    await expect(actions).toBeVisible()
    await expect(board).toBeVisible()
    await expect(
        page.getByRole('tablist', { name: 'Table views tabs 5' }).getByRole('tab')
    ).toHaveText(['Board', 'Tiles'])
    const upper = await actions.boundingBox()
    const lower = await board.boundingBox()
    if (!upper || !lower) throw new Error('Both panes must be visible')
    expect(upper.y + upper.height).toBeLessThanOrEqual(lower.y)
    await actions.evaluate((element) => (element.dataset.mountCheck = 'preserved'))
    const divider = page.getByRole('separator', { name: 'Resize horizontal split' }).last()
    await expect(divider).toHaveAttribute('aria-valuenow', '48')
    await divider.focus()
    await page.keyboard.press('ArrowUp')
    await expect(divider).toHaveAttribute('aria-valuenow', '46')
    await page
        .getByRole('tab', { name: 'Actions', exact: true })
        .dragTo(page.getByRole('tab', { name: 'Board', exact: true }))
    await expect(actions).toBeVisible()
    await expect(actions).toHaveAttribute('data-mount-check', 'preserved')
    await expect(page.getByText('Drag a tab here', { exact: true })).toBeVisible()
})

test('board tile picker opens after another tab moves to a different pane', async ({ page }) => {
    await page.goto('/table')
    await page
        .getByRole('tab', { name: 'Tiles', exact: true })
        .dragTo(page.getByRole('tab', { name: 'Actions', exact: true }))
    await expect(page.getByRole('tabpanel', { name: 'Board', exact: true })).toBeVisible()
    await page.locator('[data-map-location="K17"]').click()
    await expect(page.locator('.picker')).toBeVisible()
    await page.getByRole('tab', { name: 'Actions', exact: true }).click()
    await expect(page.locator('.picker')).toBeVisible()
    await openPaneMenu(page, 5)
    await page
        .locator('.widget-menu:popover-open')
        .getByRole('button', { name: 'Market', exact: true })
        .click()
    await expect(page.getByRole('tabpanel', { name: 'Market', exact: true })).toBeVisible()
    await expect(page.locator('.picker')).toHaveCount(0)
    await page.getByRole('tab', { name: 'Board', exact: true }).click()
    await expect(page.locator('.picker')).toBeVisible()
})

test('below 1024px actions sit above the board tabs and the sidebar stays intact', async ({
    page
}) => {
    await page.setViewportSize({ width: 1023, height: 900 })
    await page.goto('/table')
    await expect(
        page.getByRole('button', { name: /^Split pane /, includeHidden: true })
    ).toHaveCount(0)
    await expect(page.getByRole('tab', { name: 'Actions', exact: true })).toHaveCount(0)
    const tabs = page.getByRole('tablist', { name: 'Table views tabs 1' }).getByRole('tab')
    await expect(tabs).toHaveText(['Board', 'SpreadsheetSheet', 'Companies', 'Tiles'])
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('tab', { name: 'Map', exact: true })).toHaveCount(0)
    await expect(page.getByRole('tab', { name: 'Market', exact: true })).toHaveCount(0)
    const action = page.getByRole('region', { name: 'Current action', exact: true })
    await expect(action).toBeVisible()
    await page.getByRole('tab', { name: 'Companies', exact: true }).click()
    await expect(action).toBeVisible()
    await expect(page.getByRole('tabpanel', { name: 'Companies', exact: true })).toBeVisible()
    for (const name of ['Players', 'History', 'Chat'])
        await expect(page.getByRole('tab', { name, exact: true })).toBeVisible()
    await page.setViewportSize({ width: 1024, height: 900 })
    await expect(page.getByRole('tab', { name: 'Actions', exact: true })).toBeVisible()
    await expect(
        page.getByRole('separator', { name: 'Resize horizontal split' }).last()
    ).toBeVisible()
    await page.setViewportSize({ width: 1023, height: 900 })
    await expect(
        page.getByRole('button', { name: /^Split pane /, includeHidden: true })
    ).toHaveCount(0)
    await expect(action).toBeVisible()
})

test('Game info opens in a split left pane that accepts any tab and closes', async ({ page }) => {
    await page.setViewportSize({ width: 1800, height: 1000 })
    await page.goto('/table')
    const info = page.getByRole('tabpanel', { name: 'Game info', exact: true })
    const players = page.getByRole('tabpanel', { name: 'Players', exact: true })
    await expect(page.getByRole('tab', { name: 'Game info', exact: true })).toHaveCount(0)
    await openPaneMenu(page, 1)
    await page.getByRole('button', { name: 'Split pane 1 horizontally', exact: true }).click()
    await openPaneMenu(page, 2)
    await page
        .locator('.widget-menu:popover-open')
        .getByRole('button', { name: 'Game info', exact: true })
        .click()
    await expect(info.getByRole('button', { name: 'Open phase chart' })).toBeVisible()
    await expect(info.getByLabel('Company tranches')).toBeVisible()
    const upper = await players.boundingBox()
    const lower = await info.boundingBox()
    if (!upper || !lower) throw new Error('Left panes must be visible')
    expect(upper.y + upper.height).toBeLessThanOrEqual(lower.y)
    expect(upper.x).toBe(lower.x)
    await page
        .getByRole('tab', { name: 'Board', exact: true })
        .dragTo(page.getByRole('tab', { name: 'Players', exact: true }))
    await expect(
        page
            .getByRole('tablist', { name: 'Table views tabs 1' })
            .getByRole('tab', { name: 'Board', exact: true })
    ).toBeVisible()
    await openPaneMenu(page, 2)
    await page.getByRole('button', { name: 'Split pane 2 vertically' }).click()
    await page
        .getByRole('tab', { name: 'Game info', exact: true })
        .dragTo(page.getByText('Drag a tab here', { exact: true }))
    await info.getByRole('button', { name: 'Open phase chart' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await deletePane(page, 2)
    await expect(page.getByRole('region', { name: /^Table views pane / })).toHaveCount(7)
    await expect(info).toBeVisible()
})

test('controls remain interactive after moving a tab into a newly split pane', async ({ page }) => {
    await page.setViewportSize({ width: 1800, height: 1000 })
    await page.goto('/table')
    await openPaneMenu(page, 4)
    await page.getByRole('button', { name: 'Split pane 4 vertically', exact: true }).click()
    await page
        .getByRole('tab', { name: 'Spreadsheet', exact: true })
        .dragTo(page.getByText('Drag a tab here', { exact: true }))
    const sheet = page.getByRole('tabpanel', { name: 'Spreadsheet', exact: true })
    await sheet.getByRole('button', { name: 'Income', exact: true }).click({ timeout: 5000 })
    await expect(sheet.getByRole('button', { name: 'Income', exact: true })).toHaveAttribute(
        'aria-pressed',
        'true'
    )
    await sheet.getByRole('button', { name: 'Current', exact: true }).click()
    await sheet.getByRole('button', { name: 'Swap rows and columns' }).click()
    await expect(sheet.getByRole('table', { name: 'Company share ownership' })).toBeVisible()
    await page
        .getByRole('tab', { name: 'Players', exact: true })
        .dragTo(page.getByRole('tab', { name: 'Spreadsheet', exact: true }))
    const players = page.getByRole('tabpanel', { name: 'Players', exact: true })
    await players.getByRole('button', { name: 'Compact Alex card', exact: true }).click()
    await expect(
        players.getByRole('button', { name: 'Expand Alex card', exact: true })
    ).toHaveAttribute('aria-pressed', 'true')
    await page
        .getByRole('tab', { name: 'Players', exact: true })
        .dragTo(page.getByRole('tab', { name: 'History', exact: true }))
    await players.getByRole('button', { name: 'Expand Alex card', exact: true }).click()
    await expect(
        players.getByRole('button', { name: 'Compact Alex card', exact: true })
    ).toHaveAttribute('aria-pressed', 'false')
})
