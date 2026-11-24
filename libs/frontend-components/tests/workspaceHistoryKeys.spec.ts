import { chromium, firefox, expect, test, type Page } from '@playwright/test'

async function open(page: Page) {
    await page.goto('/session-test.html')
    await page.evaluate(async () => {
        const { mountWorkspaceWithHistoryKeys } = await import(
            new URL('/src/lib/components/tests/workspace.fixture.ts', location.href).href
        )
        mountWorkspaceWithHistoryKeys()
    })
}

for (const browserType of [chromium, firefox]) {
    test(`${browserType.name()}: arrow keys step history after a pane tab is clicked`, async ({
        baseURL
    }) => {
        const browser = await browserType.launch()
        try {
            const page = await browser.newPage({ baseURL })
            await open(page)
            const actions = page.getByRole('tab', { name: 'Actions', exact: true })
            await actions.click()
            await page.keyboard.press('ArrowRight')
            await page.keyboard.press('ArrowRight')
            await page.keyboard.press('ArrowLeft')
            await expect(page.getByLabel('History steps')).toHaveText('next,next,previous')
            await expect(actions).toHaveAttribute('aria-selected', 'true')
            await expect(actions).toBeFocused()
        } finally {
            await browser.close()
        }
    })

    test(`${browserType.name()}: arrow keys switch a keyboard-focused tab without stepping history`, async ({
        baseURL
    }) => {
        const browser = await browserType.launch()
        try {
            const page = await browser.newPage({ baseURL })
            await open(page)
            await page.getByRole('button', { name: 'Before the workspace' }).click()
            await page.keyboard.press('Tab')
            await expect(page.getByRole('tab', { name: 'Actions', exact: true })).toBeFocused()
            await page.keyboard.press('ArrowRight')
            const order = page.getByRole('tab', { name: 'Order', exact: true })
            await expect(order).toHaveAttribute('aria-selected', 'true')
            await expect(order).toBeFocused()
            await page.keyboard.press('ArrowLeft')
            await expect(page.getByRole('tab', { name: 'Actions', exact: true })).toHaveAttribute(
                'aria-selected',
                'true'
            )
            await expect(page.getByLabel('History steps')).toHaveText('')
        } finally {
            await browser.close()
        }
    })
}
