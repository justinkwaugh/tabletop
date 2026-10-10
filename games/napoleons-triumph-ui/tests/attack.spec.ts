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

// Workaround: blocks and targets are small SVG shapes under one another's hit areas, so they are clicked directly.
async function tap(page: Page, selector: string) {
    await page.locator(selector).first().dispatchEvent('click')
}

// Pieces are offered as buttons only while the session takes choices, so this waits out an action or Undo still settling.
async function pickUp(page: Page, commander: string) {
    await tap(page, `[data-commander="${commander}"][role="button"]`)
}

test('a threat, a retreat before combat and the move into the vacated locale', async ({ page }) => {
    await createGame(page)
    await deployBothArmies(page)
    await expect(morale(page, 'Allied')).toHaveText('27')

    const undo = page.getByRole('button', { name: 'Undo' })
    const strip = page.getByRole('group', { name: 'Langeron’s corps' })
    await pickUp(page, 'langeron')
    await expect(strip).toBeVisible()
    const included = strip.getByRole('button', {
        name: 'Include this unit in the command',
        pressed: true
    })
    await expect(included).toHaveCount(5)
    await included.first().click()
    await expect(included).toHaveCount(4)
    await undo.click()
    await expect(included).toHaveCount(5)
    await undo.click()
    await expect(strip).toBeHidden()

    const moved = page.getByText('locale 94', { exact: true })
    await pickUp(page, 'langeron')
    await tap(page, '[aria-label="Move to locale 94"]')
    await expect(moved).toHaveCount(1)
    await undo.click()
    await expect(moved).toHaveCount(0)
    await pickUp(page, 'langeron')
    await tap(page, '[aria-label="Move to locale 94"]')
    await expect(moved).toHaveCount(1)
    await page.getByRole('button', { name: 'End turn' }).click()

    await pickUp(page, 'st-hilaire')
    await tap(page, '[aria-label="Threaten an attack across this approach"]')
    await expect(page.getByText('Attack from locale 93 into locale 94')).toBeVisible()

    const defend = page.getByRole('button', { name: /^Defend/ })
    await expect(defend).toBeDisabled()
    await tap(page, 'svg [aria-label="Choose this unit"]')
    await expect(defend).toBeEnabled()
    await undo.click()
    await expect(defend).toBeDisabled()

    const giveGround = page.getByRole('button', { name: 'Retreat before combat' })
    await giveGround.click()
    await expect(page.locator('[aria-label^="Retreat to"]').first()).toBeVisible()
    await undo.click()
    await expect(defend).toBeVisible()
    await giveGround.click()
    await page.getByRole('button', { name: 'Retreat', exact: true }).click()
    await expect(morale(page, 'Allied')).toHaveText('25')

    await page.getByRole('button', { name: 'Move into the locale' }).click()
    await expect(page.getByText('Attack from locale 93 into locale 94')).toBeHidden()
    await expect(page.getByRole('button', { name: 'End turn' })).toBeVisible()
    await expect(morale(page, 'French')).toHaveText('23')
})

test('cavalry that rides in by road stays picked up, riding on', async ({ page }) => {
    await createGame(page)
    await deployBothArmies(page)
    await pickUp(page, 'langeron')
    await tap(page, '[aria-label="Move to locale 94"]')
    await page.getByRole('button', { name: 'End turn' }).click()
    await pickUp(page, 'st-hilaire')
    await tap(page, '[aria-label="Threaten an attack across this approach"]')
    await page.getByRole('button', { name: 'Retreat before combat' }).click()
    await page.getByRole('button', { name: 'Retreat', exact: true }).click()

    const moveIn = page.getByRole('button', { name: 'Move into the locale' })
    const rideIn = page.getByRole('button', { name: 'Ride in by road' })
    await expect(moveIn).toBeEnabled()
    await expect(rideIn).toBeHidden()

    const tiles = page.locator('button[aria-label="Choose this unit"]')
    const count = await tiles.count()
    for (let i = 0; i < count; i++) await tiles.nth(i).click()
    for (let i = 0; i < count && !(await rideIn.isVisible()); i++) {
        if (i > 0) await tiles.nth(i - 1).click()
        await tiles.nth(i).click()
    }
    await rideIn.click()

    const riding = page.getByRole('group', { name: /riding on$/ })
    await expect(riding).toBeVisible()
    await expect(
        page.getByText('The cavalry may ride on along its road, or threaten again.')
    ).toBeVisible()
    await expect(page.locator('[aria-label^="March by road to"]').first()).toBeVisible()

    await pickUp(page, 'vandamme')
    await expect(page.getByRole('group', { name: 'Vandamme’s corps' })).toBeVisible()
    await expect(riding).toBeHidden()
    const undo = page.getByRole('button', { name: 'Undo' })
    await undo.click()
    await expect(riding).toBeVisible()

    await undo.click()
    await expect(riding).toBeHidden()
    await expect(moveIn).toBeEnabled()
})
