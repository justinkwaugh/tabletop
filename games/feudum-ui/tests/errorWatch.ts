import { expect, test as base } from '@playwright/test'

declare global {
    interface Window {
        feudumWindowError?: (message: string) => void
    }
}

/**
 * Every browser test fails on an uncaught page error or a window error event: a ResizeObserver
 * loop reaches only the window's error event, never `pageerror`.
 */
export const test = base.extend<{ failsOnErrors: void }>({
    failsOnErrors: [
        async ({ page }, use) => {
            const problems: string[] = []
            page.on('pageerror', (error) => problems.push(error.message))
            await page.exposeFunction('feudumWindowError', (message: string) =>
                problems.push(message)
            )
            await page.addInitScript(() => {
                window.addEventListener('error', (event) => {
                    window.feudumWindowError?.(event.message)
                })
            })
            await use()
            // A frame more, so an observer loop the test's last step set off has reported.
            if (!page.isClosed()) {
                await page.evaluate(
                    () =>
                        new Promise((done) =>
                            requestAnimationFrame(() => requestAnimationFrame(done))
                        )
                )
            }
            expect(problems).toEqual([])
        },
        { auto: true }
    ]
})

export { expect }
