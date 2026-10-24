import { storedFamilyPreference } from './preferenceStorage.js'
import { expect, test } from '@playwright/test'

test('history order defaults to newest last and follows the player between titles', async ({
    page
}) => {
    await page.goto('/table')
    await page.getByRole('tab', { name: 'History', exact: true }).click()
    const last = page.getByRole('button', { name: 'Newest last', exact: true })
    const first = page.getByRole('button', { name: 'Newest first', exact: true })
    await expect(last).toHaveAttribute('aria-pressed', 'true')
    await first.click()
    await expect(first).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => storedFamilyPreference(page, 'historyOrder')).toBe('newestFirst')
    await page.reload()
    await page.getByRole('tab', { name: 'History', exact: true }).click()
    await expect(first).toHaveAttribute('aria-pressed', 'true')
    await page.getByLabel('Game', { exact: true }).selectOption('1889')
    await page.getByRole('tab', { name: 'History', exact: true }).click()
    await expect(first).toHaveAttribute('aria-pressed', 'true')
    await last.click()
    await expect(last).toHaveAttribute('aria-pressed', 'true')
})

test('compact player cards toggle together and persist across reloads and titles', async ({
    page
}) => {
    await page.goto('/table')
    const compact = page.getByRole('button', { name: /^Compact .* card$/ })
    const expand = page.getByRole('button', { name: /^Expand .* card$/ })
    await expect(compact.first()).toBeVisible()
    await compact.first().click()
    await expect.poll(() => storedFamilyPreference(page, 'compactPlayerCards')).toBe(true)
    await expect(page.locator('.players > article:not(.compact)')).toHaveCount(0)
    await page.reload()
    await expect(expand.first()).toBeVisible()
    await expect(page.locator('.players > article:not(.compact)')).toHaveCount(0)
    await page.getByLabel('Game', { exact: true }).selectOption('1889')
    await expect(expand.first()).toBeVisible()
    await expect(page.locator('.players > article:not(.compact)')).toHaveCount(0)
    await expand.nth(1).click()
    await expect.poll(() => storedFamilyPreference(page, 'compactPlayerCards')).toBe(false)
    await expect(page.locator('.players > article.compact')).toHaveCount(0)
    await page.getByLabel('Game', { exact: true }).selectOption('TOP')
    await expect(compact.first()).toBeVisible()
    await expect(page.locator('.players > article.compact')).toHaveCount(0)
})

test('table always uses dark mode across reloads, titles and dialogs', async ({ page }) => {
    await page.goto('/table')
    const table = page.getByLabel('Game table', { exact: true })
    await expect(table).toHaveAttribute('data-theme', 'dark')
    await expect(table).toHaveCSS('color-scheme', 'dark')
    await page
        .locator('.action-information')
        .getByRole('button', { name: 'Open phase chart', exact: true })
        .click()
    await expect(page.getByRole('dialog')).toHaveCSS('color-scheme', 'dark')
    await page.keyboard.press('Escape')
    await page.reload()
    await expect(table).toHaveAttribute('data-theme', 'dark')
    await page.getByLabel('Game', { exact: true }).selectOption('1889')
    await expect(table).toHaveAttribute('data-theme', 'dark')
    await expect(page.getByRole('button', { name: /Switch to (light|dark) mode/ })).toHaveCount(0)
    await page.getByLabel('Game', { exact: true }).selectOption('TOP')
})

