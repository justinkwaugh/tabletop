import { expect, test, type Page } from '@playwright/test'
import {
    FRENCH_ARMY,
    createGame,
    deployAllies,
    deployBothArmies,
    failOnPageErrors,
    fillCorps,
    openSeat,
    pickUp,
    placeFixedBattery,
    rearrange,
    takeFromPool,
    tap
} from './table.js'

failOnPageErrors()

function morale(page: Page, side: 'Allied' | 'French') {
    return page.getByLabel(new RegExp(`^${side} morale \\d+$`))
}

test('a threat, a retreat before combat and the move into the vacated locale', async ({ page }) => {
    await createGame(page)
    await deployBothArmies(page)
    await expect(morale(page, 'Allied')).toHaveText('27')

    const undo = page.getByRole('button', { name: 'Undo' })
    const strip = page.getByRole('group', { name: 'Langeron’s corps' })
    await pickUp(page, 'langeron')
    await expect(strip).toBeVisible()
    const units = strip.getByRole('button', { name: 'Include this unit in the command' })
    const chosen = strip.getByRole('button', {
        name: 'Include this unit in the command',
        pressed: true
    })
    const together = strip.getByRole('group', { name: 'The whole corps goes together' })
    await expect(units).toHaveCount(5)
    await expect(chosen).toHaveCount(0)
    await expect(together).toBeVisible()
    const command = (name: string) => strip.getByRole('button', { name, exact: true })
    await expect(command('Corps Move')).toHaveAttribute('aria-pressed', 'true')
    await expect(command('Detach Move')).toBeDisabled()
    await expect(command('Unit Move')).toBeDisabled()
    await units.first().click()
    await expect(chosen).toHaveCount(1)
    await expect(together).toBeHidden()
    await expect(command('Unit Move')).toHaveAttribute('aria-pressed', 'true')
    await expect(command('Detach Move')).toBeEnabled()
    await expect(command('Corps Move')).toBeEnabled()
    await undo.click()
    await expect(chosen).toHaveCount(0)
    await expect(together).toBeVisible()
    const blocks = page.locator('[data-commander="langeron"] > g')
    await blocks.first().dispatchEvent('click')
    await expect(chosen).toHaveCount(1)
    await blocks.nth(1).dispatchEvent('click')
    await expect(chosen).toHaveCount(2)
    await blocks.first().dispatchEvent('click')
    await blocks.nth(1).dispatchEvent('click')
    await expect(chosen).toHaveCount(0)
    await expect(together).toBeVisible()
    for (let i = 0; i < 5; i++) await units.nth(i).click()
    await expect(chosen).toHaveCount(0)
    await expect(together).toBeVisible()
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

test('when the defence stands the attacker is asked only to press or feint', async ({ page }) => {
    await createGame(page)
    await deployBothArmies(page)
    await pickUp(page, 'langeron')
    await tap(page, '[aria-label="Move to locale 94"]')
    await page.getByRole('button', { name: 'End turn' }).click()
    await pickUp(page, 'st-hilaire')
    await tap(page, '[aria-label="Threaten an attack across this approach"]')
    await tap(page, 'svg [aria-label="Choose this unit"]')
    await page.getByRole('button', { name: /^Defend/ }).click()

    const press = page.getByRole('button', { name: 'Press the attack' })
    const callFeint = page.getByRole('button', { name: 'Call it a feint' })
    const pieces = page.locator('button[aria-label="Choose this unit"]:not([disabled])')
    const commands = page.getByRole('group', { name: 'Command' })
    await expect(press).toBeVisible()
    await expect(pieces).toHaveCount(0)
    await expect(commands).toBeHidden()

    await callFeint.click()
    await expect(press).toBeHidden()
    await expect(pieces).toHaveCount(4)
    await expect(commands).toBeVisible()
    await expect(page.getByRole('button', { name: 'Feint, staying in reserve' })).toBeVisible()

    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(pieces).toHaveCount(0)
    await press.click()
    await expect(page.getByRole('button', { name: /^Attack/ })).toBeVisible()
    await expect(pieces).toHaveCount(4)
    await expect(commands).toBeVisible()

    const leading = pieces.filter({ hasText: 'leads' })
    const narrow = page.getByRole('button', { name: 'Narrow', exact: true })
    const detachMove = page.getByRole('button', { name: 'Detach Move' })
    await pieces.nth(3).click()
    await pieces.nth(3).click()
    await pieces.first().click()
    await expect(leading).toHaveCount(1)
    await narrow.click()
    await expect(narrow).toHaveAttribute('aria-pressed', 'true')
    await expect(leading).toHaveCount(1)
    await detachMove.click()
    await expect(detachMove).toHaveAttribute('aria-pressed', 'true')
    await expect(narrow).toHaveAttribute('aria-pressed', 'true')
    await expect(leading).toHaveCount(1)
})

test('a commander stays behind when a defender steps up, unless he is sent', async ({ page }) => {
    await createGame(page)
    await deployBothArmies(page)
    await pickUp(page, 'langeron')
    await tap(page, '[aria-label="Move to locale 94"]')
    await page.getByRole('button', { name: 'End turn' }).click()
    await pickUp(page, 'st-hilaire')
    await tap(page, '[aria-label="Threaten an attack across this approach"]')
    await tap(page, 'svg [aria-label="Choose this unit"]')
    await page.getByRole('button', { name: /^Defend/ }).click()
    await page.getByRole('button', { name: 'Call it a feint' }).click()
    await page.getByRole('button', { name: 'Feint, staying in reserve' }).click()

    const choice = page.getByRole('group', { name: 'Advance alone or with Langeron' })
    const alone = choice.getByRole('button', { name: 'Alone' })
    const withLangeron = choice.getByRole('button', { name: 'With Langeron' })
    await expect(alone).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('Going alone, it is detached from its corps.')).toBeVisible()
    await withLangeron.click()
    await expect(withLangeron).toHaveAttribute('aria-pressed', 'true')
    await expect(alone).toHaveAttribute('aria-pressed', 'false')
    await expect(
        page.getByText('joined by Langeron. The remaining units detach and remain in reserve.')
    ).toBeVisible()
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(alone).toHaveAttribute('aria-pressed', 'true')

    await page.getByRole('button', { name: 'Advance to the approach' }).click()
    const allies = page.locator('section.nt-army').filter({ hasText: 'Allied Army' })
    await expect(page.getByText('French turn')).toBeVisible()
    await expect(allies.getByText('Detached')).toBeVisible()
})

test('the pieces that made the threat are still named after the page is reloaded', async ({
    page
}) => {
    await createGame(page)
    await deployBothArmies(page)
    await pickUp(page, 'langeron')
    await tap(page, '[aria-label="Move to locale 94"]')
    await page.getByRole('button', { name: 'End turn' }).click()
    await pickUp(page, 'st-hilaire')
    await tap(page, '[aria-label="Threaten an attack across this approach"]')
    await tap(page, 'svg [aria-label="Choose this unit"]')
    await page.getByRole('button', { name: /^Defend/ }).click()
    const press = page.getByRole('button', { name: 'Press the attack' })
    await expect(press).toBeVisible()

    await page.reload()
    await page.getByRole('button', { name: 'Games' }).click()
    await page.getByRole('button', { name: 'Austerlitz' }).click()
    await press.click()
    await expect(
        page.getByText('the pieces that made the threat are named to start with')
    ).toBeVisible()
    await expect(
        page.locator('button[aria-label="Choose this unit"][aria-pressed="true"]:not([disabled])')
    ).toHaveCount(4)
    await expect(page.getByRole('button', { name: 'Corps Move' })).toHaveAttribute(
        'aria-pressed',
        'true'
    )
})

const ST_HILAIRE_LOCALE = 93
const APPROACH_FROM_ST_HILAIRE_TO_LOCALE_94 = 326

test('two artillery units on a wide approach are picked together and fire by a Unit Move each', async ({
    page
}) => {
    await createGame(page)
    await deployAllies(page)
    const withoutArtillery = (faces: string[]) => faces.filter((face) => face !== 'artillery')
    await fillCorps(page, {
        ...FRENCH_ARMY,
        davout: withoutArtillery(FRENCH_ARMY.davout),
        vandamme: withoutArtillery(FRENCH_ARMY.vandamme)
    })
    await placeFixedBattery(page)
    await openSeat(page, 'detached')
    for (let posted = 0; posted < 2; posted++) {
        await takeFromPool(page, 'artillery')
        await tap(page, `svg [data-locale="${ST_HILAIRE_LOCALE}"]`)
        await tap(page, `svg [data-approach="${APPROACH_FROM_ST_HILAIRE_TO_LOCALE_94}"]`)
    }
    await page.getByRole('button', { name: 'Deploy the army' }).click()
    await expect(page.locator('.nt-setup')).toHaveCount(0)

    await pickUp(page, 'langeron')
    await tap(page, '[aria-label="Move to locale 94"]')
    await page.getByRole('button', { name: 'End turn' }).click()

    const batteries = page
        .locator('[data-commander="detached"][aria-label="Select these pieces"]')
        .filter({ has: page.locator('g:nth-of-type(2)') })
    await batteries.dispatchEvent('click')
    const strip = page.getByRole('group', { name: 'Detached units' })
    const units = strip.getByRole('button', { name: 'Include this unit in the command' })
    const chosen = strip.getByRole('button', {
        name: 'Include this unit in the command',
        pressed: true
    })
    const unitMove = strip.getByRole('button', { name: 'Unit Move', exact: true })
    const threat = page.locator('[aria-label="Threaten an attack across this approach"]')
    await expect(units).toHaveCount(2)
    await expect(chosen).toHaveCount(1)
    await expect(threat).toHaveCount(1)

    await strip
        .getByRole('button', { name: 'Include this unit in the command', pressed: false })
        .click()
    await expect(chosen).toHaveCount(2)
    await expect(unitMove).toHaveAttribute('aria-pressed', 'true')
    await expect(strip).toContainText('The two fire together')
    await expect(page.locator('[aria-label^="Move to"]')).toHaveCount(0)
    await expect(threat).toHaveCount(1)

    await tap(page, '[aria-label="Threaten an attack across this approach"]')
    await tap(page, 'svg [aria-label="Choose this unit"]')
    await page.getByRole('button', { name: /^Defend/ }).click()
    await page.getByRole('button', { name: 'Press the attack' }).click()

    const pieces = page.locator('button[aria-label="Choose this unit"]:not([disabled])')
    const attack = page.getByRole('button', { name: /^Attack/ })
    await expect(pieces.filter({ hasText: 'attacks' })).toHaveCount(2)
    await pieces.nth(0).click()
    await pieces.nth(1).click()
    await expect(pieces.filter({ hasText: 'leads' })).toHaveCount(2)
    await expect(
        page.getByRole('group', { name: 'Command' }).getByRole('button', { name: 'Unit Move' })
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(attack).toBeEnabled()
    await attack.click()
    await expect(attack).toBeHidden()
})

test('a stack closed up for want of room spreads out when tapped, and when picked up', async ({
    page
}) => {
    await createGame(page)
    await deployBothArmies(page)
    await rearrange(page, (state) => {
        const crowded = { locale: 110 }
        for (const unit of state.units.filter((unit) => unit.commanderId === 'langeron')) {
            unit.position = crowded
        }
        for (const commander of state.commanders.filter((entry) => entry.id === 'langeron')) {
            commander.position = crowded
        }
    })
    const stack = page.locator('[data-commander="langeron"]')
    // Measured on the board, not on screen: picking a corps up can move and zoom the view, and the board may be turned.
    const extent = () =>
        stack.evaluate((group) => {
            const box = group instanceof SVGGraphicsElement ? group.getBBox() : undefined
            return box ? Math.round(box.width + box.height) : 0
        })

    await expect(stack).toHaveAttribute('aria-label', 'Select these pieces')
    const closedUp = await extent()
    await pickUp(page, 'langeron')
    await expect.poll(extent).toBeGreaterThan(closedUp + 10)
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect.poll(extent).toBe(closedUp)

    await page.getByRole('button', { name: 'End turn' }).click()
    await expect(stack).toHaveAttribute('aria-label', 'Spread these pieces out')
    const closedUpForTheFrench = await extent()
    await stack.click()
    await expect(stack).toHaveAttribute('aria-label', 'Close these pieces up')
    await expect.poll(extent).toBeGreaterThan(closedUpForTheFrench + 10)
    await stack.click()
    await expect(stack).toHaveAttribute('aria-label', 'Spread these pieces out')
    await expect.poll(extent).toBe(closedUpForTheFrench)
})

test('the attacker sees the defenders named at the end of their stack nearest the approach, whichever they are', async ({
    page
}) => {
    await createGame(page)
    await deployBothArmies(page)
    await pickUp(page, 'langeron')
    await tap(page, '[aria-label="Move to locale 94"]')
    await page.getByRole('button', { name: 'End turn' }).click()
    await pickUp(page, 'st-hilaire')
    await tap(page, '[aria-label="Threaten an attack across this approach"]')
    const choices = page.locator('svg [aria-label="Choose this unit"]')
    await choices.first().dispatchEvent('click')
    await choices.last().dispatchEvent('click')
    await page.getByRole('button', { name: /^Defend/ }).click()
    await expect(page.locator('.nt-masthead-turn')).toHaveText('French turn')

    const stack = await page.evaluate(() => {
        const centreOf = (element: Element) => {
            const box = element.getBoundingClientRect()
            return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
        }
        const arrow = document.querySelector('svg[data-board] [data-attack-arrow]')
        const blocks = document.querySelectorAll('svg[data-board] [data-commander="langeron"] > g')
        if (!arrow) {
            return []
        }
        const at = centreOf(arrow)
        return [...blocks]
            .map((block) => {
                const centre = centreOf(block)
                return {
                    named: block.querySelector('text')?.textContent === 'D',
                    fromTheApproach: Math.hypot(centre.x - at.x, centre.y - at.y)
                }
            })
            .toSorted((a, b) => a.fromTheApproach - b.fromTheApproach)
    })
    expect(stack.map((block) => block.named)).toEqual([true, true, false, false, false])
})
