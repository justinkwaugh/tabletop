import { expect, test, type Page } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { failOnPageErrors } from './table.js'

failOnPageErrors()

async function chooseScenario(page: Page, name: string) {
    await page.getByRole('button', { name: 'Scenarios' }).click()
    await page.getByRole('button', { name }).click()
}

async function loadFromFile(page: Page, path: string) {
    await page.getByRole('button', { name: 'Scenarios' }).click()
    const chooser = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: 'Load from file…' }).click()
    await (await chooser).setFiles(path)
}

test('a game saved as a scenario opens again from its file, with its history', async ({
    page
}, testInfo) => {
    await page.goto('/')
    await chooseScenario(page, 'Second attack after a repulse or feint')
    const legrand = page.locator('[data-commander="legrand"][aria-label="Select these pieces"]')
    await legrand.dispatchEvent('click')
    await page.locator('[aria-label^="Move to"]').first().dispatchEvent('click')
    const moved = page.getByText('Commands used this turn: 1 corps')
    await expect(moved).toBeVisible()

    await page.getByRole('button', { name: 'Scenarios' }).click()
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Save as scenario' }).click()
    const file = await download
    expect(file.suggestedFilename()).toBe('a-second-attack-after-a-repulse-or-a-feint.json')
    const saved = testInfo.outputPath('saved.json')
    await file.saveAs(saved)

    await chooseScenario(page, 'Second attack after a repulse or feint')
    await expect(moved).toBeHidden()
    await loadFromFile(page, saved)
    await expect(moved).toBeVisible()
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(moved).toBeHidden()
    await expect(legrand).toBeVisible()
})

test('a file that is not a scenario is reported and opens nothing', async ({ page }, testInfo) => {
    await page.goto('/')
    const broken = testInfo.outputPath('broken.json')
    writeFileSync(broken, JSON.stringify({ game: {} }))
    await loadFromFile(page, broken)
    await expect(page.getByRole('alert')).toContainText('is not a scenario this game can open')
    await expect(page.locator('svg[data-board]')).toHaveCount(0)
})
