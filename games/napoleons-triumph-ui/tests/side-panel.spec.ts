import { expect, test, type Locator, type Page } from '@playwright/test'
import { createGame, deployBothArmies, failOnPageErrors } from './table.js'

failOnPageErrors()

async function widthOf(locator: Locator) {
    const box = await locator.boundingBox()
    if (!box) throw new Error('The element is not laid out')
    return box.width
}

test('the side panel folds to a rail of history controls and tabs, and opens again at the tab chosen there', async ({
    page
}) => {
    await createGame(page)
    await deployBothArmies(page)
    const board = page.locator('.nt-board-host')
    const openWidth = await widthOf(board)

    await page.getByRole('button', { name: 'Hide side panel' }).click()
    await expect(
        page.locator('.nt-rail').getByRole('button', { name: 'goto my last turn' })
    ).toBeVisible()
    await expect.poll(() => widthOf(board)).toBeGreaterThan(openWidth + 200)

    await page.getByRole('button', { name: 'History', exact: true }).click()
    await expect(page.getByRole('tab', { name: 'History' })).toHaveAttribute(
        'aria-selected',
        'true'
    )

    await page.getByRole('button', { name: 'Hide side panel' }).click()
    await page.getByRole('button', { name: 'Show side panel' }).click()
    await expect(page.getByRole('tab', { name: 'History' })).toHaveAttribute(
        'aria-selected',
        'true'
    )
})

test('a phone has no fold and keeps its side panel', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await createGame(page)
    await expect(page.getByRole('tab', { name: 'Armies' })).toBeAttached()
    await expect(page.getByRole('button', { name: 'Hide side panel' })).toHaveCount(0)
})

// The harness serves svelte-sonner as one pre-bundled module, so importing the URL the page loaded reaches the table's own toaster.
async function showToast(page: Page, message: string) {
    await page.evaluate(async (text) => {
        const url = performance
            .getEntriesByType('resource')
            .map((entry) => entry.name)
            .find((name) => name.includes('svelte-sonner'))
        if (!url) throw new Error('svelte-sonner is not loaded')
        const sonner = await import(/* @vite-ignore */ url)
        sonner.toast(text, { duration: 60_000 })
    }, message)
}

test('a notification shown while the side panel is folded can be closed', async ({ page }) => {
    await createGame(page)
    await deployBothArmies(page)
    await page.getByRole('button', { name: 'Hide side panel' }).click()

    await showToast(page, 'Shown while folded')
    const toast = page.getByText('Shown while folded')
    await expect(toast).toBeVisible()
    await page.getByRole('button', { name: 'Close toast' }).click()
    await expect(toast).toHaveCount(0)
    await expect(page.getByRole('region', { name: /Notifications/ })).toHaveCount(0)
})

test('chat is closed while the side panel is folded, and unread chat shows on the rail', async ({
    page
}) => {
    await createGame(page)
    await deployBothArmies(page)
    const rail = page.locator('.nt-rail')
    const composer = page.locator('textarea[maxlength="500"]')

    await page.getByRole('button', { name: 'Hide side panel' }).click()
    await expect(rail.locator('.nt-rail-unread')).toBeVisible()

    await rail.getByRole('button', { name: 'Chat' }).click()
    await expect(composer).toBeVisible()
    await page.getByRole('button', { name: 'Hide side panel' }).click()
    await expect(composer).toHaveCount(0)
    await expect(rail.locator('.nt-rail-unread')).toHaveCount(0)

    await page.getByRole('button', { name: 'Show side panel' }).click()
    await expect(page.getByRole('tab', { name: 'Chat' })).toHaveAttribute('aria-selected', 'true')
    await expect(composer).toBeVisible()
})
