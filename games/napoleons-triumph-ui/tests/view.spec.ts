import { expect, test, type Page } from '@playwright/test'
import { createGame, deployBothArmies, failOnPageErrors } from './table.js'

failOnPageErrors()

test.use({ hasTouch: true, viewport: { width: 1180, height: 820 } })
test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'One-finger touches are sent through the Chromium DevTools protocol'
)

async function boardCorner(page: Page) {
    const box = await page.locator('svg[viewBox^="0 0 2550"]').first().boundingBox()
    return { x: Math.round(box?.x ?? 0), y: Math.round(box?.y ?? 0) }
}

async function dragWithOneFinger(page: Page, from: [number, number], to: [number, number]) {
    const touch = await page.context().newCDPSession(page)
    const STEPS = 12
    await touch.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: from[0], y: from[1] }]
    })
    for (let step = 1; step <= STEPS; step++) {
        await touch.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [
                {
                    x: from[0] + ((to[0] - from[0]) * step) / STEPS,
                    y: from[1] + ((to[1] - from[1]) * step) / STEPS
                }
            ]
        })
    }
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

test('a view panned away by touch from where the map was sent stays put when the map area changes size', async ({
    page
}) => {
    await createGame(page)
    await deployBothArmies(page)
    const atTheStart = await boardCorner(page)
    await page.getByRole('button', { name: 'Show Bagration on the map' }).click()
    await expect.poll(() => boardCorner(page)).not.toEqual(atTheStart)
    await page.waitForTimeout(900)
    const onTheCorps = await boardCorner(page)

    await dragWithOneFinger(page, [900, 600], [700, 480])
    await expect.poll(() => boardCorner(page)).not.toEqual(onTheCorps)
    await page.waitForTimeout(1200)
    const pannedAway = await boardCorner(page)

    await page.setViewportSize({ width: 1180, height: 760 })
    await page.waitForTimeout(600)
    expect(await boardCorner(page)).not.toEqual(onTheCorps)
    expect(await boardCorner(page)).toEqual(pannedAway)
})
