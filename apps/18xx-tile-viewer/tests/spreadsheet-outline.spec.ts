import { chromium, firefox, expect, test } from '@playwright/test'

for (const browserName of ['chromium', 'firefox'] as const) {
    test.describe(browserName, () => {
        test('outlines cross dividers continuously and leave the intersection open', async ({ baseURL }) => {
            const browser = await ({ chromium, firefox })[browserName].launch()
            const page = await browser.newPage({ baseURL })
            try {
                await page.goto('/table')
                await page.getByRole('tab', { name: 'Spreadsheet', exact: true }).click()
                const table = page.getByRole('table', { name: 'Company share ownership' })
                if (!await table.locator('.operating-column').count()) await page.getByRole('button', { name: 'Swap rows and columns' }).click()
                await table.evaluate(element => element.parentElement?.style.setProperty('--rail-focus', '#ff00ff'))
                for (const width of [1600, 1250, 1600, 1250]) {
                    await page.setViewportSize({ width, height: 1000 })
                    await expect(async () => {
                        const points = await table.evaluate(element => {
                            const bounds = element.getBoundingClientRect()
                            const visibleRight = Math.min(bounds.right, element.closest('.table-scroll')?.getBoundingClientRect().right ?? bounds.right)
                            const column = element.querySelector('thead .operating-column, thead .current-player-column')?.getBoundingClientRect()
                            if (!column) throw new Error('Fixture needs an operating company')
                            const rows = [...element.querySelectorAll('tr.current-player, tr.operating-company')].map(row => row.getBoundingClientRect())
                            const points: { x: number; y: number; vertical: boolean; outlined: boolean }[] = []
                            for (let y = 2; y < Math.floor(bounds.height) - 2; y++) {
                                if (rows.some(row => y > row.top - bounds.top - 2 && y < row.bottom - bounds.top + 2)) continue
                                for (const edge of [column.left, column.right]) points.push({ x: edge - bounds.left, y, vertical: true, outlined: true })
                            }
                            for (const row of rows) {
                                for (let x = 2; x < Math.floor(visibleRight - bounds.left) - 2; x++) {
                                    if (x > column.left - bounds.left - 2 && x < column.right - bounds.left + 2) continue
                                    for (const edge of [row.top, row.bottom]) points.push({ x, y: edge - bounds.top, vertical: false, outlined: true })
                                }
                                for (const edge of [column.left, column.right]) points.push({ x: edge - bounds.left, y: (row.top + row.bottom) / 2 - bounds.top, vertical: true, outlined: false })
                                for (const edge of [row.top, row.bottom]) points.push({ x: (column.left + column.right) / 2 - bounds.left, y: edge - bounds.top, vertical: false, outlined: false })
                            }
                            return points
                        })
                        const screenshot = await table.screenshot()
                        const mismatches = await page.evaluate(async ({ base64, points }) => {
                            const image = new Image()
                            image.src = `data:image/png;base64,${base64}`
                            await image.decode()
                            const canvas = document.createElement('canvas')
                            canvas.width = image.width
                            canvas.height = image.height
                            const context = canvas.getContext('2d')
                            if (!context) throw new Error('Canvas context required')
                            context.drawImage(image, 0, 0)
                            return points.filter(point => {
                                let painted = false
                                for (let offset = -1; offset <= 2; offset++) {
                                    const x = Math.floor(point.x) + (point.vertical ? offset : 0)
                                    const y = Math.floor(point.y) + (point.vertical ? 0 : offset)
                                    const [r, g, b] = context.getImageData(x, y, 1, 1).data
                                    if (r > 180 && g < 100 && b > 180) painted = true
                                }
                                return painted !== point.outlined
                            }).slice(0, 10)
                        }, { base64: screenshot.toString('base64'), points })
                        expect(points.length).toBeGreaterThan(100)
                        expect(mismatches).toEqual([])
                    }).toPass({ timeout: 5000 })
                    if (width === 1250) await page.getByRole('button', { name: 'Swap rows and columns' }).click()
                }
            } finally { await browser.close() }
        })
    })
}