test('dark mode has no bright loading canvas on reload', async ({ page }) => {
    await page.goto('/table')
    await page.addInitScript(() => {
        let frames = 0
        function inspectFrame() {
            if (document.body) {
                const root = document.documentElement
                const bodyColor = getComputedStyle(document.body).backgroundColor
                if (
                    getComputedStyle(root).backgroundColor !== 'rgb(24, 33, 43)' ||
                    !['rgba(0, 0, 0, 0)', 'rgb(24, 33, 43)'].includes(bodyColor) ||
                    document.querySelector('.railway-table')?.getAttribute('data-theme') === 'light'
                ) {
                    root.dataset.brightStartupFrame = 'true'
                }
                root.dataset.startupFrames = String(++frames)
            }
            if (frames < 300) requestAnimationFrame(inspectFrame)
        }
        requestAnimationFrame(inspectFrame)
    })
    await page.reload()
    await page.getByRole('tab', { name: 'Board', exact: true }).waitFor()
    await expect.poll(() => page.locator('html').getAttribute('data-startup-frames')).not.toBeNull()
    await expect(page.locator('html')).not.toHaveAttribute('data-bright-startup-frame', 'true')
})

test('company card switches keep separate values in the paned and tabbed layouts', async ({
    page
}) => {
    await page.goto('/table')
    const companies = page.getByRole('tab', { name: 'Companies', exact: true })
    const wrap = page.getByRole('switch', { name: 'Wrap', exact: true })
    const wide = page.getByRole('switch', { name: 'Wide', exact: true })
    await companies.click()
    await wrap.click()
    await wide.click()
    await expect.poll(() => storedFamilyPreference(page, 'companyCardsWrap')).toBe(false)
    await expect.poll(() => storedFamilyPreference(page, 'companyCardsWide')).toBe(true)
    await page.setViewportSize({ width: 390, height: 844 })
    await companies.click()
    await expect(wrap).toHaveAttribute('aria-checked', 'true')
    await expect(wide).toHaveAttribute('aria-checked', 'false')
    await wrap.click()
    await expect.poll(() => storedFamilyPreference(page, 'companyCardsWrapTabbed')).toBe(false)
    expect(await storedFamilyPreference(page, 'companyCardsWide')).toBe(true)
    await page.setViewportSize({ width: 1280, height: 960 })
    await companies.click()
    await expect(wrap).toHaveAttribute('aria-checked', 'false')
    await expect(wide).toHaveAttribute('aria-checked', 'true')
})

test('the tabbed layout adds and closes views in both panes and saves them apart from the panes', async ({
    page
}) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/table')
    const views = page.getByRole('button', {
        name: 'Pane options for Table views pane 1',
        exact: true
    })
    const sidebar = page.getByRole('button', { name: 'Pane options for Sidebar', exact: true })
    const menu = page.locator('.widget-menu:popover-open')
    await views.click()
    await expect(menu.getByRole('button', { name: /^(Split|Delete) pane / })).toHaveCount(0)
    await expect(menu.getByRole('button', { name: 'Close Map tab', exact: true })).toHaveCount(0)
    await menu.getByRole('button', { name: 'Close Tiles tab', exact: true }).click()
    await expect(page.getByRole('tab', { name: 'Tiles', exact: true })).toHaveCount(0)
    await sidebar.click()
    await menu.getByRole('button', { name: 'Close Chat tab', exact: true }).click()
    await sidebar.click()
    await menu.getByRole('button', { name: 'Stats', exact: true }).click()
    await expect(
        page.getByRole('tablist', { name: 'Sidebar tabs', exact: true }).getByRole('tab')
    ).toHaveText(['Players', 'History', 'Stats'])
    await expect
        .poll(() => storedFamilyPreference(page, 'tabbedLayout'))
        .toEqual({
            closed: ['Tiles', 'Chat'],
            v: 1,
            sidebar: ['Players', 'History', 'Stats'],
            main: ['Map', 'Spreadsheet', 'Companies']
        })
    expect(await storedFamilyPreference(page, 'paneLayout')).toBeFalsy()
    await page.reload()
    await expect(page.getByRole('tab', { name: 'Stats', exact: true })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Tiles', exact: true })).toHaveCount(0)
    await expect(page.getByRole('tab', { name: 'Chat', exact: true })).toHaveCount(0)
})

