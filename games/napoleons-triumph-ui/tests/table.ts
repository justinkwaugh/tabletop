import { expect, test, type Page } from '@playwright/test'

export function failOnPageErrors() {
    const pageErrors = new WeakMap<Page, string[]>()

    test.beforeEach(({ page }) => {
        const errors: string[] = []
        pageErrors.set(page, errors)
        page.on('pageerror', (error) => errors.push(error.message))
    })

    test.afterEach(({ page }) => {
        expect(pageErrors.get(page)).toEqual([])
    })
}

export async function createGame(page: Page) {
    await page.goto('/')
    await page.getByRole('button', { name: 'New game', exact: true }).click()
    await page.getByPlaceholder('choose a name for your game').fill('Austerlitz')
    await page
        .getByPlaceholder('optional reproduction seed')
        .fill('0123456789abcdef0123456789abcdef')
    const names = page.getByPlaceholder('player name')
    for (let i = 1; i < (await names.count()); i++) await names.nth(i).fill(`Player ${i + 1}`)
    await page.getByRole('button', { name: 'Create Game', exact: true }).click()
}

export async function deployBothArmies(page: Page) {
    const deploy = page.getByRole('button', { name: 'Deploy the army' })
    await deploy.click()
    await expect(page.locator('[data-commander="langeron"]')).toBeVisible()
    await deploy.click()
    await expect(page.locator('[data-commander="st-hilaire"]')).toBeVisible()
}

// Workaround: blocks and targets are small SVG shapes under one another's hit areas, so they are clicked directly.
export async function tap(page: Page, selector: string) {
    await page.locator(selector).first().dispatchEvent('click')
}

// Pieces carry role="button" only while the session takes choices, so Playwright waits out an action or Undo still settling.
export async function pickUp(page: Page, commander: string) {
    await tap(page, `[data-commander="${commander}"][role="button"]`)
}
