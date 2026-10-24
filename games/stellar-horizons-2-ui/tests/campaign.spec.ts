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
    // Each Player keeps the first directive they drew, the harness passing to the next.
    const drawn = page.getByRole('group', { name: 'Directives drawn' }).getByRole('button')
    for (let player = 1; player < 3; player++) {
        await drawn.first().click()
        await expect(page.locator('[title$=" has finished"]')).toHaveCount(player)
    }
    await drawn.first().click()
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
    await page.getByRole('button', { name: "Sell goods at Barnard's Star" }).click({ force: true })
    await expect(page.getByText('Pays Player 2 $1B')).toBeVisible()
    await page.getByRole('button', { name: 'Sell 1 for $6B' }).click()
    await expect(page.getByText("Barnard's Star gets a demand marker")).toBeVisible()
    await page
        .getByRole('button', { name: /^Keep .* demand$/ })
        .first()
        .click()
    await expect(page.getByText('You have goods to sell where there is demand')).toBeVisible()
})

test('reward goods are placed in the zoomed system, which can be left and reopened', async ({
    page
}) => {
    await openScenario(page, 'Campaign reward goods')
    await expect(page.getByRole('heading', { name: 'Alpha Centauri' })).toBeVisible()
    await page.getByRole('button', { name: 'Put Fauna here' }).click()
    await expect(page.getByRole('button', { name: 'Put Fauna here' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Back to map' }).click()
    await expect(page.getByRole('heading', { name: 'Alpha Centauri' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Place Fauna at Alpha Centauri' }).click({ force: true })
    await page.getByRole('button', { name: 'Andromeda', exact: true }).click()
    await page.getByRole('button', { name: 'Place Fauna', exact: true }).click()
    await expect(page.getByText('Goods').first()).toBeVisible()
    await expect(page.getByText('2 of 12')).toBeVisible()
})

test('a blockade chosen on the map names its bases, then halves their production', async ({
    page
}) => {
    await openScenario(page, 'Campaign blockade')
    await page.getByRole('button', { name: 'Blockade at Alpha Centauri' }).click({ force: true })
    const targets = page.locator('.sh-step button.target')
    await targets.first().click()
    await expect(page.getByText(/Your ships: 14 against [46]$/)).toBeVisible()
    await targets.nth(1).click()
    await expect(page.getByText('Your ships: 14 against 10')).toBeVisible()
    // Undo takes back the last base named, then the system.
    await page.getByRole('button', { name: 'UNDO' }).click()
    await expect(targets).toHaveCount(2)
    await targets.nth(1).click()
    await page.getByRole('button', { name: 'Blockade 2 bases' }).click()
    await expect(page.getByText(/^Blockaded by/)).toBeVisible()
})

test('the escalation markers to keep are chosen before declaring initiative', async ({ page }) => {
    await openScenario(page, 'Campaign escalation discard')
    const declare = page.getByRole('button', { name: 'No IP' })
    await expect(declare).toBeDisabled()
    await page.getByRole('button', { name: '4 VP' }).click()
    await expect(declare).toBeDisabled()
    await page.getByRole('button', { name: 'Earth Production +1 Eng Marker' }).click()
    await expect(declare).toBeEnabled()
    await declare.click()
    await expect(page.locator('[title="Player 1 has finished"]')).toBeVisible()
})

test('an assault is declared, answered and its hits placed from the combat panel', async ({
    page
}) => {
    await openScenario(page, 'Campaign assault')
    await page.getByRole('button', { name: 'Attack at Luhman 16' }).click({ force: true })
    const step = page.locator('.sh-step')
    const assault = step.getByRole('button', { name: /^Planetary assault/ })
    await assault.click()
    const declare = step.getByRole('button', { name: 'Planetary assault', exact: true })
    await expect(declare).toBeDisabled()
    await step.getByRole('button', { name: /^Odyssey/ }).click()
    await step.getByRole('button', { name: /^Gladiator/ }).click()
    await expect(declare).toBeEnabled()
    // Undo takes back a ship at a time, then the kind of combat and the system, undoing no action.
    const undo = page.getByRole('button', { name: 'UNDO' })
    await undo.click()
    await expect(step.getByRole('button', { name: /^Gladiator/ })).toHaveAttribute(
        'aria-pressed',
        'false'
    )
    await expect(declare).toBeEnabled()
    await undo.click()
    await expect(declare).toBeDisabled()
    await undo.click()
    await expect(declare).toHaveCount(0)
    await expect(assault).toHaveAttribute('aria-pressed', 'false')
    await undo.click()
    await expect(assault).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Attack at Luhman 16' })).toBeAttached()
    await page.getByRole('button', { name: 'Attack at Luhman 16' }).click({ force: true })
    await assault.click()
    await step.getByRole('button', { name: /^Odyssey/ }).click()
    await step.getByRole('button', { name: /^Gladiator/ }).click()
    await declare.click()
    // The Givers answer: the defence and the combat panel beside the map.
    const panel = page.getByRole('complementary', { name: 'Combat at Luhman 16' })
    await expect(panel).toBeVisible()
    await step.getByRole('button', { name: /^Guildmaster/ }).click()
    await step.getByRole('button', { name: /^Sapphire/ }).click()
    await step.getByRole('button', { name: 'Defend with 2 ships' }).click()
    // The Player Guide's 14 against 11, each modifier named; the dice are set only to leave hits
    // to choose on both sides.
    await expect(
        panel.getByText(
            /^Rolled \d+ \+ 0\.2 \(CVs\) \+ 0\.3 \(settlements\) \+ 1 \(The Praetorians\) \+ 1 \(Military Academy\) = \d+ · combat value 14/
        )
    ).toBeVisible()
    await expect(
        panel.getByText(/^Rolled \d+ \+ 0\.3 \(CVs\) = \d+ · combat value 11/)
    ).toBeVisible()
    // The Givers' hits land on the Praetorians' units first, the Praetorians choosing first.
    // Hits that leave no choice may follow it, so the count only has to move on.
    const left = panel.getByText(/hits? left on these units/)
    const before = await left.innerText()
    await panel.locator('.unit.target').first().click()
    await expect(left).not.toHaveText(before)
})

test('a directive is kept from those drawn at the start, and shown on the console', async ({
    page
}) => {
    await openScenario(page, 'Campaign directive choice')
    const drawn = page.getByRole('group', { name: 'Directives drawn' }).getByRole('button')
    await expect(drawn).toHaveCount(3)
    await expect(page.getByText(/^Your goal: \d directives/)).toBeVisible()
    await drawn.first().click()
    await expect(page.locator('[title="Player 1 has finished"]')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Keep directive' })).toHaveCount(0)
    await expect(page.locator('.console h4', { hasText: 'Directives' })).toBeVisible()
})

test('a title is earned by selling on Earth and bought at once on the Main Line', async ({
    page
}) => {
    await openScenario(page, 'Campaign title guildmaster')
    const guildmaster = page.getByRole('group', { name: 'Guildmaster' })
    await expect(guildmaster.getByRole('button', { name: /^Buy/ })).toHaveCount(0)
    await page.getByRole('button', { name: 'Sell goods at Sol' }).click({ force: true })
    await page.getByRole('button', { name: /^Sell 3 for/ }).click()
    await guildmaster.getByRole('button', { name: 'Buy · 9 IP' }).click()
    // Owned now, it offers Renounce; a replacement is laid out in its place.
    await expect(guildmaster.getByRole('button', { name: 'Renounce' })).toBeVisible()
})
