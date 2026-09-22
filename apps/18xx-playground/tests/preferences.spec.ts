import { storedFamilyPreference } from './preferenceStorage.js'
import { expect, test } from '@playwright/test'

test('operating-order preference survives reload and follows the player between titles', async ({
    page
}) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/table')
    await page.getByLabel('Position', { exact: true }).selectOption('routes')
    const showOperatingOrder = async () => {
        await page.getByRole('button', { name: 'Pane options for Table views pane 4', exact: true }).click()
        await page.getByRole('button', { name: 'Operating Order', exact: true }).click()
        await page.getByRole('tab', { name: 'Operating Order', exact: true }).click()
    }
    await showOperatingOrder()
    const tokens = page.getByRole('button', { name: 'Tokens only', exact: true })
    const details = page.getByRole('button', { name: 'Detailed chips', exact: true })
    await expect(details).toHaveAttribute('aria-pressed', 'true')
    await tokens.click()
    await expect(tokens).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => storedFamilyPreference(page, 'operatingOrderDisplay')).toBe('tokens')
    await page.reload()
    await page.getByRole('tab', { name: 'Operating Order', exact: true }).click()
    await expect(tokens).toHaveAttribute('aria-pressed', 'true')
    await page.getByLabel('Game', { exact: true }).selectOption('1889')
    await page.getByRole('tab', { name: 'Operating Order', exact: true }).click()
    await expect(tokens).toHaveAttribute('aria-pressed', 'true')
    await details.click()
    await expect(details).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => storedFamilyPreference(page, 'operatingOrderDisplay')).toBe('details')
    await page.getByLabel('Game', { exact: true }).selectOption('TOP')
    await page.getByRole('tab', { name: 'Operating Order', exact: true }).click()
    await expect(details).toHaveAttribute('aria-pressed', 'true')
    expect(errors).toEqual([])
})

test('history order defaults to newest last and follows the player between titles', async ({
    page
}) => {
    await page.goto('/table')
    await page.getByRole('tab', { name: 'History', exact: true }).click()
    const last = page.getByRole('button', { name: 'Newest last', exact: true })
    const first = page.getByRole('button', { name: 'Newest first', exact: true })
    await expect(last).toHaveAttribute('aria-pressed', 'true')
    await first.click()
    await expect(first).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => storedFamilyPreference(page, 'historyOrder')).toBe('newestFirst')
    await page.reload()
    await page.getByRole('tab', { name: 'History', exact: true }).click()
    await expect(first).toHaveAttribute('aria-pressed', 'true')
    await page.getByLabel('Game', { exact: true }).selectOption('1889')
    await page.getByRole('tab', { name: 'History', exact: true }).click()
    await expect(first).toHaveAttribute('aria-pressed', 'true')
    await last.click()
    await expect(last).toHaveAttribute('aria-pressed', 'true')
})

test('compact player cards toggle together and persist across reloads and titles', async ({ page }) => {
    await page.goto('/table')
    const compact = page.getByRole('button', { name: /^Compact .* card$/ })
    const expand = page.getByRole('button', { name: /^Expand .* card$/ })
    await expect(compact.first()).toBeVisible()
    await compact.first().click()
    await expect.poll(() => storedFamilyPreference(page, 'compactPlayerCards')).toBe(true)
    await expect(page.locator('.players > article:not(.compact)')).toHaveCount(0)
    await page.reload()
    await expect(expand.first()).toBeVisible()
    await expect(page.locator('.players > article:not(.compact)')).toHaveCount(0)
    await page.getByLabel('Game', { exact: true }).selectOption('1889')
    await expect(expand.first()).toBeVisible()
    await expect(page.locator('.players > article:not(.compact)')).toHaveCount(0)
    await expand.nth(1).click()
    await expect.poll(() => storedFamilyPreference(page, 'compactPlayerCards')).toBe(false)
    await expect(page.locator('.players > article.compact')).toHaveCount(0)
    await page.getByLabel('Game', { exact: true }).selectOption('TOP')
    await expect(compact.first()).toBeVisible()
    await expect(page.locator('.players > article.compact')).toHaveCount(0)
})

test('table always uses dark mode across reloads, titles and dialogs', async ({ page }) => {
    await page.goto('/table')
    const table = page.getByLabel('Game table', { exact: true })
    await expect(table).toHaveAttribute('data-theme', 'dark')
    await expect(table).toHaveCSS('color-scheme', 'dark')
    await page.getByRole('button', { name: 'Open phase chart', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCSS('color-scheme', 'dark')
    await page.keyboard.press('Escape')
    await page.reload()
    await expect(table).toHaveAttribute('data-theme', 'dark')
    await page.getByLabel('Game', { exact: true }).selectOption('1889')
    await expect(table).toHaveAttribute('data-theme', 'dark')
    await expect(page.getByRole('button', { name: /Switch to (light|dark) mode/ })).toHaveCount(0)
    await page.getByLabel('Game', { exact: true }).selectOption('TOP')
})

test('dark mode has no bright loading canvas on reload', async ({ page }) => {
    await page.goto('/table')
    await page.addInitScript(() => {
        let frames = 0
        function inspectFrame() {
            if (document.body) {
                const root = document.documentElement
                const bodyColor = getComputedStyle(document.body).backgroundColor
                if (getComputedStyle(root).backgroundColor !== 'rgb(24, 33, 43)' ||
                    !['rgba(0, 0, 0, 0)', 'rgb(24, 33, 43)'].includes(bodyColor) ||
                    document.querySelector('.railway-table')?.getAttribute('data-theme') === 'light') {
                    root.dataset.brightStartupFrame = 'true'
                }
                root.dataset.startupFrames = String(++frames)
            }
            if (frames < 300) requestAnimationFrame(inspectFrame)
        }
        requestAnimationFrame(inspectFrame)
    })
    await page.reload()
    await page.getByRole('tab', { name: 'Map', exact: true }).waitFor()
    await expect.poll(() => page.locator('html').getAttribute('data-startup-frames')).not.toBeNull()
    await expect(page.locator('html')).not.toHaveAttribute('data-bright-startup-frame', 'true')
})
