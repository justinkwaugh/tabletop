import { expect, test, webkit } from '@playwright/test'

for (const engine of ['chromium', 'webkit']) {
    test(`${engine} centers fixed and staged revenue labels`, async ({ page, baseURL }) => {
        const safari = engine === 'webkit' ? await webkit.launch() : undefined
        const target = safari ? await safari.newPage() : page
        try {
            await target.goto(`${baseURL}/table`)
            const labels = target.locator('[data-revenue-for] text')
            await labels.first().waitFor()
            const centers = await labels.evaluateAll((elements) =>
                elements.map((element) => {
                    if (!(element instanceof SVGGraphicsElement))
                        throw new Error('Expected SVG revenue text')
                    const box = element.getBBox()
                    return {
                        text: element.textContent,
                        x: box.x + box.width / 2,
                        y: box.y + box.height / 2
                    }
                })
            )
            expect(centers.length).toBeGreaterThan(0)
            for (const center of centers) {
                expect(Math.abs(center.x), `${center.text} horizontal center`).toBeLessThan(0.5)
                expect(Math.abs(center.y), `${center.text} vertical center`).toBeLessThan(0.5)
            }
        } finally {
            await safari?.close()
        }
    })
}
