import { expect, test } from '@playwright/test'
import { mockLibrary } from './fixtures/library'

// Chrome's "Darken websites" (Auto Dark Mode) repaints pages that do not declare a colour
// scheme, inverting small light images: white Reef Encounter polyps were drawn black.
test.use({
    colorScheme: 'dark',
    launchOptions: { args: ['--blink-settings=forceDarkModeEnabled=true'] }
})

test.beforeEach(async ({ page }) => {
    await mockLibrary(page)
})

test('the site keeps its own colours when the browser darkens websites', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Care to play a game?' })).toBeVisible()
    await page.evaluate(() => {
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 40
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Canvas 2D context unavailable')
        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, 40, 40)
        context.fillStyle = '#000000'
        context.fillRect(18, 0, 4, 40)
        const piece = document.createElement('img')
        piece.id = 'white-piece'
        piece.src = canvas.toDataURL()
        piece.width = piece.height = 40
        piece.style.cssText = 'position: fixed; left: 0; top: 0; z-index: 9999'
        document.body.append(piece)
        return piece.decode()
    })
    const shot = await page.screenshot({ clip: { x: 5, y: 5, width: 1, height: 1 } })
    const pixel = await page.evaluate(
        async (png) => {
            const image = await createImageBitmap(await (await fetch(png)).blob())
            const sample = document.createElement('canvas').getContext('2d')
            if (!sample) throw new Error('Canvas 2D context unavailable')
            sample.drawImage(image, 0, 0)
            return [...sample.getImageData(0, 0, 1, 1).data].slice(0, 3)
        },
        `data:image/png;base64,${shot.toString('base64')}`
    )
    expect(pixel).toEqual([255, 255, 255])
})
