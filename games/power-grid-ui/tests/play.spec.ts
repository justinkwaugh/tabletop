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

async function openScenario(page: Page, name: string) {
    await page.goto('/')
    await page.getByRole('button', { name: 'Scenarios' }).click()
    await page.getByText(name, { exact: true }).click()
    await expect(page.getByText('Your turn', { exact: true }).first()).toBeVisible()
}

async function newGame(page: Page) {
    await page.goto('/')
    await page.getByRole('button', { name: 'New game', exact: true }).click()
    await page.getByPlaceholder('choose a name for your game').fill('First auction')
    await page
        .getByPlaceholder('optional reproduction seed')
        .fill('0123456789abcdef0123456789abcdef')
    await page.getByRole('radio', { name: '3', exact: true }).check({ force: true })
    const names = page.getByPlaceholder('player name')
    for (let i = 1; i < (await names.count()); i++) await names.nth(i).fill(`Player ${i + 1}`)
    await page.getByRole('button', { name: 'Create Game', exact: true }).click()
}

const choosablePlants = (page: Page) => page.locator('button.card.targetable')
const actionArea = (page: Page) => page.locator('.action-area')

test('every player buys a plant in the first auction phase', async ({ page }) => {
    await newGame(page)
    for (let player = 0; player < 3; player++) {
        await expect(actionArea(page)).toContainText('Choose a power plant')
        await choosablePlants(page).first().click()
        await actionArea(page)
            .getByRole('button', { name: /^(Bid|Buy for)/ })
            .click()
        await page.waitForTimeout(400)
        while (
            await actionArea(page).getByRole('button', { name: 'Pass', exact: true }).isVisible()
        ) {
            await actionArea(page).getByRole('button', { name: 'Pass', exact: true }).click()
            await page.waitForTimeout(400)
        }
    }
    await expect(actionArea(page).getByRole('button', { name: 'Buy nothing' })).toBeVisible()
})

test('Undo steps back through the chosen cities before any action', async ({ page }) => {
    await openScenario(page, 'Building')
    const targets = page.locator('g[role=button][aria-label^="Build in"][tabindex="0"]')
    await targets.first().click()
    await expect(actionArea(page).getByRole('button', { name: /^Build 1 city/ })).toBeVisible()
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(actionArea(page).getByRole('button', { name: 'Build nothing' })).toBeVisible()
})

test('a purchase fills the cart and is paid for', async ({ page }) => {
    await openScenario(page, 'Buying resources')
    const row = page.locator('g[role=button][aria-label^="Buy"][aria-disabled="false"]').first()
    await row.click()
    const buy = actionArea(page).getByRole('button', { name: /^Buy for/ })
    await expect(buy).toBeVisible()
    await buy.click()
    await expect(actionArea(page)).not.toContainText('Buy for')
})

test('Undo takes back a raised bid, then the chosen plant', async ({ page }) => {
    await openScenario(page, 'Round 2 auction')
    await choosablePlants(page).first().click()
    const bid = actionArea(page).getByRole('button', { name: /^Bid/ })
    const opening = await bid.textContent()
    await actionArea(page).getByRole('group', { name: 'Opening bid' }).getByLabel('More').click()
    await expect(bid).not.toHaveText(opening ?? '')
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(bid).toHaveText(opening ?? '')
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(actionArea(page)).toContainText('Choose a power plant')
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toHaveCount(0)
})
