import { expect, test, type Locator, type Page } from '@playwright/test'
import {
    createGame,
    deployAllies,
    deployBothArmies,
    failOnPageErrors,
    fillCorps,
    FRENCH_ARMY,
    leadButton,
    leadDefence,
    openSeat,
    pickUp,
    retreat,
    placeFixedBattery,
    rearrange,
    takeFromPool,
    tap,
    threatenWithoutTheGuard
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
    await threatenWithoutTheGuard(page)
    await expect(page.getByText('Attack from locale 93 into locale 94')).toBeVisible()

    const defend = page.getByRole('button', { name: /^Defend/ })
    await expect(defend).toBeDisabled()
    await tap(page, 'svg [aria-label="Choose this unit"]')
    await expect(defend).toBeEnabled()
    await undo.click()
    await expect(defend).toBeDisabled()

    const giveGround = page.getByRole('button', { name: 'Retreat before combat' })
    const takeLosses = page.getByRole('button', { name: 'Take these losses' })
    const places = page.locator('[aria-label^="Retreat to"]')
    await giveGround.click()
    await expect(takeLosses).toBeVisible()
    await expect(places).toHaveCount(0)
    await undo.click()
    await expect(defend).toBeVisible()
    await giveGround.click()
    const tiles = page.locator(
        'button[aria-label="Move a step of the loss onto this unit"]:not([disabled])'
    )
    const lossesShown = () => page.locator('.nt-turn svg text').allTextContents()
    const arranged = await lossesShown()
    expect(arranged.length).toBeGreaterThan(0)
    for (let tile = 0; tile < (await tiles.count()); tile++) {
        await tiles.nth(tile).click()
        await tiles.nth(tile).click()
        await tiles.nth(tile).click()
    }
    const total = (marks: string[]) => marks.reduce((sum, mark) => sum + Number(mark.slice(1)), 0)
    expect(total(await lossesShown())).toBe(total(arranged))
    await page.getByRole('button', { name: /^The retreat costs \d+ steps?$/ }).click()
    const retreatCost = page.getByRole('dialog', { name: 'What the retreat costs' })
    await expect(retreatCost.getByText(/^Infantry in reserve/)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(retreatCost).toBeHidden()

    await takeLosses.click()
    const rows = page.locator('.nt-retreat-to').filter({ hasText: /^\s*To / })
    const retreating = page.locator(
        '.nt-retreat-units button[aria-label="Choose this unit"]:not([disabled])'
    )
    const flag = page.locator('[data-commander-chip="langeron"]')
    const holdsTheFlag = (unit: Locator) => unit.locator('xpath=..').locator(flag)
    await expect(places.first()).toBeVisible()
    await expect(rows).toHaveCount(1)
    await expect(holdsTheFlag(retreating.first())).toHaveCount(1)

    const held = page.getByText('Now tap the locale this unit goes to.')
    await retreating.last().click()
    await expect(held).toBeVisible()
    await undo.click()
    await expect(held).toBeHidden()
    await expect(takeLosses).toBeHidden()
    await retreating.last().click()
    const firstPlace = (await rows.first().innerText()).replace(/^To /, '').trim()
    await tap(page, `[aria-label^="Retreat to"]:not([aria-label="Retreat to ${firstPlace}"])`)
    await expect(rows).toHaveCount(2)

    await flag.click()
    await expect(page.getByText('Now tap the unit Langeron stays with.')).toBeVisible()
    await expect(places).toHaveCount(0)
    await retreating.nth(1).click()
    await expect(places.first()).toBeVisible()
    await expect(holdsTheFlag(retreating.nth(1))).toHaveCount(1)
    await expect(holdsTheFlag(retreating.first())).toHaveCount(0)

    await undo.click()
    await expect(takeLosses).toBeVisible()
    await takeLosses.click()
    await expect(rows).toHaveCount(1)
    await retreat(page)
    await expect(morale(page, 'Allied')).toHaveText('25')

    await page.getByRole('button', { name: 'Move into the locale' }).click()
    await expect(page.getByText('The attack is over.')).toBeVisible()
    await expect(
        page.getByText(
            /The Allies fell back to .+ before the attack, and the French moved into locale 94\./
        )
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'End turn' })).toBeHidden()
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
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
    await threatenWithoutTheGuard(page)
    await page.getByRole('button', { name: 'Retreat before combat' }).click()
    await retreat(page)

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
    await threatenWithoutTheGuard(page)
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
    await leadDefence(page)
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
    await threatenWithoutTheGuard(page)
    await tap(page, 'svg [aria-label="Choose this unit"]')
    await page.getByRole('button', { name: /^Defend/ }).click()
    await page.getByRole('button', { name: 'Call it a feint' }).click()
    await page.getByRole('button', { name: 'Feint, staying in reserve' }).click()

    const flag = page.locator('[data-commander-chip="langeron"]')
    await expect(flag).toHaveAttribute('aria-pressed', 'false')
    await expect(flag).toContainText('stays')
    await expect(page.getByText('Going alone, it is detached from its corps.')).toBeVisible()
    await flag.click()
    await expect(flag).toHaveAttribute('aria-pressed', 'true')
    await expect(flag).toContainText('advances')
    await expect(
        page.getByText('joined by Langeron. The remaining units detach and remain in reserve.')
    ).toBeVisible()
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(flag).toHaveAttribute('aria-pressed', 'false')

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
    await threatenWithoutTheGuard(page)
    await tap(page, 'svg [aria-label="Choose this unit"]')
    await page.getByRole('button', { name: /^Defend/ }).click()
    const press = page.getByRole('button', { name: 'Press the attack' })
    await expect(press).toBeVisible()

    await page.reload()
    await page.getByRole('button', { name: 'Games' }).click()
    await page.getByRole('button', { name: 'Austerlitz' }).click()
    await press.click()
    await leadDefence(page)
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

