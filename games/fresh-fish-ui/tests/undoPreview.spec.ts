import { devices, expect, test } from '@playwright/test'
import { firstLegalCell, openProtectedGame } from './protectedGame.js'

const { defaultBrowserType: _browser, ...iPhone } = devices['iPhone 13']
test.use(iPhone)

test('a tapped placement leaves no preview behind once undone', async ({ page }) => {
    await openProtectedGame(page, 'tap')
    const cell = await firstLegalCell(page)

    await cell.tap()
    await expect(page.getByText('placed a disc')).toBeVisible()
    // A phone need not tell the square the finger has left it: Safari on iOS kept the tapped
    // square hovered after a tap on Undo, so Undo is pressed here without leaving the square.
    await page.getByRole('button', { name: 'Undo', exact: true }).dispatchEvent('click')

    await expect(page.getByText('Please place a disc', { exact: true })).toBeVisible()
    await expect(cell).toHaveClass(/cursor-pointer/)
    await expect(cell.locator('svg')).toHaveCount(0)
})
