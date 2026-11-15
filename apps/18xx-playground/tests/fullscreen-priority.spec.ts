import { expect, test, type Page } from '@playwright/test'

async function showMapBesideMarket(page: Page) {
    const menu = page.locator('.widget-menu:popover-open')
    await page.getByRole('button', { name: 'Pane options for Table views pane 5' }).click()
    await menu.getByRole('button', { name: 'Close Board tab', exact: true }).click()
    await menu.getByRole('button', { name: 'Map', exact: true }).click()
    await page.getByRole('button', { name: 'Pane options for Table views pane 6' }).click()
    await menu.getByRole('button', { name: 'Market', exact: true }).click()
    await page.getByRole('tab', { name: 'Market', exact: true }).click()
    await expect(page.getByRole('tabpanel', { name: 'Map', exact: true })).toBeVisible()
    await expect(page.getByRole('tabpanel', { name: 'Market', exact: true })).toBeVisible()
}

test('Map owns F when both views are visible, including after Map is reopened', async ({
    page
}) => {
    await page.goto('/table')
    await showMapBesideMarket(page)
    const map = page.getByRole('tabpanel', { name: 'Map', exact: true })
    const market = page.getByRole('tabpanel', { name: 'Market', exact: true })
    await page.keyboard.press('f')
    await expect(map.getByRole('button', { name: 'Exit full screen' })).toBeVisible()
    await expect(market.getByRole('button', { name: 'Exit full screen' })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Pane options for Table views pane 5' }).click()
    await page.getByRole('button', { name: 'Close Map tab', exact: true }).click()
    await page.keyboard.press('Escape')
    await page.keyboard.press('f')
    await expect(market.getByRole('button', { name: 'Exit full screen' })).toBeVisible()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Pane options for Table views pane 5' }).click()
    await page
        .locator('.widget-menu:popover-open')
        .getByRole('button', { name: 'Map', exact: true })
        .click()
    await page.keyboard.press('f')
    await expect(map.getByRole('button', { name: 'Exit full screen' })).toBeVisible()
    await expect(market.getByRole('button', { name: 'Exit full screen' })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await page.getByRole('tab', { name: 'Tiles', exact: true }).click()
    await page.keyboard.press('f')
    await expect(market.getByRole('button', { name: 'Exit full screen' })).toBeVisible()
    await page.keyboard.press('Escape')
    await page.getByRole('tab', { name: 'Map', exact: true }).click()
    await market.getByRole('button', { name: 'Enter full screen' }).click()
    await expect(market.getByRole('button', { name: 'Exit full screen' })).toBeVisible()
})

test('fullscreen renders above other panes and dividers without remounting its content', async ({
    page
}) => {
    await page.goto('/table')
    await showMapBesideMarket(page)
    const map = page.getByRole('tabpanel', { name: 'Map', exact: true })
    const market = page.getByRole('tabpanel', { name: 'Market', exact: true })
    const marketBounds = await market.boundingBox()
    const dividerBounds = await page
        .getByRole('separator', { name: 'Resize vertical split' })
        .first()
        .boundingBox()
    if (!marketBounds || !dividerBounds) throw new Error('Both panes and divider must be visible')
    await map
        .locator('.scaling-surface')
        .evaluate((element) => (element.dataset.mountCheck = 'preserved'))
    await page.keyboard.press('f')
    await expect(map.getByRole('button', { name: 'Exit full screen' })).toBeVisible()
    const points = [marketBounds, dividerBounds].map((rect) => ({
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2
    }))
    expect(
        await map
            .locator('.scaling-surface')
            .evaluate(
                (element, points) =>
                    points.every((point) =>
                        element.parentElement?.contains(document.elementFromPoint(point.x, point.y))
                    ),
                points
            )
    ).toBe(true)
    await page.keyboard.press('Escape')
    await expect(map.locator('.scaling-surface')).toHaveAttribute('data-mount-check', 'preserved')
    await expect(market.getByRole('button', { name: 'Enter full screen' })).toBeVisible()
})

test('fullscreen blocks background focus and tab shortcuts until closed', async ({ page }) => {
    await page.goto('/table')
    const board = page.getByRole('tabpanel', { name: 'Board', exact: true })
    const tilesTab = page.getByRole('tab', { name: 'Tiles', exact: true })
    const backgroundBounds = await tilesTab.boundingBox()
    if (!backgroundBounds) throw new Error('Tiles tab must be visible before fullscreen')
    await board.getByRole('button', { name: 'Enter full screen' }).click()
    await expect(board.getByRole('button', { name: 'Exit full screen' })).toBeVisible()
    await page.mouse.click(
        backgroundBounds.x + backgroundBounds.width / 2,
        backgroundBounds.y + backgroundBounds.height / 2
    )
    await expect(page.getByRole('tab', { name: 'Board', exact: true })).toHaveAttribute(
        'aria-selected',
        'true'
    )
    for (let index = 0; index < 8; index++) {
        await page.keyboard.press('Tab')
        expect(
            await page
                .getByRole('dialog', { name: 'Full screen view' })
                .evaluate((element) => element.contains(document.activeElement))
        ).toBe(true)
    }
    await tilesTab.evaluate((element) => element.focus())
    await expect(tilesTab).not.toBeFocused()
    await page.keyboard.press('t')
    await expect(page.getByRole('tab', { name: 'Board', exact: true })).toHaveAttribute(
        'aria-selected',
        'true'
    )
    await page.keyboard.press('Escape')
    await tilesTab.click()
    await expect(tilesTab).toHaveAttribute('aria-selected', 'true')
})

test('phone fullscreen vertically centers content and restores embedded positioning', async ({
    page
}) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/table')
    const map = page.getByRole('tabpanel', { name: 'Board', exact: true })
    const surface = map.locator('.scaling-surface')
    const offsets = () =>
        surface.evaluate((element) => {
            const viewport = element.firstElementChild
            const content = viewport?.firstElementChild?.firstElementChild
            if (!viewport || !content) throw new Error('Scaling content must be mounted')
            const outer = viewport.getBoundingClientRect()
            const inner = content.getBoundingClientRect()
            return {
                top: inner.top - outer.top,
                vertical: Math.abs(inner.top + inner.height / 2 - outer.top - outer.height / 2),
                fitted:
                    inner.width <= outer.width + 1 &&
                    inner.height <= outer.height + 1 &&
                    (Math.abs(inner.width - outer.width) < 1 ||
                        Math.abs(inner.height - outer.height) < 1)
            }
        })
    await expect(surface).toBeVisible()
    const full = page
        .getByRole('group', { name: 'Board focus', exact: true })
        .getByRole('button', { name: 'Full', exact: true })
    await full.click()
    await expect(full).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(async () => (await offsets()).fitted).toBe(true)
    const originalTop = (await offsets()).top
    await map.getByRole('button', { name: 'Enter full screen' }).click()
    await expect.poll(async () => (await offsets()).vertical).toBeLessThan(1)
    expect((await offsets()).top).toBeGreaterThan(50)
    await map.getByRole('button', { name: 'Exit full screen' }).click()
    await expect.poll(async () => Math.abs((await offsets()).top - originalTop)).toBeLessThan(1)
})
