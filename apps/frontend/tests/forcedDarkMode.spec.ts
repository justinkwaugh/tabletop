import { expect, test } from '@playwright/test'
import { mockLibrary } from './fixtures/library'

// Chrome's "Darken websites" (Auto Dark Mode) repaints pages that do not declare a colour
// scheme, inverting small light images: white Reef Encounter polyps were drawn black and grey
// ones near-white. Android darkens websites only with the system in dark theme, and Chrome
// honours a page's colour scheme only when it differs from that preference, so the test
// prefers dark as well.
test.use({
    colorScheme: 'dark',
    launchOptions: { args: ['--blink-settings=forceDarkModeEnabled=true'] }
})

test.beforeEach(async ({ page }) => {
    await mockLibrary(page)
})

test('small light pictures keep their colours when the browser darkens websites', async ({
    page
}) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Care to play a game?' })).toBeVisible()
    // Coral-sized raster pieces, a flat colour crossed by dark linework as the polyp art is;
    // Chrome's classifier left SVG versions of these pieces alone.
    await page.evaluate(() => {
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 40
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Canvas 2D context unavailable')
        const pieces = ['#ffffff', '#8f867f'].map((paint, index) => {
            context.fillStyle = paint
            context.fillRect(0, 0, 40, 40)
            context.fillStyle = '#000000'
            context.fillRect(18, 0, 4, 40)
            const piece = document.createElement('img')
            piece.src = canvas.toDataURL()
            piece.width = piece.height = 40
            piece.style.cssText = `position: fixed; left: ${index * 50}px; top: 0; z-index: 9999`
            document.body.append(piece)
            return piece.decode()
        })
        return Promise.all(pieces)
    })
    const shot = await page.screenshot({ clip: { x: 0, y: 0, width: 100, height: 40 } })
    const painted = await page.evaluate(
        async (png) => {
            const image = await createImageBitmap(await (await fetch(png)).blob())
            const context = document.createElement('canvas').getContext('2d')
            if (!context) throw new Error('Canvas 2D context unavailable')
            context.drawImage(image, 0, 0)
            return [5, 55].map((x) => [...context.getImageData(x, 5, 1, 1).data].slice(0, 3))
        },
        `data:image/png;base64,${shot.toString('base64')}`
    )
    expect(painted).toEqual([
        [255, 255, 255],
        [143, 134, 127]
    ])
})