test('the tabbed layout deletes the sidebar into one column and splits it back', async ({
    page
}) => {
    await page.setViewportSize({ width: 800, height: 844 })
    await page.goto('/table')
    const menu = page.locator('.widget-menu:popover-open')
    const views = page.getByRole('button', {
        name: 'Pane options for Table views pane 1',
        exact: true
    })
    const restore = menu.getByRole('button', { name: 'Add Sidebar pane', exact: true })
    const sidebarTabs = page.getByRole('tablist', { name: 'Sidebar tabs', exact: true })
    await views.click()
    await expect(menu.getByRole('button', { name: /^Delete / })).toHaveCount(0)
    await expect(restore).toHaveCount(0)
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Pane options for Sidebar', exact: true }).click()
    await menu.getByRole('button', { name: 'Delete Sidebar pane', exact: true }).click()
    await expect(sidebarTabs).toHaveCount(0)
    await expect(
        page.getByRole('tablist', { name: 'Table views tabs 1', exact: true }).getByRole('tab')
    ).toHaveText(['Board', /^Spreadsheet/, 'Companies', 'Tiles', 'Players', 'History', 'Chat'])
    await expect
        .poll(() => storedFamilyPreference(page, 'tabbedLayout'))
        .toEqual({
            sidebarDeleted: true,
            v: 1,
            sidebar: [],
            main: ['Map', 'Spreadsheet', 'Companies', 'Tiles', 'Players', 'History', 'Chat']
        })
    await page.reload()
    await expect(sidebarTabs).toHaveCount(0)
    await views.click()
    await restore.click()
    await expect(menu).toHaveCount(0)
    await expect(sidebarTabs.getByRole('tab')).toHaveText(['Players', 'History', 'Chat'])
    await views.click()
    await expect(restore).toHaveCount(0)
    await expect
        .poll(() => storedFamilyPreference(page, 'tabbedLayout'))
        .toEqual({
            v: 1,
            sidebar: ['Players', 'History', 'Chat'],
            main: ['Map', 'Spreadsheet', 'Companies', 'Tiles']
        })
})

test('a finger drag on a pane menu grip reorders the tabbed layout and saves it', async ({
    page
}) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/table')
    await page
        .getByRole('button', { name: 'Pane options for Table views pane 1', exact: true })
        .click()
    const grip = page.getByRole('button', { name: 'Move Tiles tab', exact: true })
    const box = (await grip.boundingBox())!
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    const touch = await page.context().newCDPSession(page)
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
    for (let step = 1; step <= 8; step++)
        await touch.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x, y: y - (box.height * 2 * step) / 8 }]
        })
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    const tabs = page
        .getByRole('tablist', { name: 'Table views tabs 1', exact: true })
        .getByRole('tab')
    await expect(tabs).toHaveText(['Board', 'Tiles', /^Spreadsheet/, 'Companies'])
    await expect
        .poll(() => storedFamilyPreference(page, 'tabbedLayout'))
        .toEqual({
            v: 1,
            sidebar: ['Players', 'History', 'Chat'],
            main: ['Map', 'Tiles', 'Spreadsheet', 'Companies']
        })
    await page.reload()
    await expect(tabs).toHaveText(['Board', 'Tiles', /^Spreadsheet/, 'Companies'])
})

test('the tabbed layout opens on the first tab of each pane unless a placement needs the map', async ({
    page
}) => {
    await page.setViewportSize({ width: 800, height: 844 })
    await page.goto('/table')
    const menu = page.locator('.widget-menu:popover-open')
    for (const [pane, tab, steps] of [
        ['Table views pane 1', 'Tiles', 3],
        ['Sidebar', 'History', 1]
    ] as const) {
        await page.getByRole('button', { name: `Pane options for ${pane}`, exact: true }).click()
        await menu.getByRole('button', { name: `Move ${tab} tab`, exact: true }).focus()
        for (let step = 0; step < steps; step++) await page.keyboard.press('ArrowUp')
        await page.keyboard.press('Escape')
    }
    await expect
        .poll(() => storedFamilyPreference(page, 'tabbedLayout'))
        .toEqual({
            v: 1,
            sidebar: ['History', 'Players', 'Chat'],
            main: ['Tiles', 'Map', 'Spreadsheet', 'Companies']
        })
    await page.reload()
    await expect(page.getByRole('tab', { name: 'Board', exact: true })).toHaveAttribute(
        'aria-selected',
        'true'
    )
    await page.getByLabel('Position', { exact: true }).selectOption('trading')
    for (const tab of ['Tiles', 'History'])
        await expect(page.getByRole('tab', { name: tab, exact: true })).toHaveAttribute(
            'aria-selected',
            'true'
        )
    await expect(page.getByRole('tab', { name: 'Board', exact: true })).toHaveAttribute(
        'aria-selected',
        'false'
    )
})

