import { expect, test } from '@playwright/test'
import { openProtectedGame } from './protectedGame.js'

// A CSS filter over the land makes the browser draw the whole board again offscreen at device
// resolution. Late in a game that cost pushed iPhones past their memory limit, reloading the
// page, so the land's shadow is an image behind it instead.
test('the land casts its shadow without a CSS filter over the board', async ({ page }) => {
    await openProtectedGame(page)
    const land = page.locator('.land')

    const filters = await land.evaluate((element) => {
        const found: string[] = []
        for (let node: Element | null = element; node; node = node.parentElement) {
            const filter = getComputedStyle(node).filter
            if (filter !== 'none') found.push(`${node.className}: ${filter}`)
        }
        return found
    })
    expect(filters).toEqual([])

    const shadow = land.locator('.land-shadow')
    await expect(shadow).toHaveCount(1)
    expect(await shadow.evaluate((element) => getComputedStyle(element).backgroundImage)).toContain(
        'data:image/svg+xml'
    )
})
