import { test, expect } from '@playwright/test'

test('player order moves when navigating between recorded turn orders', async ({ page }) => {
    test.setTimeout(60000)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/table')
    await page.getByLabel('Position', { exact: true }).selectOption('finished')
    await page.getByRole('tab', { name: 'Players', exact: true }).click()
    await expect(page.locator('.players article[data-player-id]')).toHaveCount(3)
    const before = await page
        .locator('.players article[data-player-id]')
        .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-player-id')))
    await page.evaluate(() => {
        const animate = Element.prototype.animate
        Element.prototype.animate = function (...args) {
            if (this.matches('.players article'))
                this.setAttribute('data-observed-animation', JSON.stringify(args[1]))
            return animate.apply(this, args)
        }
    })
    await page.getByRole('button', { name: 'goto my last turn', exact: true }).click()
    const forward = page.getByRole('button', { name: 'step forwards', exact: true })
    let changed = false
    for (let step = 0; step < 180 && !changed; step++) {
        await forward.click()
        await expect(forward).toBeEnabled()
        const order = await page
            .locator('.players article[data-player-id]')
            .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-player-id')))
        changed = JSON.stringify(order) !== JSON.stringify(before)
    }
    expect(changed).toBe(true)
    await expect(page.locator('.players article[data-observed-animation]').first()).toBeAttached()
})