test('an emptied sidebar keeps its pane menu so it can still be deleted', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 844 })
    await page.goto('/table')
    const menu = page.locator('.widget-menu:popover-open')
    const views = page.getByRole('button', {
        name: 'Pane options for Table views pane 1',
        exact: true
    })
    const sidebar = page.getByRole('button', { name: 'Pane options for Sidebar', exact: true })
    for (const tab of ['Players', 'History', 'Chat']) {
        await sidebar.click()
        await menu.getByRole('button', { name: `Close ${tab} tab`, exact: true }).click()
    }
    for (const tab of [
        'Players',
        'History',
        'Chat',
        'Market',
        'Player Aid',
        'Depot',
        'Stats',
        'Game info'
    ]) {
        await views.click()
        await menu.getByRole('button', { name: tab, exact: true }).click()
    }
    await expect(
        page.getByRole('tablist', { name: 'Sidebar tabs', exact: true }).getByRole('tab')
    ).toHaveCount(0)
    await sidebar.click()
    await expect(menu.getByText('Add tabs', { exact: true })).toHaveCount(0)
    await menu.getByRole('button', { name: 'Delete Sidebar pane', exact: true }).click()
    await expect(sidebar).toHaveCount(0)
})

test('closing the pane menu mid-drag leaves its rows in place', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/table')
    const views = page.getByRole('button', {
        name: 'Pane options for Table views pane 1',
        exact: true
    })
    await views.click()
    const box = (await page
        .getByRole('button', { name: 'Move Tiles tab', exact: true })
        .boundingBox())!
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    const touch = await page.context().newCDPSession(page)
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
    await touch.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y: y - box.height * 2 }]
    })
    await page.keyboard.press('Escape')
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await views.click()
    const rows = page.locator('.widget-menu:popover-open .existing-tab')
    await expect(rows).toHaveCount(4)
    for (const row of await rows.all()) await expect(row).not.toHaveAttribute('style', /translate/)
    await expect(
        page.getByRole('tablist', { name: 'Table views tabs 1', exact: true }).getByRole('tab')
    ).toHaveText(['Board', /^Spreadsheet/, 'Companies', 'Tiles'])
})

test('operating order chips start shown in the tabbed layout and save that choice', async ({
    page
}) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/table')
    const chips = page.getByRole('button', { name: 'Operating order chips', exact: true })
    const companyOrder = page.getByRole('region', { name: 'Company order', exact: true })
    await expect(chips).toHaveAttribute('aria-expanded', 'true')
    await expect(companyOrder).toBeVisible()
    await chips.click()
    await expect(chips).toHaveAttribute('aria-expanded', 'false')
    await expect(companyOrder).toHaveCount(0)
    await expect.poll(() => storedFamilyPreference(page, 'operatingOrderChipsTabbed')).toBe(false)
    await page.reload()
    await expect(chips).toHaveAttribute('aria-expanded', 'false')
    await chips.click()
    await expect.poll(() => storedFamilyPreference(page, 'operatingOrderChipsTabbed')).toBe(true)
    await page.setViewportSize({ width: 1280, height: 960 })
    await page
        .getByRole('button', { name: 'Pane options for Table views pane 4', exact: true })
        .click()
    await page.getByRole('button', { name: 'Operating Order', exact: true }).click()
    await expect(chips).toHaveAttribute('aria-expanded', 'false')
})
