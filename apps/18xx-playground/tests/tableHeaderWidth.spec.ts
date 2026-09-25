import { expect, test } from '@playwright/test'

for (const title of ['TOP', '1889']) {
    test(`${title} non-pane header stays within the action and map column`, async ({ page }) => {
        await page.setViewportSize({ width: 393, height: 900 })
        await page.goto('/table')
        await page.getByRole('banner', { name: 'Game phase' }).waitFor()
        await page.getByLabel('Game', { exact: true }).selectOption(title)
        const header = page.getByRole('banner', { name: 'Game phase' })
        await expect(header).toContainText(title === 'TOP' ? 'Charlottetown' : 'Iyo Railway')
        await header.locator('.player-name').evaluate((element) => {
            const name = [...element.childNodes].find((node) => node.nodeType === Node.TEXT_NODE)
            if (!name) throw new Error('Missing player name')
            name.textContent = 'AlexanderthegreatofCharlottetown'
        })
        for (const width of [320, 393, 640, 900]) {
            await page.setViewportSize({ width, height: 900 })
            await expect
                .poll(async () => {
                    const action = await page
                        .getByRole('region', { name: 'Current action' })
                        .boundingBox()
                    const map = await page.locator('.map-area').boundingBox()
                    if (!action || !map) throw new Error('Missing action or map column')
                    return header.evaluate(
                        (element, bounds) => {
                            const visible = [
                                ...element.querySelectorAll('.phase, .turn, .player-name, button')
                            ]
                            return (
                                visible.every((child) => {
                                    const rect = child.getBoundingClientRect()
                                    return (
                                        rect.left >= bounds.left - 1 &&
                                        rect.right <= bounds.right + 1
                                    )
                                }) && element.scrollWidth <= element.clientWidth + 1
                            )
                        },
                        {
                            left: Math.max(action.x, map.x),
                            right: Math.min(action.x + action.width, map.x + map.width)
                        }
                    )
                })
                .toBe(true)
            await expect(header.getByRole('button', { name: 'Undo', exact: true })).toBeVisible()
        }
    })
}
