import { expect, test, type Locator, type Page } from '@playwright/test'

async function openWorkspace(page: Page, splittable = true) {
    await page.goto('/session-test.html')
    await page.evaluate(async (splittable) => {
        const { mountWorkspace } = await import(
            new URL('/src/lib/components/tests/workspace.fixture.ts', location.href).href
        )
        mountWorkspace(splittable)
    }, splittable)
}

async function splitTopAndBottom(page: Page) {
    await page.getByRole('button', { name: 'Pane options for Example pane 1' }).click()
    await page.getByRole('button', { name: 'Split pane 1 horizontally' }).click()
}

async function expectInsideWindow(page: Page, menu: Locator) {
    const bounds = await menu.evaluate((element) => element.getBoundingClientRect().toJSON())
    const window = page.viewportSize()
    expect(bounds.top).toBeGreaterThanOrEqual(0)
    expect(bounds.bottom).toBeLessThanOrEqual(window?.height ?? 0)
}

test('workspace works without a game and ignores railway theme variables', async ({ page }) => {
    await openWorkspace(page)
    const editor = page.getByRole('tab', { name: 'Editor', exact: true })
    await expect(editor).toHaveCSS('color', 'rgb(55, 65, 81)')
    await page.getByRole('textbox', { name: 'editor draft' }).fill('preserved')
    await page.getByRole('button', { name: 'Pane options for Example pane 1' }).click()
    await expect(page.locator('.widget-menu:popover-open')).toHaveCSS(
        'background-color',
        'rgb(255, 255, 255)'
    )
    await expect(page.getByRole('button', { name: 'Close editor tab' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Split pane 1 vertically' }).click()
    await editor.dragTo(page.getByText('Drag a tab here', { exact: true }))
    await expect(page.getByRole('textbox', { name: 'editor draft' })).toHaveValue('preserved')
    const divider = page.getByRole('separator', { name: 'Resize vertical split' })
    await divider.focus()
    await page.keyboard.press('ArrowRight')
    await expect(divider).toHaveAttribute('aria-valuenow', '52')
    await expect(page.getByLabel('Saved layout')).toContainText('"cols",52')
    await page.getByRole('button', { name: 'Pane options for Example pane 2' }).click()
    await page.getByRole('button', { name: 'Notes', exact: true }).click()
    await expect(page.getByRole('tab', { name: 'Notes', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Split pane 2 vertically' })).toBeHidden()
    await expect(
        page.getByRole('button', { name: 'Delete pane 1', exact: true, includeHidden: true })
    ).toHaveCount(1)
    await page.getByRole('button', { name: 'Pane options for Example pane 2' }).click()
    const deletePane = page.getByRole('button', { name: 'Delete pane 2', exact: true })
    await expect(deletePane).toHaveCSS('color', 'rgb(220, 38, 38)')
    await deletePane.click()
    await expect(page.getByRole('tablist')).toHaveCount(1)
    await expect(
        page.getByRole('button', { name: /^Delete pane /, includeHidden: true })
    ).toHaveCount(0)
    await editor.click()
    await expect(page.getByRole('textbox', { name: 'editor draft' })).toHaveValue('preserved')
})

test('an unsplittable workspace adds and closes tabs without splitting or deleting its pane', async ({
    page
}) => {
    await openWorkspace(page, false)
    await page.getByRole('button', { name: 'Pane options for Example pane 1' }).click()
    const menu = page.locator('.widget-menu:popover-open')
    await expect(menu.getByRole('button', { name: /^Split pane / })).toHaveCount(0)
    await expect(menu.getByRole('button', { name: /^Delete pane / })).toHaveCount(0)
    await menu.getByRole('button', { name: 'Notes', exact: true }).click()
    await expect(page.getByRole('tab', { name: 'Notes', exact: true })).toHaveAttribute(
        'aria-selected',
        'true'
    )
    await expect(page.getByRole('tab', { name: 'Notes', exact: true })).toHaveAttribute(
        'draggable',
        'false'
    )
    await page.getByRole('button', { name: 'Pane options for Example pane 1' }).click()
    const tabs = page.getByRole('tablist', { name: 'Example tabs 1' }).getByRole('tab')
    const grip = menu.getByRole('button', { name: 'Move Notes tab', exact: true })
    const box = (await grip.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2, box.y - box.height * 2, { steps: 6 })
    await page.mouse.up()
    await expect(tabs).toHaveText(['Notes', 'Editor', 'Preview'])
    await menu.getByRole('button', { name: 'Move Editor tab', exact: true }).focus()
    await page.keyboard.press('ArrowUp')
    await expect(tabs).toHaveText(['Editor', 'Notes', 'Preview'])
    await expect(menu.getByRole('button', { name: 'Move Editor tab', exact: true })).toBeFocused()
    await page.getByRole('button', { name: 'Close preview tab' }).click()
    await expect(page.getByRole('tab', { name: 'Preview', exact: true })).toHaveCount(0)
    await expect(page.getByLabel('Saved layout')).toHaveText(
        JSON.stringify({ closed: ['preview'], v: 1, sidebar: [], main: ['editor', 'notes'] })
    )
})

test('the menu of a low pane shorter than the menu opens upward inside the window', async ({
    page
}) => {
    await page.setViewportSize({ width: 800, height: 500 })
    await openWorkspace(page)
    await splitTopAndBottom(page)
    const divider = page.getByRole('separator', { name: 'Resize horizontal split' })
    await divider.focus()
    await page.keyboard.press('End')
    for (let step = 0; step < 5; step++) await page.keyboard.press('ArrowUp')
    await page.getByRole('button', { name: 'Pane options for Example pane 2' }).click()
    const menu = page.locator('.widget-menu:popover-open')
    expect((await menu.boundingBox())?.height).toBeGreaterThan(
        (await page.getByRole('region', { name: 'Example pane 2' }).boundingBox())?.height ??
            Infinity
    )
    await expectInsideWindow(page, menu)
    await expect(menu.getByRole('button', { name: 'Delete pane 2', exact: true })).toBeInViewport({
        ratio: 1
    })
})

test('an open pane menu moves back inside the window when the window shrinks', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 500 })
    await openWorkspace(page)
    await splitTopAndBottom(page)
    await page.getByRole('button', { name: 'Pane options for Example pane 2' }).click()
    const menu = page.locator('.widget-menu:popover-open')
    await expectInsideWindow(page, menu)
    await page.setViewportSize({ width: 800, height: 300 })
    await expect
        .poll(() => menu.evaluate((element) => element.getBoundingClientRect().top))
        .toBeGreaterThanOrEqual(0)
    await expectInsideWindow(page, menu)
})

test('a pane menu taller than the room on either side scrolls inside the window', async ({
    page
}) => {
    await page.setViewportSize({ width: 800, height: 500 })
    await openWorkspace(page)
    await splitTopAndBottom(page)
    await page.setViewportSize({ width: 800, height: 120 })
    await page.getByRole('button', { name: 'Pane options for Example pane 1' }).click()
    const menu = page.locator('.widget-menu:popover-open')
    await expectInsideWindow(page, menu)
    expect(await menu.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true)
    await menu.getByRole('button', { name: 'Delete pane 1', exact: true }).click()
    await expect(page.getByRole('tablist')).toHaveCount(1)
})
