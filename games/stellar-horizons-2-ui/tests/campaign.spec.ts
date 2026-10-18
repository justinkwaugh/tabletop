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

async function createCampaign(page: Page) {
    await page.goto('/')
    await page.getByRole('button', { name: 'New game', exact: true }).click()
    await page.getByPlaceholder('choose a name for your game').fill('Campaign')
    await page.locator('select#scenario').selectOption('Campaign')
    await page
        .getByPlaceholder('optional reproduction seed')
        .fill('0123456789abcdef0123456789abcdef')
    const names = page.getByPlaceholder('player name')
    for (let i = 1; i < (await names.count()); i++) await names.nth(i).fill(`Player ${i + 1}`)
    await page.getByRole('button', { name: 'Create Game', exact: true }).click()
    for (const faction of ['The Starfarers', 'The Givers', 'The Praetorians']) {
        await page.getByRole('button', { name: new RegExp(`^${faction}`) }).click()
    }
}

test('a campaign opens in the exploration phase of 2100 with IP and victory points', async ({
    page
}) => {
    await createCampaign(page)
    await expect(page.getByText('DECADE 2100')).toBeVisible()
    await expect(page.getByText('EVEN DECADE')).toHaveCount(0)
    const phases = page.getByRole('list', { name: 'Phases of the decade' })
    await expect(phases.getByRole('listitem')).toHaveText([/Exploration$/, /Develop techs$/])
    const standings = page.locator('.standings')
    await expect(standings.getByText('IP', { exact: true })).toBeVisible()
    await expect(standings.getByText('VP', { exact: true })).toBeVisible()
    await expect(page.locator('.console .sheet')).toContainText('Ships 5 of 5')
})

test('the economic phase of 2110 leads the phases with its tile', async ({ page }) => {
    await createCampaign(page)
    for (let ending = 0; ending < 6; ending++) {
        const done = page.getByRole('button', { name: /^Done (exploring|developing)$/ })
        if (!(await done.isVisible())) break
        await done.click()
    }
    await expect(page.getByText('DECADE 2110')).toBeVisible()
    const first = page
        .getByRole('list', { name: 'Phases of the decade' })
        .getByRole('listitem')
        .first()
    await expect(first).toHaveAttribute('title', /^Economic phase: /)
})

async function openScenario(page: Page, name: string) {
    await page.goto('/')
    await page.getByRole('button', { name: 'Scenarios' }).click()
    await page.getByText(name, { exact: true }).click()
}

test('drawn goods are assigned on the map, one at a time', async ({ page }) => {
    await openScenario(page, 'Campaign trade goods')
    await page
        .getByRole('button', { name: 'Assign Food to your base at Alpha Centauri' })
        .click({ force: true })
    // Alpha Centauri has taken its one good this turn and no other base has an A, D or K world.
    await expect(page.locator('[aria-label^="Assign Ore"]')).toHaveCount(0)
    await expect(page.getByText('Ore has nowhere to go')).toBeVisible()
    await page.getByRole('button', { name: 'Discard Ore for $1B' }).click()
    await page
        .getByRole('button', { name: 'Assign Fine Art to your base at Luhman 16' })
        .click({ force: true })
    await page.getByRole('button', { name: 'Assign goods, $1B for the rest' }).click()
    // The Branch is played; the next Player assigns theirs, and the first is shown as done.
    await expect(page.locator('[title="Player 1 has finished"]')).toBeVisible()
})

test('a sale beside another base pays its owner, then a new demand marker is chosen', async ({
    page
}) => {
    await openScenario(page, 'Campaign trading')
    await page.getByRole('button', { name: /Fauna at Barnard's Star/ }).click()
    await expect(page.getByText('Pays Player 2 $1B')).toBeVisible()
    await page.getByRole('button', { name: 'Sell 1 for $6B' }).click()
    await expect(page.getByText("Barnard's Star gets a demand marker")).toBeVisible()
    await page
        .getByRole('button', { name: /^Keep .* demand$/ })
        .first()
        .click()
    await expect(page.getByText('Sell goods where there is demand')).toBeVisible()
})
