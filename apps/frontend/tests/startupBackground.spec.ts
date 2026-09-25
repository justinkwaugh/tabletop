import { expect, test } from '@playwright/test'
import { mockLibrary } from './fixtures/library'

test.beforeEach(async ({ page }) => {
    await mockLibrary(page)
})

test('the app shell paints the dark page background before any stylesheet loads', async ({
    page
}) => {
    let releaseStylesheets = () => {}
    const stylesheetsHeld = new Promise<void>((resolve) => (releaseStylesheets = resolve))
    await page.route('**/*.css', async (route) => {
        await stylesheetsHeld
        await route.continue()
    })
    await page.goto('/', { waitUntil: 'commit' })
    await page.waitForFunction(() => document.body !== null)
    const shellBackground = await page.evaluate(
        () => getComputedStyle(document.documentElement).backgroundColor
    )
    releaseStylesheets()
    await expect(page.getByRole('heading', { name: 'Care to play a game?' })).toBeVisible()
    const loadedBackground = await page.evaluate(
        () => getComputedStyle(document.body).backgroundColor
    )
    expect(shellBackground).toBe(loadedBackground)
})

test('every iOS launch image fits its device and matches the loaded page background', async ({
    page
}) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Care to play a game?' })).toBeVisible()
    const mismatches = await page.evaluate(async () => {
        const sample = document.createElement('canvas').getContext('2d', {
            willReadFrequently: true
        })
        if (!sample) throw new Error('Canvas 2D context unavailable')
        sample.fillStyle = getComputedStyle(document.body).backgroundColor
        sample.fillRect(0, 0, 1, 1)
        const background = [...sample.getImageData(0, 0, 1, 1).data].join()
        async function launchImageProblem(link: Element) {
            const media = link.getAttribute('media') ?? ''
            const href = link.getAttribute('href') ?? ''
            const query = media.match(
                /device-width: (\d+)px\) and \(device-height: (\d+)px\) and \(-webkit-device-pixel-ratio: (\d+)\) and \(orientation: (portrait|landscape)\)/
            )
            if (!query) return `${href}: unrecognised media ${media}`
            const [, width, height, ratio, orientation] = query
            const portrait = [Number(width) * Number(ratio), Number(height) * Number(ratio)]
            const [expectedWidth, expectedHeight] =
                orientation === 'portrait' ? portrait : [portrait[1], portrait[0]]
            const image = new Image()
            image.src = href
            await image.decode()
            if (image.naturalWidth !== expectedWidth || image.naturalHeight !== expectedHeight)
                return `${href}: ${image.naturalWidth}x${image.naturalHeight}, expected ${expectedWidth}x${expectedHeight}`
            sample.drawImage(image, expectedWidth / 2, expectedHeight / 2, 1, 1, 0, 0, 1, 1)
            const color = [...sample.getImageData(0, 0, 1, 1).data].join()
            return color === background
                ? undefined
                : `${href}: colour ${color}, expected ${background}`
        }
        const links = [...document.querySelectorAll('link[rel="apple-touch-startup-image"]')]
        const problems: (string | undefined)[] = []
        for (const link of links) problems.push(await launchImageProblem(link))
        return { count: links.length, problems: problems.filter(Boolean) }
    })
    expect(mismatches.count).toBeGreaterThan(0)
    expect(mismatches.problems).toEqual([])
})
