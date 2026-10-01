import { storedFamilyPreference } from './preferenceStorage.js'
import { expect, test } from '@playwright/test'

test('board auto zoom frames history steps by default and keeps the view when disabled', async ({
    page
}) => {
    await page.goto('/table')
    await page.getByLabel('Game', { exact: true }).selectOption('1889')
    await page.getByLabel('Position', { exact: true }).selectOption('routes')
    await page.getByRole('button', { name: 'Run trains', exact: true }).click()
    await page
        .getByRole('button', { name: 'Pane options for Table views pane 4', exact: true })
        .click()
    await page.getByRole('button', { name: 'Board', exact: true }).click()
    await page.keyboard.press('Escape')
    const board = page.getByRole('tabpanel', { name: 'Board', exact: true })
    await expect(board).toBeVisible()
    const transform = () =>
        board
            .locator('.map-scene')
            .evaluate(
                (element) => element.closest<HTMLElement>('[style*="transform"]')?.style.transform
            )
    const history = (label: string) =>
        page.getByRole('button', { name: label, exact: true }).first()
    const autoZoom = board.getByRole('switch', { name: 'Auto zoom', exact: true })
    async function viewAcrossRouteStep() {
        await history('step backwards').click()
        await history('step backwards').click()
        await expect(page.getByText('VIEWING HISTORY', { exact: true })).toBeVisible()
        await board.getByRole('button', { name: 'Zoom in', exact: true }).click()
        await page.waitForTimeout(1000)
        const before = await transform()
        await history('step forwards').click()
        await page.waitForTimeout(1000)
        const after = await transform()
        await history('go to current').click()
        return { before, after }
    }
    await expect(autoZoom).toHaveAttribute('aria-checked', 'true')
    const framed = await viewAcrossRouteStep()
    expect(framed.after).not.toBe(framed.before)

    await autoZoom.click()
    await expect(autoZoom).toHaveAttribute('aria-checked', 'false')
    await expect.poll(() => storedFamilyPreference(page, 'boardAutoZoom')).toBe(false)
    const held = await viewAcrossRouteStep()
    expect(held.after).toBe(held.before)
})
