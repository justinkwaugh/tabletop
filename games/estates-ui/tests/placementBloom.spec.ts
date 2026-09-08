import { expect, test } from '@playwright/test'
import { createGame, inspectScene, waitForFrames } from './helpers'

test('inactive site and mayor cues do not add bloom when a game loads', async ({
    page
}, testInfo) => {
    await inspectScene(page)
    await createGame(page, 'Inactive placement cues')
    await expect
        .poll(() =>
            page.evaluate(async () => {
                const url = new URL('/src/lib/utils/pulsingMaterial.ts', location.href).href
                const { PulsingMaterial }: typeof import('../src/lib/utils/pulsingMaterial') =
                    await import(url)
                let count = 0
                window.estatesScene?.traverse((object) => {
                    if (Reflect.get(object, 'material') instanceof PulsingMaterial) count++
                })
                return count
            })
        )
        .toBe(33)
    await waitForFrames(page)
    const loaded = await page.locator('canvas').screenshot()
    await page.evaluate(async () => {
        const url = new URL('/src/lib/utils/pulsingMaterial.ts', location.href).href
        const { PulsingMaterial }: typeof import('../src/lib/utils/pulsingMaterial') = await import(
            url
        )
        window.estatesScene.traverse((object) => {
            const material = Reflect.get(object, 'material')
            if (material instanceof PulsingMaterial) {
                if (material.active || material.opacity !== 0) {
                    throw new Error('The initial auction must not enable placement cues')
                }
                object.visible = false
            }
        })
        window.estatesInvalidate()
    })
    await waitForFrames(page)
    const hidden = await page.locator('canvas').screenshot()
    if (!hidden.equals(loaded)) {
        await testInfo.attach('loaded-board', { body: loaded, contentType: 'image/png' })
        await testInfo.attach('without-placement-meshes', {
            body: hidden,
            contentType: 'image/png'
        })
    }
    expect(
        hidden.equals(loaded),
        'Inactive placement cues must not affect the rendered board'
    ).toBe(true)
})
