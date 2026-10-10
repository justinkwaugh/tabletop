import { expect, test, type Page } from '@playwright/test'

const pageErrors = new WeakMap<Page, string[]>()

test.beforeEach(({ page }) => {
    const errors: string[] = []
    pageErrors.set(page, errors)
    page.on('pageerror', (error) => errors.push(error.message))
})

test.afterEach(({ page }) => {
    expect(pageErrors.get(page)).toEqual([])
})

async function createGame(page: Page) {
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

async function deployBothArmies(page: Page) {
    const deploy = page.getByRole('button', { name: 'Deploy the army' })
    await deploy.click()
    await expect(page.locator('[data-commander="langeron"]')).toBeVisible()
    await deploy.click()
    await expect(page.locator('[data-commander="st-hilaire"]')).toBeVisible()
}

function morale(page: Page, side: 'Allied' | 'French') {
    return page.getByLabel(new RegExp(`^${side} morale \\d+$`))
}

/** Board pieces and targets are small SVG shapes that sit under one another's hit areas, so they are clicked directly. */
async function tap(page: Page, selector: string) {
    await page.locator(selector).first().dispatchEvent('click')
}

test('a threat, a retreat before combat and the move into the vacated locale', async ({ page }) => {
    await createGame(page)
    await deployBothArmies(page)
    await expect(morale(page, 'Allied')).toHaveText('27')

    await tap(page, '[data-commander="langeron"]')
    await expect(page.getByRole('group', { name: 'Langeron’s corps' })).toBeVisible()
    await tap(page, '[aria-label="Move to locale 94"]')
    await page.getByRole('button', { name: 'End turn' }).click()

    await tap(page, '[data-commander="st-hilaire"]')
    await tap(page, '[aria-label="Threaten an attack across this approach"]')
    await expect(page.getByText('Attack from locale 93 into locale 94')).toBeVisible()

    const defend = page.getByRole('button', { name: /^Defend/ })
    await expect(defend).toBeDisabled()
    await tap(page, 'svg [aria-label="Choose this unit"]')
    await expect(defend).toBeEnabled()
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(defend).toBeDisabled()

    await page.getByRole('button', { name: 'Retreat before combat' }).click()
    await expect(page.locator('[aria-label^="Retreat to"]').first()).toBeVisible()
    await page.getByRole('button', { name: 'Retreat', exact: true }).click()
    await expect(morale(page, 'Allied')).toHaveText('25')

    await page.getByRole('button', { name: 'Move into the locale' }).click()
    await expect(page.getByText('Attack from locale 93 into locale 94')).toBeHidden()
    await expect(page.getByRole('button', { name: 'End turn' })).toBeVisible()
    await expect(morale(page, 'French')).toHaveText('23')
})
