import { chromium, firefox, expect, test, type BrowserType, type Page } from '@playwright/test'

async function withWorkspace(
    browserType: BrowserType,
    baseURL: string | undefined,
    run: (page: Page) => Promise<void>
) {
    const browser = await browserType.launch()
    try {
        const page = await browser.newPage({ baseURL })
        await page.goto('/session-test.html')
        await page.evaluate(async () => {
            const fixture = await import(
                new URL('/src/lib/model/tests/privateHandSession.fixture.ts', location.href).href
            )
            await fixture.mountWorkspaceWithHistoryKeys()
        })
        await run(page)
    } finally {
        await browser.close()
    }
}

for (const browserType of [chromium, firefox]) {
    const name = browserType.name()

    test(`${name}: arrow keys step history after a pane tab is clicked`, async ({ baseURL }) => {
        await withWorkspace(browserType, baseURL, async (page) => {
            const actions = page.getByRole('tab', { name: 'Actions', exact: true })
            const position = page.getByLabel('History position')
            await expect(position).toHaveText('live')
            await actions.click()
            await page.keyboard.press('ArrowLeft')
            await expect(position).toHaveText('0')
            // A press while the last step still plays is ignored, so repeat until it lands.
            await expect(async () => {
                await page.keyboard.press('ArrowRight')
                await expect(position).toHaveText('live', { timeout: 500 })
            }).toPass()
            await expect(actions).toHaveAttribute('aria-selected', 'true')
            await expect(actions).toBeFocused()
            await expect(actions).toHaveCSS('outline-style', 'none')
        })
    })

    test(`${name}: a clicked tab still leaves arrows to history after the window refocuses`, async ({
        baseURL
    }) => {
        await withWorkspace(browserType, baseURL, async (page) => {
            const actions = page.getByRole('tab', { name: 'Actions', exact: true })
            await actions.click()
            await actions.evaluate((tab: HTMLElement) => {
                const hasFocus = document.hasFocus
                document.hasFocus = () => false
                tab.blur()
                document.hasFocus = hasFocus
                tab.focus()
            })
            await page.keyboard.press('ArrowLeft')
            await expect(page.getByLabel('History position')).toHaveText('0')
            await expect(actions).toHaveAttribute('aria-selected', 'true')
        })
    })

    test(`${name}: arrow keys switch a keyboard-focused tab without stepping history`, async ({
        baseURL
    }) => {
        await withWorkspace(browserType, baseURL, async (page) => {
            await page.getByRole('button', { name: 'Before the workspace' }).click()
            await page.keyboard.press('Tab')
            const actions = page.getByRole('tab', { name: 'Actions', exact: true })
            await expect(actions).toBeFocused()
            await page.keyboard.press('ArrowRight')
            const order = page.getByRole('tab', { name: 'Order', exact: true })
            await expect(order).toHaveAttribute('aria-selected', 'true')
            await expect(order).toBeFocused()
            await expect(order).toHaveCSS('outline-style', 'solid')
            await page.keyboard.press('ArrowLeft')
            await expect(actions).toHaveAttribute('aria-selected', 'true')
            await expect(page.getByLabel('History position')).toHaveText('live')
        })
    })

    test(`${name}: a tab pressed without taking focus switches with arrows once reached by keyboard`, async ({
        baseURL
    }) => {
        await withWorkspace(browserType, baseURL, async (page) => {
            const actions = page.getByRole('tab', { name: 'Actions', exact: true })
            await actions.dispatchEvent('pointerdown')
            await page.waitForTimeout(50)
            await page.getByRole('button', { name: 'Before the workspace' }).click()
            await page.keyboard.press('Tab')
            await expect(actions).toBeFocused()
            await page.keyboard.press('ArrowRight')
            await expect(page.getByRole('tab', { name: 'Order', exact: true })).toHaveAttribute(
                'aria-selected',
                'true'
            )
            await expect(page.getByLabel('History position')).toHaveText('live')
        })
    })
}
