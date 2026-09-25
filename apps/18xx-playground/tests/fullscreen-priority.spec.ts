import { expect, test } from '@playwright/test'

test('Map owns F when both views are visible, including after Map is reopened', async ({
    page
}) => {
    await page.goto('/table')
    await page
        .getByRole('tab', { name: 'Market', exact: true })
        .dragTo(page.getByRole('tab', { name: 'Game info', exact: true }))
    const map = page.getByRole('tabpanel', { name: 'Map', exact: true })
    const market = page.getByRole('tabpanel', { name: 'Market', exact: true })
    await page.keyboard.press('f')
    await expect(map.getByRole('button', { name: 'Exit full screen' })).toBeVisible()
    await expect(market.getByRole('button', { name: 'Exit full screen' })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Pane options for Table views pane 4' }).click()
    await page.getByRole('button', { name: 'Close Map tab', exact: true }).click()
    await page.keyboard.press('Escape')
    await page.keyboard.press('f')
    await expect(market.getByRole('button', { name: 'Exit full screen' })).toBeVisible()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Pane options for Table views pane 4' }).click()
    await page.getByRole('button', { name: 'Map', exact: true }).click()
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
    await page
        .getByRole('tab', { name: 'Market', exact: true })
        .dragTo(page.getByRole('tab', { name: 'Game info', exact: true }))
    const map = page.getByRole('tabpanel', { name: 'Map', exact: true })
    const market = page.getByRole('tabpanel', { name: 'Market', exact: true })
    const marketBounds = await market.boundingBox()
    const dividerBounds = await page
        .getByRole('separator', { name: 'Resize vertical split' })
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
    const map = page.getByRole('tabpanel', { name: 'Map', exact: true })
    const marketTab = page.getByRole('tab', { name: 'Market', exact: true })
    const backgroundBounds = await marketTab.boundingBox()
    if (!backgroundBounds) throw new Error('Market tab must be visible before fullscreen')
    await map.getByRole('button', { name: 'Enter full screen' }).click()
    await expect(map.getByRole('button', { name: 'Exit full screen' })).toBeVisible()
    await page.mouse.click(
        backgroundBounds.x + backgroundBounds.width / 2,
        backgroundBounds.y + backgroundBounds.height / 2
    )
    await expect(page.getByRole('tab', { name: 'Map', exact: true })).toHaveAttribute(
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
    await marketTab.evaluate((element) => element.focus())
    await expect(marketTab).not.toBeFocused()
    await page.keyboard.press('k')
    await expect(page.getByRole('tab', { name: 'Map', exact: true })).toHaveAttribute(
        'aria-selected',
        'true'
    )
    await page.keyboard.press('Escape')
    await marketTab.click()
    await expect(marketTab).toHaveAttribute('aria-selected', 'true')
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
                vertical: Math.abs(inner.top + inner.height / 2 - outer.top - outer.height / 2)
            }
        })
    await expect(surface).toBeVisible()
    const originalTop = (await offsets()).top
    await map.getByRole('button', { name: 'Enter full screen' }).click()
    await expect.poll(async () => (await offsets()).vertical).toBeLessThan(1)
    expect((await offsets()).top).toBeGreaterThan(50)
    await map.getByRole('button', { name: 'Exit full screen' }).click()
    await expect.poll(async () => Math.abs((await offsets()).top - originalTop)).toBeLessThan(1)
})
