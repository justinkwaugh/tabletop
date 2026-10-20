import { devices, expect, test } from '@playwright/test'

const { defaultBrowserType: _browser, ...iPhone } = devices['iPhone 13']
test.use(iPhone)

test('a tapped placement leaves no preview behind once undone', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(async () => {
        const fixture = await import(
            new URL('/src/lib/stores/tests/exploration.fixture.ts', location.href).href
        )
        return fixture.saveProtectedHarnessGame()
    })
    await page.reload()
    await page.getByRole('button', { name: 'Games', exact: true }).tap()
    await page.getByText('Protected Fresh Fish', { exact: true }).tap()
    await expect(page.getByText('Please place a disc', { exact: true })).toBeVisible()
    const cells = page.locator('.land .cell')
    const target = await cells.evaluateAll((elements) =>
        elements.findIndex((element) => element.classList.contains('cursor-pointer'))
    )
    const cell = cells.nth(target)

    await cell.tap()
    await expect(page.getByText('placed a disc')).toBeVisible()
    // A phone need not tell the square the finger has left it: Safari on iOS kept the tapped
    // square hovered after a tap on Undo, so Undo is pressed here without leaving the square.
    await page.getByRole('button', { name: 'Undo', exact: true }).dispatchEvent('click')

    await expect(page.getByText('Please place a disc', { exact: true })).toBeVisible()
    await expect(cell).toHaveClass(/cursor-pointer/)
    await expect(cell.locator('svg')).toHaveCount(0)
})
