import { expect, test, type Page } from '@playwright/test'
import {
    AUSTERLITZ,
    CommandKind,
    Side,
    UnitType,
    type NapoleonsTriumphGameState
} from '@tabletop/napoleons-triumph'
import {
    createGame,
    deployBothArmies,
    failOnPageErrors,
    leadDefence,
    rearrange,
    tap,
    threaten
} from './table.js'

failOnPageErrors()

const RIDE_SWITCH = 'Riding on or a new command'

function unitOf(state: NapoleonsTriumphGameState, commanderId: string, type: UnitType) {
    const unit = state.units.find(
        (candidate) => candidate.commanderId === commanderId && candidate.face.type === type
    )
    if (!unit) {
        throw new Error(`Expected ${commanderId} to lead ${type}`)
    }
    return unit
}

function frenchPlayer(state: NapoleonsTriumphGameState) {
    const french = state.players.find((player) => player.side === Side.French)
    if (!french) {
        throw new Error('Expected a French player')
    }
    return french
}

/** A detached French cavalry unit has ridden on by road into locale 62, where a detached infantry unit that has not moved stands. */
function cavalryRidesInBesideInfantry(state: NapoleonsTriumphGameState) {
    const rider = unitOf(state, 'vandamme', UnitType.Cavalry)
    const foot = unitOf(state, 'vandamme', UnitType.Infantry)
    Object.assign(rider, {
        commanderId: undefined,
        position: { locale: 62 },
        movesThisTurn: 1,
        enteredReserveThisTurn: true,
        arrivedByRoad: { locale: 62, roads: [0] }
    })
    Object.assign(foot, { commanderId: undefined, position: { locale: 62 } })
    frenchPlayer(state).independentCommandsUsed = 1
    state.roadMarch = { kind: CommandKind.Unit, unitIds: [rider.id], start: 63, path: [62] }
}

/** Bernadotte's cavalry has come on at 51, taken locale 38 by road and may ride on, in its turn of entry; an Allied unit holds 52. */
function reinforcementCavalryRidesIn(state: NapoleonsTriumphGameState) {
    const rider = unitOf(state, 'bernadotte', UnitType.Cavalry)
    for (const unit of state.units) {
        if (unit.commanderId === 'bernadotte' && unit !== rider) {
            unit.commanderId = undefined
        }
    }
    Object.assign(rider, {
        position: { locale: 38 },
        movesThisTurn: 1,
        enteredThisTurn: true,
        enteredReserveThisTurn: true,
        arrivedByRoad: { locale: 38, roads: [0] }
    })
    const bernadotte = state.commanders.find((commander) => commander.id === 'bernadotte')
    if (!bernadotte) {
        throw new Error('Expected Bernadotte among the commanders')
    }
    Object.assign(bernadotte, {
        position: { locale: 38 },
        commandsThisTurn: 1,
        enteredThisTurn: true
    })
    Object.assign(unitOf(state, 'langeron', UnitType.Infantry), {
        commanderId: undefined,
        position: { locale: 52 }
    })
    state.roadMarch = {
        kind: CommandKind.Corps,
        commanderId: 'bernadotte',
        unitIds: [rider.id],
        entryId: 'F2',
        path: [51, 38]
    }
    state.frenchReinforcementsEntered = true
}

async function frenchTurnWith(page: Page, edit: (state: NapoleonsTriumphGameState) => void) {
    await createGame(page)
    await deployBothArmies(page)
    await page.getByRole('button', { name: 'End turn' }).click()
    await expect(page.getByText('French turn')).toBeVisible()
    await rearrange(page, edit)
}

test('a unit standing beside cavalry that is riding on takes a command of its own', async ({
    page
}) => {
    await frenchTurnWith(page, cavalryRidesInBesideInfantry)
    const riding = page.getByRole('group', { name: 'Detached units, riding on' })
    const commanding = page.getByRole('group', { name: 'Detached units', exact: true })
    const leftOut = page.locator('.nt-orders-units button[aria-pressed="false"]')
    const moves = page.locator('svg [aria-label^="Move to"]')

    await expect(riding).toBeVisible()
    await expect(leftOut).toHaveCount(1)
    await expect(leftOut).toBeEnabled()

    await leftOut.click()
    await expect(commanding).toBeVisible()
    await expect(page.getByRole('button', { name: 'Unit Move' })).toHaveAttribute(
        'aria-pressed',
        'true'
    )
    await expect(moves).not.toHaveCount(0)

    await leftOut.click()
    await expect(riding).toBeVisible()

    await leftOut.click()
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(riding).toBeVisible()

    await leftOut.click()
    await tap(page, 'svg [aria-label^="Move to"]')
    await expect(page.getByText(/^Choose a corps/)).toBeVisible()
})

test('reinforcement cavalry that is riding on takes its second command and presses an attack', async ({
    page
}) => {
    await frenchTurnWith(page, reinforcementCavalryRidesIn)
    const rideSwitch = page.getByRole('group', { name: RIDE_SWITCH })
    const ridingOn = rideSwitch.getByRole('button', { name: 'Riding on' })
    const newCommand = rideSwitch.getByRole('button', { name: 'New command' })

    await expect(page.getByRole('group', { name: 'Bernadotte’s corps, riding on' })).toBeVisible()
    await expect(ridingOn).toHaveAttribute('aria-pressed', 'true')

    await newCommand.click()
    await expect(page.getByRole('group', { name: 'Bernadotte’s corps', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Corps Move' })).toHaveAttribute(
        'aria-pressed',
        'true'
    )
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(ridingOn).toHaveAttribute('aria-pressed', 'true')

    await newCommand.click()
    await threaten(page, 38, 52)
    await page.locator('button[aria-label="Choose this unit"]:not([disabled])').first().click()
    await page.getByRole('button', { name: /^Defend/ }).click()

    await page.getByRole('button', { name: 'Call it a feint' }).click()
    await expect(newCommand).toHaveAttribute('aria-pressed', 'true')
    await ridingOn.click()
    await expect(ridingOn).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Undo' }).click()
    await page.getByRole('button', { name: 'Undo' }).click()

    await page.getByRole('button', { name: 'Press the attack' }).click()
    await leadDefence(page)
    await expect(page.getByText('In reserve', { exact: true })).toBeVisible()
    await expect(rideSwitch).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Attack with no leading unit' })).toBeEnabled()
})

test('cavalry riding on stays in hand while a locale is aimed at, and the threat starts from the ride', async ({
    page
}) => {
    await frenchTurnWith(page, reinforcementCavalryRidesIn)
    const rideSwitch = page.getByRole('group', { name: RIDE_SWITCH })
    await expect(page.getByRole('group', { name: 'Bernadotte’s corps, riding on' })).toBeVisible()
    await expect(page.getByText('Tap an enemy locale to threaten an attack.')).toBeVisible()

    await tap(page, '[data-aim-locale="52"]')
    await expect(
        page.getByText('The pieces you chose will join the attack where they can.')
    ).toBeVisible()
    await tap(page, `svg [data-threat="${AUSTERLITZ.approachBetween(38, 52).id}"]`)
    await page.locator('button[aria-label="Choose this unit"]:not([disabled])').first().click()
    await page.getByRole('button', { name: /^Defend/ }).click()

    await page.getByRole('button', { name: 'Call it a feint' }).click()
    await expect(rideSwitch.getByRole('button', { name: 'Riding on' })).toHaveAttribute(
        'aria-pressed',
        'true'
    )
})
