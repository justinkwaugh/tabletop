import { expect, test } from '@playwright/test'
import { storedFamilyPreference } from './preferenceStorage.js'

test('layout edits debounce, recover on immediate reload, and restore split percentages', async ({
    page
}) => {
    await page.goto('/table')
    const divider = page.getByRole('separator', { name: 'Resize horizontal split' }).last()
    await divider.focus()
    await page.keyboard.press('ArrowUp')
    await page.keyboard.press('ArrowUp')
    await expect(page.getByRole('button', { name: 'Layout unsaved', exact: true })).toBeVisible()
    expect(await storedFamilyPreference(page, 'paneLayout')).toBeFalsy()
    await page.reload()
    await expect(divider).toHaveAttribute('aria-valuenow', '46')
    await expect
        .poll(() => storedFamilyPreference(page, 'paneLayout'), { timeout: 10000 })
        .toMatchObject({
            v: 1,
            main: [
                'cols',
                20,
                ['rows', 25, ['Game info'], ['Players', 'History', 'Chat']],
                [
                    'rows',
                    46,
                    ['Actions'],
                    ['Map', 'Market', 'Spreadsheet', 'Companies', 'Tiles', 'Player Aid']
                ]
            ]
        })
    const saved = await storedFamilyPreference(page, 'paneLayout')
    await page.getByRole('tab', { name: 'Market', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Layout unsaved', exact: true })).toHaveCount(0)
    await page.setViewportSize({ width: 900, height: 900 })
    await expect(page.getByRole('tab', { name: 'Actions', exact: true })).toHaveCount(0)
    await page.setViewportSize({ width: 1400, height: 900 })
    await expect(divider).toHaveAttribute('aria-valuenow', '46')
    expect(await storedFamilyPreference(page, 'paneLayout')).toEqual(saved)
})

test('restores tab transfers and sanitizes unknown tabs without overwriting future layouts', async ({
    page
}) => {
    await page.goto('/table')
    await page
        .getByRole('tab', { name: 'History', exact: true })
        .dragTo(page.getByRole('tab', { name: 'Map', exact: true }))
    await page.getByRole('button', { name: 'Layout unsaved', exact: true }).click()
    await expect
        .poll(() => storedFamilyPreference(page, 'paneLayout'))
        .toMatchObject({
            sidebar: [],
            main: [
                'cols',
                20,
                ['rows', 25, ['Game info'], ['Players', 'Chat']],
                [
                    'rows',
                    50,
                    ['Actions'],
                    ['History', 'Map', 'Market', 'Spreadsheet', 'Companies', 'Tiles', 'Player Aid']
                ]
            ]
        })
    await page.reload()
    await expect(
        page
            .getByRole('tablist', { name: 'Table views tabs 4' })
            .getByRole('tab', { name: 'History', exact: true })
    ).toBeVisible()
    await page.evaluate(() => {
        const key = Object.keys(localStorage).find(
            (key) => key.includes('harness:preferences:') && key.includes('family:18xx')
        )!
        const record = JSON.parse(localStorage.getItem(key)!)
        record.values.paneLayout = {
            v: 1,
            sidebar: ['Players', 'Unknown', 'Map'],
            main: ['cols', 99, ['Map', 'Map', 'OldTab'], ['Tiles']]
        }
        localStorage.setItem(key, JSON.stringify(record))
    })
    await page.reload()
    await expect(page.getByRole('tab', { name: 'Map', exact: true })).toHaveCount(1)
    await expect(page.getByRole('tab', { name: 'OldTab', exact: true })).toHaveCount(0)
    await expect(page.getByRole('tab', { name: 'History', exact: true })).toHaveCount(1)
    await expect(
        page.getByRole('separator', { name: 'Resize vertical split' }).last()
    ).toHaveAttribute('aria-valuenow', '95')
    await page.evaluate(() => {
        const key = Object.keys(localStorage).find(
            (key) => key.includes('harness:preferences:') && key.includes('family:18xx')
        )!
        const record = JSON.parse(localStorage.getItem(key)!)
        record.values.paneLayout = { v: 99, future: 'keep me' }
        localStorage.setItem(key, JSON.stringify(record))
    })
    await page.reload()
    await expect(page.getByRole('tab', { name: 'Map', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Layout unsaved', exact: true })).toHaveCount(0)
    expect(await storedFamilyPreference(page, 'paneLayout')).toEqual({ v: 99, future: 'keep me' })
})

test('swap exchanges whole panes, preserves mounted content and saves the result', async ({
    page
}) => {
    await page.goto('/table')
    const actions = page.getByRole('tabpanel', { name: 'Actions', exact: true })
    const map = page.getByRole('tabpanel', { name: 'Map', exact: true })
    await map.evaluate((element) => (element.dataset.mountCheck = 'preserved'))
    const divider = page.getByRole('separator', { name: 'Resize horizontal split' }).last()
    await divider.focus()
    await page.keyboard.press('Home')
    await page.getByRole('button', { name: 'Swap sides of horizontal split' }).last().click()
    await expect(divider).toHaveAttribute('aria-valuenow', '95')
    const mapBounds = await map.boundingBox()
    const actionBounds = await actions.boundingBox()
    if (!mapBounds || !actionBounds) throw new Error('Both panes must be visible')
    expect(mapBounds.y).toBeLessThan(actionBounds.y)
    await expect(map).toHaveAttribute('data-mount-check', 'preserved')
    await page.getByRole('button', { name: 'Layout unsaved', exact: true }).click()
    await expect
        .poll(() => storedFamilyPreference(page, 'paneLayout'))
        .toMatchObject({
            main: [
                'cols',
                20,
                ['rows', 25, ['Game info'], ['Players', 'History', 'Chat']],
                [
                    'rows',
                    95,
                    ['Map', 'Market', 'Spreadsheet', 'Companies', 'Tiles', 'Player Aid'],
                    ['Actions']
                ]
            ]
        })
    await page.reload()
    await expect(
        page
            .getByRole('tablist', { name: 'Table views tabs 3' })
            .getByRole('tab', { name: 'Map', exact: true })
    ).toBeVisible()
    await expect(divider).toHaveAttribute('aria-valuenow', '95')
})
