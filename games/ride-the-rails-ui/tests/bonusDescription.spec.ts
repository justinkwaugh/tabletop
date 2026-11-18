import { expect, test, type Locator, type Page } from '@playwright/test'
import { collectPageErrors, litHex, openScenario, pressHex, settled } from './helpers.js'

// R-4.3.3, R-8: the bonus chip in the turn line explains its bonus when pressed: its name and
// amount, the rule, the cities it names, and whether it is open or who claimed it. A second press,
// a press outside or Escape closes it; it takes no game action. Desktop 1440 × 900, phone 390 × 844.
collectPageErrors()

function onPhone(): boolean {
    return test.info().project.use.hasTouch === true
}

async function open(page: Page, scenario: string) {
    await page.setViewportSize(
        onPhone() ? { width: 390, height: 844 } : { width: 1440, height: 900 }
    )
    await openScenario(page, scenario)
}

async function press(target: Locator) {
    if (onPhone()) await target.tap()
    else await target.click()
}

/** The description the chip controls. */
async function descriptionOf(page: Page, chip: Locator): Promise<Locator> {
    const id = await chip.getAttribute('aria-controls')
    expect(id).toBeTruthy()
    return page.locator(`[id="${id}"]`)
}

async function expectOnScreen(page: Page, description: Locator) {
    await expect(description).toBeVisible()
    const box = await description.boundingBox()
    const view = page.viewportSize()
    expect(box && view).toBeTruthy()
    if (!box || !view) return
    const gutter = onPhone() ? 16 : 0
    expect(box.x).toBeGreaterThanOrEqual(gutter - 0.5)
    expect(box.x + box.width).toBeLessThanOrEqual(view.width - gutter + 0.5)
    expect(box.y + box.height).toBeLessThanOrEqual(view.height)
}

const CASES = [
    {
        scenario: 'Germany link in reach',
        chip: /^Greater Germany: /,
        texts: [
            'Greater Germany',
            '$12 to the first player whose placement connects Berlin, Hamburg, Köln, Dresden and ' +
                'München through complete links of any railroads, changing railroad only in ' +
                'cities. Paid once.',
            'Open: the gold rings on the board mark its cities.'
        ]
    },
    {
        scenario: 'Transcontinental in reach',
        chip: /^Transcontinental: /,
        texts: [
            'Transcontinental',
            'from a West Coast city to an East Coast city on two or more railroads',
            'West Coast: Seattle, Portland (Oregon), San Francisco and Los Angeles.',
            'East Coast: New York, Philadelphia, Baltimore, Washington, Charleston and Jacksonville.',
            'Open: while you build, a hex that would complete a line shows $12 or $8.'
        ]
    }
] as const

for (const bonus of CASES) {
    test(`${bonus.scenario}: pressing the bonus chip explains its rule`, async ({ page }) => {
        await open(page, bonus.scenario)
        const chip = page.getByRole('button', { name: bonus.chip })
        await expect(chip).toBeInViewport()
        await expect(chip).toHaveAttribute('aria-expanded', 'false')
        const description = await descriptionOf(page, chip)
        await expect(description).toHaveCount(0)
        const actions = await page.evaluate(() => window.rtrSession.actions.length)

        // A press opens it beside the chip, with the rule, its cities and its state.
        await press(chip)
        await expect(chip).toHaveAttribute('aria-expanded', 'true')
        await expectOnScreen(page, description)
        for (const text of bonus.texts) await expect(description).toContainText(text)
        await expect(chip).toHaveAccessibleDescription(new RegExp(`^${bonus.texts[0]}`))
        // A second press closes it.
        await press(chip)
        await expect(description).toHaveCount(0)
        await expect(chip).toHaveAttribute('aria-expanded', 'false')

        // Escape closes it, and the keyboard opens it.
        await chip.focus()
        await page.keyboard.press('Enter')
        await expect(description).toBeVisible()
        await page.keyboard.press('Escape')
        await expect(description).toHaveCount(0)
        await expect(chip).toBeFocused()

        // A press outside closes it.
        await press(chip)
        await expect(description).toBeVisible()
        await press(page.locator('[data-turn-whose]'))
        await expect(description).toHaveCount(0)

        // Only looking: no action was taken.
        expect(await page.evaluate(() => window.rtrSession.actions.length)).toBe(actions)
    })
}

test('The claimed Transcontinental names its claimant and holds the line’s toggle', async ({
    page
}) => {
    await open(page, 'Transcontinental in reach')
    const chip = page.getByRole('button', { name: /^Transcontinental: / })
    const description = await descriptionOf(page, chip)
    // Open while a building offer opens for the seat: a press on the board closes it.
    await press(chip)
    await expect(description).toBeVisible()
    await pressHex(page, litHex(page, 'Denver: place Purple, $12 Transcontinental'))
    await settled(page)
    await expect(description).toHaveCount(0)
    await expect(chip).toHaveAccessibleName('Transcontinental: claimed by Ada for $12')

    await press(chip)
    await expect(description).toContainText('Claimed by Ada for $12.')
    const toggle = description.getByRole('button', { name: 'Show the Transcontinental line' })
    await press(toggle)
    // The toggle is inside the description, so it stays open.
    await expect(
        description.getByRole('button', { name: 'Hide the Transcontinental line' })
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(description).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(description).toHaveCount(0)
    await expect(chip).toBeFocused()
})