test('two artillery units on a wide approach threaten one at a time and are named together to fire, each by a Unit Move', async ({
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
        .filter({ has: page.locator(':scope > g:nth-of-type(2)') })
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
    await expect(chosen).toHaveCount(1)
    await expect(unitMove).toHaveAttribute('aria-pressed', 'true')
    await expect(threat).toHaveCount(1)

    await threatenWithoutTheGuard(page)
    await tap(page, 'svg [aria-label="Choose this unit"]')
    await page.getByRole('button', { name: /^Defend/ }).click()
    await page.getByRole('button', { name: 'Press the attack' }).click()
    await leadDefence(page)

    const attack = page.getByRole('button', { name: /^Attack/ })
    await page
        .locator(
            '[data-commander="detached"] [aria-label="Choose this unit"][aria-pressed="false"]'
        )
        .first()
        .dispatchEvent('click')
    const leading = page.locator('.nt-turn button[aria-label="Choose this unit"]', {
        hasText: 'leads'
    })
    await expect(leading).toHaveCount(2)
    await expect(
        page.getByRole('group', { name: 'Attack width' }).getByRole('button', { name: 'Narrow' })
    ).toBeDisabled()
    await expect(page.getByText('Two batteries combine only')).toHaveCount(0)
    await expect(
        page.getByRole('group', { name: 'Command' }).getByRole('button', { name: 'Unit Move' })
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(attack).toBeEnabled()
    await attack.click()
    await expect(attack).toBeHidden()
})

test('a threat chosen from the locale it is aimed at', async ({ page }) => {
    await createGame(page)
    await deployBothArmies(page)
    await pickUp(page, 'langeron')
    await tap(page, '[aria-label="Move to locale 94"]')
    await page.getByRole('button', { name: 'End turn' }).click()

    const undo = page.getByRole('button', { name: 'Undo' })
    const aimedAt = page.getByText('Attack on locale 94', { exact: true })
    const threats = page.locator('svg [aria-label="Threaten an attack across this approach"]')
    await expect(threats).toHaveCount(0)
    await tap(page, '[data-aim-locale="94"]')
    await expect(aimedAt).toBeVisible()
    await expect(page.locator('[data-aimed-locale="94"]')).toHaveCount(1)
    await expect(threats).not.toHaveCount(0)
    await undo.click()
    await expect(aimedAt).toBeHidden()
    await expect(threats).toHaveCount(0)

    await tap(page, '[data-commander="langeron"]')
    await expect(aimedAt).toBeVisible()
    await tap(page, '[data-commander="langeron"]')
    await expect(aimedAt).toBeHidden()

    await tap(page, '[data-aim-locale="94"]')
    await pickUp(page, 'st-hilaire')
    await expect(aimedAt).toBeHidden()
    await expect(page.getByRole('group', { name: 'St. Hilaire’s corps' })).toBeVisible()
    await tap(page, '[data-aim-locale="94"]')
    await expect(aimedAt).toBeVisible()
    await tap(page, 'svg[data-board]')
    await expect(aimedAt).toBeHidden()

    await tap(page, '[data-aim-locale="94"]')
    await threats.first().dispatchEvent('click')
    const question = page.getByRole('button', { name: 'Threaten an attack without the Guard' })
    await expect(question).toBeVisible()
    await expect(threats).toHaveCount(0)
    await expect(page.locator('[data-threat-being-declared]')).toHaveCount(1)
    await undo.click()
    await expect(question).toBeHidden()
    await expect(aimedAt).toBeVisible()
    await threats.first().dispatchEvent('click')
    const guard = page.getByRole('button', { name: 'Show this Guard unit' })
    await expect(guard).toHaveCount(1)
    await expect(guard).toHaveAttribute('aria-pressed', 'false')
    await guard.click()
    await page.getByRole('button', { name: 'Announce a Guard Attack' }).click()
    await expect(page.getByText('Guard Attack from locale 93 into locale 94')).toBeVisible()
    await expect(page.getByRole('button', { name: /^Defend/ })).toBeVisible()
})

test('a Guard Attack is announced in two steps, the Guard unit to show chosen first', async ({
    page
}) => {
    await createGame(page)
    await deployBothArmies(page)
    await rearrange(page, (state) => {
        const reserveGuard = state.units.find(
            (unit) => unit.commanderId === 'bernadotte' && unit.face?.guard === true
        )
        if (!reserveGuard) throw new Error('Expected Guard infantry in Bernadotte’s corps')
        reserveGuard.commanderId = undefined
        reserveGuard.position = { locale: 93 }
    })
    await pickUp(page, 'langeron')
    await tap(page, '[aria-label="Move to locale 94"]')
    await page.getByRole('button', { name: 'End turn' }).click()

    await pickUp(page, 'st-hilaire')
    await tap(page, 'svg [aria-label="Threaten an attack across this approach"]')
    const guards = page.getByRole('button', { name: 'Show this Guard unit' })
    const announce = page.getByRole('button', { name: 'Announce a Guard Attack' })
    const withoutTheGuard = page.getByRole('button', {
        name: 'Threaten an attack without the Guard'
    })
    await expect(guards).toHaveCount(2)
    await expect(
        page.getByRole('button', { name: 'Show this Guard unit: St. Hilaire’s corps' })
    ).toHaveCount(1)
    await expect(
        page.getByRole('button', { name: 'Show this Guard unit: Detached, in reserve' })
    ).toHaveCount(1)
    const guardRing = page.locator('[data-guard-ring]')
    await expect(guardRing).toHaveCount(0)
    await expect(withoutTheGuard).toBeVisible()
    await expect(announce).toHaveCount(0)
    await guards.nth(1).click()
    await expect(guards.nth(1)).toHaveAttribute('aria-pressed', 'true')
    await expect(guardRing).toHaveCount(1)
    await expect(announce).toBeVisible()
    await expect(withoutTheGuard).toHaveCount(0)
    await guards.nth(1).click()
    await expect(withoutTheGuard).toBeVisible()
    await guards.first().click()
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(withoutTheGuard).toBeVisible()
    await guards.first().click()
    await announce.click()
    await expect(page.getByText('Guard Attack from locale 93 into locale 94')).toBeVisible()
})

test('a unit chosen on its own is offered to the other commanders standing with it, beside the command', async ({
    page
}) => {
    await createGame(page)
    await deployBothArmies(page)
    await page.getByRole('button', { name: 'End turn' }).click()
    await rearrange(page, (state) => {
        const murat = state.commanders.find((commander) => commander.id === 'murat')
        if (!murat?.position) throw new Error('Expected Murat on the map')
        const together = { ...murat.position }
        for (const unit of state.units.filter((unit) => unit.commanderId === 'vandamme')) {
            unit.position = { ...together }
        }
        for (const commander of state.commanders.filter((entry) => entry.id === 'vandamme')) {
            commander.position = { ...together }
        }
    })
    const attach = page.getByRole('button', { name: 'Attach to Vandamme' })
    const strip = page.getByRole('group', { name: 'Murat’s corps' })
    await pickUp(page, 'murat')
    await expect(strip).toBeVisible()
    await expect(page.getByRole('button', { name: /^Attach to/ })).toHaveCount(0)
    await strip.getByRole('button', { name: 'Include this unit in the command' }).first().click()
    await expect(attach).toHaveCount(1)
    await strip.getByRole('button', { name: 'Include this unit in the command' }).nth(1).click()
    await expect(page.getByRole('button', { name: /^Attach to/ })).toHaveCount(0)
    await strip.getByRole('button', { name: 'Include this unit in the command' }).nth(1).click()
    await attach.click()
    await expect(page.locator('[data-commander="vandamme"] > g')).toHaveCount(
        FRENCH_ARMY.vandamme.length + 1
    )
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
    await threatenWithoutTheGuard(page)
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

test('units named in a defence stay marked for the attacker until the turn ends', async ({
    page
}) => {
    await createGame(page)
    await deployBothArmies(page)
    await pickUp(page, 'langeron')
    await tap(page, '[aria-label="Move to locale 94"]')
    await page.getByRole('button', { name: 'End turn' }).click()
    await pickUp(page, 'st-hilaire')
    await threatenWithoutTheGuard(page)
    const choices = page.locator('svg [aria-label="Choose this unit"]')
    await choices.nth(0).dispatchEvent('click')
    await choices.nth(1).dispatchEvent('click')
    await page.getByRole('button', { name: /^Defend/ }).click()
    await page.getByRole('button', { name: 'Call it a feint' }).click()
    await page.getByRole('button', { name: 'Feint, staying in reserve' }).click()
    await page
        .locator('.nt-turn button[aria-label="Choose this unit"]:not([disabled])')
        .first()
        .click()
    await page.getByRole('button', { name: 'Advance to the approach' }).click()
    await expect(page.getByText('The French called the attack off as a feint.')).toBeVisible()
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    const endTurn = page.getByRole('button', { name: 'End turn' })
    await expect(endTurn).toBeVisible()
    await expect(page.locator('.nt-masthead-turn')).toHaveText('French turn')

    const marked = () =>
        page.evaluate(() => {
            const centreOf = (element: Element) => {
                const box = element.getBoundingClientRect()
                return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
            }
            const letterOf = (block: Element) => block.querySelector('text')?.textContent ?? ''
            const board = 'svg[data-board]'
            const steppedUp = [
                ...document.querySelectorAll(`${board} [data-commander="detached"] > g`)
            ]
            const front = steppedUp.find((block) => letterOf(block) === 'D')
            const stack = [...document.querySelectorAll(`${board} [data-commander="langeron"] > g`)]
            if (!front) {
                return { atTheApproach: 0, stack: stack.map(letterOf) }
            }
            const at = centreOf(front)
            const distance = (block: Element) => {
                const centre = centreOf(block)
                return Math.hypot(centre.x - at.x, centre.y - at.y)
            }
            return {
                atTheApproach: steppedUp.filter((block) => letterOf(block) === 'D').length,
                stack: stack.toSorted((a, b) => distance(a) - distance(b)).map(letterOf)
            }
        })
    expect(await marked()).toEqual({ atTheApproach: 1, stack: ['D', '', '', ''] })

    await endTurn.click()
    await expect(page.locator('.nt-masthead-turn')).not.toHaveText('French turn')
    await expect(page.locator('svg[data-board] [data-group] text')).toHaveCount(0)
})

test('the results of an attack are set in a rule of their own in the action area', async ({
    page
}) => {
    await createGame(page)
    await deployBothArmies(page)
    await pickUp(page, 'langeron')
    await tap(page, '[aria-label="Move to locale 94"]')
    await page.getByRole('button', { name: 'End turn' }).click()
    await pickUp(page, 'st-hilaire')
    await threatenWithoutTheGuard(page)
    await tap(page, 'svg [aria-label="Choose this unit"]')
    await page.getByRole('button', { name: /^Defend/ }).click()
    const result = page.locator('.nt-result-rule')
    await expect(result).toHaveCount(0)
    await expect(page.locator('.nt-loss-rule')).toHaveCount(0)

    const arrow = page.locator('svg[data-board] [data-attack-arrow]')
    await expect(arrow).toHaveAttribute('data-attack-arrow', 'threat')
    await page.getByRole('button', { name: 'Press the attack' }).click()
    await leadDefence(page)
    await expect(arrow).toHaveAttribute('data-attack-arrow', 'attack')
    await expect(result).toHaveText(/Initial result\s+[+-]?\d+/)
    await expect(result).not.toContainText('Final result')

    const counterArrow = page.locator('svg[data-board] [data-counter-attack-arrow]')
    await page.getByRole('button', { name: /^Attack/ }).click()
    await expect(arrow).toHaveAttribute('data-attack-arrow', 'attack')
    await expect(counterArrow).toHaveCount(0)
    await expect(result).toHaveCount(2)
    await expect(result.first()).toHaveText(/Initial result\s+[+-]?\d+/)
    await expect(result.last()).toHaveText(/Final result\s+[+-]?\d+/)
    await expect(page.getByText('Counter-attacking')).toHaveCount(0)

    await page.locator('.nt-turn button[aria-label="Choose this unit"]:not([disabled])').click()
    await page.getByRole('button', { name: 'Counter-attack', exact: true }).click()
    await expect(result).toHaveCount(1)
    await expect(counterArrow).toHaveCount(1)
    await expect(result).toHaveText(/Initial result\s+[+-]?\d+\s+Final result\s+[+-]?\d+/)
    const counterAttack = page.getByText('Counter-attacking')
    await expect(counterAttack).toBeVisible()
    const below = async (locator: Locator) => (await locator.boundingBox())?.y ?? 0
    expect(await below(counterAttack)).toBeGreaterThan(
        await below(page.getByText('Attacking', { exact: true }))
    )
    expect(await below(result)).toBeGreaterThan(await below(counterAttack))

    const sumOf = async (dialog: Locator) => {
        const values = await dialog.locator('tbody td').allInnerTexts()
        return values.reduce((sum, value) => sum + Number(value), 0)
    }
    await page.getByRole('button', { name: /^Initial result/ }).click()
    const initial = page.getByRole('dialog', { name: 'How the initial result is reached' })
    await expect(initial.getByText('Leading the attack')).toBeVisible()
    expect(Number(await initial.locator('tfoot td').innerText())).toBe(await sumOf(initial))
    await initial.getByRole('button', { name: 'Close' }).click()
    await expect(initial).toBeHidden()

    await page.getByRole('button', { name: /^Final result/ }).click()
    const final = page.getByRole('dialog', { name: 'How the final result is reached' })
    await expect(final.getByText(/^Counter-attacking/)).toBeVisible()
    await expect(final.getByText(/the attack (succeeds|is defeated)/)).toBeVisible()
    expect(Number(await final.locator('tfoot td').innerText())).toBe(await sumOf(final))
    await page.keyboard.press('Escape')
    await expect(final).toBeHidden()

    await page.getByRole('tab', { name: 'History' }).click()
    await page.getByRole('button', { name: /press the attack/ }).click()
    const pressing = page.getByRole('dialog', { name: 'An action from the history' })
    await expect(pressing.locator('[data-attack-arrow]')).toHaveAttribute(
        'data-attack-arrow',
        'attack'
    )
    await page.keyboard.press('Escape')
    await page.getByRole('tab', { name: 'Armies' }).click()

    const lossRule = page.locator('.nt-loss-rule')
    const verdict = page.locator('.nt-battle').getByText(/zero.* the attack (succeeds|is defeated)/)
    await expect(lossRule).toHaveText(/French\s+.*Allies\s+/)
    await expect(page.locator('.nt-loss-rule-units .nt-unit-tile')).not.toHaveCount(0)
    await expect(verdict).toBeVisible()
    expect(await below(verdict)).toBeGreaterThan(await below(result))
    expect(await below(lossRule)).toBeGreaterThan(await below(verdict))
    await lossRule.getByRole('button').click()
    const losses = page.getByRole('dialog', { name: 'What the attack has cost' })
    await expect(losses.getByRole('heading', { name: /^The French/ })).toBeVisible()
    await expect(losses.getByRole('heading', { name: /^The Allies/ })).toBeVisible()
    await expect(losses.getByText(/^A step for each/).first()).toBeVisible()
    await expect(losses.locator('.nt-unit-tile')).toHaveCount(0)
    await losses.getByRole('button', { name: 'Close' }).click()
    await expect(losses).toBeHidden()
})

test('an attack already under way when the table opens ends on the whole board, not in a corner of it', async ({
    page
}) => {
    const acrossTheMapArea = async () => {
        const board = await page.locator('svg[data-board]').boundingBox()
        const host = await page.locator('.nt-board-host').boundingBox()
        return board && host ? Math.round(board.width) <= Math.round(host.width) : undefined
    }
    await createGame(page)
    await deployBothArmies(page)
    await pickUp(page, 'langeron')
    await tap(page, '[aria-label="Move to locale 94"]')
    await page.getByRole('button', { name: 'End turn' }).click()
    await pickUp(page, 'st-hilaire')
    await threatenWithoutTheGuard(page)
    await tap(page, 'svg [aria-label="Choose this unit"]')
    await page.getByRole('button', { name: /^Defend/ }).click()
    await page.getByRole('button', { name: 'Call it a feint' }).click()
    await page.getByRole('button', { name: 'Feint, staying in reserve' }).click()
    const advance = page.getByRole('button', { name: 'Advance to the approach' })
    await expect(advance).toBeVisible()
    await expect(page.locator('.nt-result-rule')).toHaveText('Feint')

    await page.reload()
    await page.getByRole('button', { name: 'Games' }).click()
    await page.getByRole('button', { name: 'Austerlitz' }).click()
    await expect.poll(acrossTheMapArea).toBe(false)
    await advance.click()
    await expect(page.locator('.nt-masthead-turn')).toHaveText('French turn')
    await expect.poll(acrossTheMapArea).toBe(true)
    await page.waitForTimeout(800)
    expect(await acrossTheMapArea()).toBe(true)
})

test('a player’s own units that the enemy has seen carry a mark, on the map and in the panels', async ({
    page
}) => {
    await createGame(page)
    await deployBothArmies(page)
    const onTheMap = page.locator('svg[data-board] [data-seen-by-the-enemy]')
    const inThePanel = page
        .locator('section.nt-army')
        .filter({ hasText: 'Allied Army' })
        .locator('[data-seen-by-the-enemy]')
    await pickUp(page, 'langeron')
    await tap(page, '[aria-label="Move to locale 94"]')
    await expect(page.locator('.nt-masthead-turn')).toHaveText('Allies’ turn')
    await expect(onTheMap).toHaveCount(0)
    await page.getByRole('button', { name: 'End turn' }).click()
    await pickUp(page, 'st-hilaire')
    await threatenWithoutTheGuard(page)
    const choices = page.locator('svg [aria-label="Choose this unit"]')
    await choices.first().dispatchEvent('click')
    await choices.last().dispatchEvent('click')
    await expect(onTheMap).toHaveCount(0)
    await page.getByRole('button', { name: /^Defend/ }).click()
    await page.getByRole('button', { name: 'Press the attack' }).click()
    await expect(onTheMap).toHaveCount(0)
    await leadDefence(page, 1)
    const attacker = page
        .locator('.nt-turn button[aria-label="Choose this unit"]:not([disabled])')
        .first()
    await attacker.click()
    await attacker.click()
    await page.getByRole('button', { name: /^Attack/ }).click()
    await expect(page.locator('.nt-masthead-turn')).toHaveText('Allies’ turn')
    await expect(onTheMap).toHaveCount(1)
    await expect(inThePanel).toHaveCount(1)
})

test('the fixed battery is marked for both players and carries no eye of its own', async ({
    page
}) => {
    await createGame(page)
    await deployBothArmies(page)
    const turn = page.locator('.nt-masthead-turn')
    const onTheMap = page.locator('svg[data-board] [data-fixed-battery]')
    const inThePanel = page
        .locator('section.nt-army')
        .filter({ hasText: 'Grande Armée' })
        .locator('[data-fixed-battery]')
    await expect(turn).toHaveText('Allies’ turn')
    await expect(onTheMap).toHaveCount(1)
    await expect(inThePanel).toHaveCount(1)
    await page.getByRole('button', { name: 'End turn' }).click()
    await expect(turn).toHaveText('French turn')
    await expect(onTheMap).toHaveCount(1)
    await expect(inThePanel).toHaveCount(1)
    await expect(page.locator('[data-seen-by-the-enemy]')).toHaveCount(0)
})

test('pressing an attack shows nothing and can be taken back until the defender has named the leading units', async ({
    page
}) => {
    await createGame(page)
    await deployBothArmies(page)
    await pickUp(page, 'langeron')
    await tap(page, '[aria-label="Move to locale 94"]')
    await page.getByRole('button', { name: 'End turn' }).click()
    await pickUp(page, 'st-hilaire')
    await threatenWithoutTheGuard(page)
    const turn = page.locator('.nt-masthead-turn')
    const choices = page.locator('svg [aria-label="Choose this unit"]')
    await choices.first().dispatchEvent('click')
    await choices.last().dispatchEvent('click')
    const defend = page.getByRole('button', { name: 'Defend', exact: true })
    await expect(page.locator('.nt-turn').getByText('leads')).toHaveCount(0)
    await defend.click()

    const press = page.getByRole('button', { name: 'Press the attack' })
    const undo = page.getByRole('button', { name: 'Undo' })
    const shown = page.locator('svg[data-board] [data-commander="langeron"] [data-unit-face]')
    await expect(turn).toHaveText('French turn')
    await expect(shown).toHaveCount(0)
    await press.click()
    await expect(turn).toHaveText('Allies’ turn')
    await expect(page.getByText('The attack is pressed.')).toBeVisible()
    const lead = leadButton(page)
    await expect(lead).toHaveText('Defend with no leading unit')

    await undo.click()
    await expect(turn).toHaveText('French turn')
    await expect(press).toBeVisible()
    await expect(shown).toHaveCount(0)

    await press.click()
    const tiles = page.locator('.nt-turn button[aria-label="Choose this unit"]:not([disabled])')
    await expect(tiles).toHaveCount(2)
    await tiles.first().click()
    await expect(lead).toHaveText('Lead with this unit')
    await undo.click()
    await expect(lead).toHaveText('Defend with no leading unit')
    await tiles.first().click()
    await lead.click()

    await expect(turn).toHaveText('French turn')
    await expect(page.getByRole('button', { name: /^Attack/ })).toBeVisible()
    await expect(shown).toHaveCount(1)
    await expect(undo).toBeHidden()
})
