import { assertExists, type GameConfig } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import {
    MAX_CORPS_UNITS,
    MAX_FRENCH_DETACHMENTS,
    SANTON_LOCALE,
    Scenario,
    Side,
    UnitType,
    setupLocaleOf
} from '@tabletop/napoleons-triumph'
import { TestGame } from '@tabletop/napoleons-triumph/testing'
import {
    OnMapStart,
    emptySetup,
    withCorpsOnMap,
    withFixedBatteryPosted,
    withUnitDetached,
    withUnitJoining,
    withUnitReturned,
    type ArmySetup
} from './armySetup.js'
import { DestinationKind, type SetupDestination, type SetupStep } from './setupSelection.js'
import {
    firstDestination,
    placedStraightFromPool,
    seatOfUnitApart,
    setupLocales,
    setupTable,
    setupTargets,
    unitInHand,
    unitsOfOpenSeat,
    withTargetChosen,
    type PoolStack,
    type SetupTable
} from './setupTable.js'
import { TargetKind } from './targets.js'

const DETACHED: SetupDestination = { kind: DestinationKind.Detached }
const FIXED_BATTERY: SetupDestination = { kind: DestinationKind.FixedBattery }

function corps(commanderId: string): SetupDestination {
    return { kind: DestinationKind.Corps, commanderId }
}

function frenchToSetUp(config: GameConfig = {}) {
    const game = new TestGame(config)
    game.deploy(Side.Allied)
    const state = game.hydrated
    const playerId = game.playerOf(Side.French)
    return { state, playerId, setup: emptySetup(state, playerId) }
}

function stackOf(table: SetupTable, type: UnitType, strength: number): PoolStack {
    const stack = table.stacks.find(
        ({ face }) => face.type === type && face.strength === strength && !face.guard
    )
    assertExists(stack, `No stack of ${strength}-strength ${type}`)
    return stack
}

function nextOf(table: SetupTable, type: UnitType, strength: number): string {
    const unitId = stackOf(table, type, strength).nextUnitId
    assertExists(unitId, `No ${strength}-strength ${type} is left to place`)
    return unitId
}

describe('the set-up table', () => {
    it('opens on the first corps with the whole army still to assign', () => {
        const { state, playerId, setup } = frenchToSetUp()
        const open = firstDestination(setup)
        const table = setupTable(state, playerId, { setup, open })

        expect(open).toEqual(corps('bernadotte'))
        expect(table.unassigned).toBe(36)
        expect(table.corps.filter((seat) => seat.open).map((seat) => seat.commanderId)).toEqual([
            'bernadotte'
        ])
        expect(table.stacks.every((stack) => stack.offered && !stack.held)).toBe(true)
        expect(table.problem).toBeUndefined()
    })

    it('sends a unit tapped in the pool straight into the open corps', () => {
        const { state, playerId, setup } = frenchToSetUp()
        const step: SetupStep = { setup, open: corps('lannes') }
        const table = setupTable(state, playerId, step)
        const unitId = nextOf(table, UnitType.Infantry, 2)
        const placed = placedStraightFromPool(step, unitId)
        assertExists(placed, 'A unit joins the open corps at once')

        const after = setupTable(state, playerId, { setup: placed, open: step.open })
        expect(after.corps.find((seat) => seat.open)?.unitIds).toEqual([unitId])
        expect(stackOf(after, UnitType.Infantry, 2).count).toBe(15)
        expect(after.unassigned).toBe(35)
    })

    it('offers nothing from the pool once the open corps is full', () => {
        const { state, playerId, setup } = frenchToSetUp()
        const full = state
            .unitsOf(playerId)
            .map((unit) => unit.id)
            .toSorted()
            .slice(0, MAX_CORPS_UNITS)
            .reduce((joined, unitId) => withUnitJoining(joined, unitId, 'lannes'), setup)
        const table = setupTable(state, playerId, { setup: full, open: corps('lannes') })

        expect(table.corps.find((seat) => seat.open)?.room).toBe(0)
        expect(table.stacks.some((stack) => stack.offered)).toBe(false)
        expect(
            setupTable(state, playerId, { setup: full, open: corps('murat') }).stacks.every(
                (stack) => stack.offered || stack.count === 0
            )
        ).toBe(true)
    })

    it('takes a unit in hand for the map when it is to stand on its own', () => {
        const { state, playerId, setup } = frenchToSetUp()
        const step: SetupStep = { setup, open: DETACHED }
        const unitId = nextOf(setupTable(state, playerId, step), UnitType.Cavalry, 2)

        expect(placedStraightFromPool(step, unitId)).toBeUndefined()
        const inHand: SetupStep = { ...step, heldUnitId: unitId }
        expect(stackOf(setupTable(state, playerId, inHand), UnitType.Cavalry, 2).held).toBe(true)
        expect(
            setupTargets(state, playerId, inHand).every(
                (target) => target.kind === TargetKind.Reserve
            )
        ).toBe(true)
        expect(setupTargets(state, playerId, step)).toEqual([])
    })

    it('stands the unit in hand in reserve in the locale tapped, then on the approach tapped there', () => {
        const { state, playerId, setup } = frenchToSetUp()
        const unitId = nextOf(
            setupTable(state, playerId, { setup, open: DETACHED }),
            UnitType.Cavalry,
            2
        )
        const inHand: SetupStep = { setup, open: DETACHED, heldUnitId: unitId }
        const home = setupLocaleOf(state.map, 'murat').id
        const locale = setupTargets(state, playerId, inHand).find(
            (target) => target.position.locale === home
        )
        assertExists(locale, 'A unit may be set up on its own in Murat’s locale')

        const inReserve: SetupStep = { ...inHand, setup: withTargetChosen(inHand, locale) }
        expect(inReserve.setup.detached).toEqual([{ unitId, position: { locale: home } }])
        const table = setupTable(state, playerId, inReserve)
        expect(table.detached?.heldAtItsPost).toEqual({ unitId, position: { locale: home } })
        expect(table.detached?.room).toBe(MAX_FRENCH_DETACHMENTS - 1)

        const [approach] = setupTargets(state, playerId, inReserve)
        expect(approach.kind).toBe(TargetKind.Approach)
        const blocking = withTargetChosen(inReserve, approach)
        expect(blocking.detached).toEqual([{ unitId, position: approach.position }])
    })

    it('offers only artillery for the fixed battery, and none once it is placed', () => {
        const { state, playerId, setup } = frenchToSetUp()
        const open = setupTable(state, playerId, { setup, open: FIXED_BATTERY })
        expect(
            open.stacks.filter((stack) => stack.offered).map((stack) => stack.face.type)
        ).toEqual([UnitType.Artillery])

        const battery = nextOf(open, UnitType.Artillery, 1)
        const home = setupLocaleOf(state.map, 'lannes').id
        const posted = withFixedBatteryPosted(setup, battery, { locale: home })
        const placed = setupTable(state, playerId, { setup: posted, open: FIXED_BATTERY })
        expect(placed.stacks.some((stack) => stack.offered)).toBe(false)
        expect(placed.fixedBattery).toEqual({
            unitId: battery,
            position: { locale: home },
            open: true,
            holdsTheSanton: false
        })
        expect(placed.detached?.unitIds).toEqual([])
    })

    it('keeps the fixed battery in hand while its seat is open, so it can be given an approach or turned', () => {
        const { state, playerId, setup } = frenchToSetUp()
        const battery = nextOf(
            setupTable(state, playerId, { setup, open: FIXED_BATTERY }),
            UnitType.Artillery,
            1
        )
        const home = setupLocaleOf(state.map, 'lannes').id
        const inReserve = withFixedBatteryPosted(setup, battery, { locale: home })
        const reopened: SetupStep = { setup: inReserve, open: FIXED_BATTERY }

        expect(unitInHand(reopened)).toBe(battery)
        expect(unitInHand({ setup: inReserve, open: DETACHED })).toBeUndefined()
        const [approach, ...others] = setupTargets(state, playerId, reopened)
        expect(approach.kind).toBe(TargetKind.Approach)
        const blocking = withTargetChosen(reopened, approach)
        expect(blocking.detached).toEqual([{ unitId: battery, position: approach.position }])
        expect(
            setupTargets(state, playerId, { setup: blocking, open: FIXED_BATTERY })
        ).toHaveLength(others.length)
    })

    it('offers a corps no approach that would make the fixed battery a seventh detachment', () => {
        const { state, playerId, setup } = frenchToSetUp()
        const table = setupTable(state, playerId, { setup, open: FIXED_BATTERY })
        const battery = nextOf(table, UnitType.Artillery, 1)
        const others = state
            .unitsOf(playerId)
            .map((unit) => unit.id)
            .filter((id) => id !== battery)
            .toSorted()
            .slice(0, MAX_FRENCH_DETACHMENTS)
        const home = setupLocaleOf(state.map, 'lannes').id
        const murat = setupLocaleOf(state.map, 'murat').id
        const [aimed] = state.map.passableApproachesOf(home)
        const sixDetached = others.reduce(
            (posted, unitId) => withUnitDetached(posted, unitId, { locale: murat }),
            withFixedBatteryPosted(setup, battery, { locale: home, approach: aimed.id })
        )
        const lannes: SetupStep = { setup: sixDetached, open: corps('lannes') }

        expect(setupTargets(state, playerId, lannes).map((target) => target.position)).toEqual([
            { locale: home, approach: aimed.id }
        ])
        expect(
            setupTargets(state, playerId, { setup: sixDetached, open: FIXED_BATTERY }).length
        ).toBe(state.map.passableApproachesOf(home).length - 1)
    })

    it('starts with the fixed battery holding the Santon when the Santon rule is in use, with nothing to place or turn', () => {
        const { state, playerId, setup } = frenchToSetUp({ santon: true })
        const step: SetupStep = { setup, open: FIXED_BATTERY }
        const table = setupTable(state, playerId, step)

        expect(table.fixedBattery).toEqual({
            unitId: setup.fixedBatteryId,
            position: { locale: SANTON_LOCALE },
            open: true,
            holdsTheSanton: true
        })
        expect(table.unassigned).toBe(35)
        expect(stackOf(table, UnitType.Artillery, 1).count).toBe(2)
        expect(table.stacks.some((stack) => stack.offered)).toBe(false)
        expect(table.detached).toMatchObject({ unitIds: [], room: MAX_FRENCH_DETACHMENTS - 1 })
        expect(table.corps.map((seat) => seat.stillNeeded)).toEqual(
            setupTable(frenchToSetUp().state, playerId, {
                setup: frenchToSetUp().setup,
                open: FIXED_BATTERY
            }).corps.map((seat) => seat.stillNeeded)
        )
        expect(setupTargets(state, playerId, step)).toEqual([])
    })

    it('marks on the map the units of the open seat: a corps, every detached unit, or just the one in hand', () => {
        const { state, playerId, setup } = frenchToSetUp()
        const table = setupTable(state, playerId, { setup, open: DETACHED })
        const battery = nextOf(table, UnitType.Artillery, 1)
        const [first, second, third] = table.stacks.flatMap((stack) =>
            stack.face.type === UnitType.Infantry && stack.nextUnitId ? [stack.nextUnitId] : []
        )
        const home = setupLocaleOf(state.map, 'lannes').id
        const arranged = withUnitJoining(
            withUnitDetached(
                withUnitDetached(withFixedBatteryPosted(setup, battery, { locale: home }), first, {
                    locale: home
                }),
                second,
                { locale: home }
            ),
            third,
            'lannes'
        )

        expect(unitsOfOpenSeat({ setup: arranged, open: corps('lannes') })).toEqual([third])
        expect(unitsOfOpenSeat({ setup: arranged, open: corps('murat') })).toEqual([])
        expect(unitsOfOpenSeat({ setup: arranged, open: DETACHED })).toEqual([first, second])
        expect(unitsOfOpenSeat({ setup: arranged, open: DETACHED, heldUnitId: second })).toEqual([
            second
        ])
        expect(unitsOfOpenSeat({ setup: arranged, open: FIXED_BATTERY })).toEqual([battery])
        expect(
            unitsOfOpenSeat({ setup: withUnitReturned(arranged, battery), open: FIXED_BATTERY })
        ).toEqual([])
    })

    it('names the destination a unit standing on its own belongs to', () => {
        const { state, playerId, setup } = frenchToSetUp()
        const table = setupTable(state, playerId, { setup, open: DETACHED })
        const battery = nextOf(table, UnitType.Artillery, 1)
        const cavalry = nextOf(table, UnitType.Cavalry, 2)
        const home = setupLocaleOf(state.map, 'lannes').id
        const posted = withUnitDetached(
            withFixedBatteryPosted(setup, battery, { locale: home }),
            cavalry,
            { locale: home }
        )
        expect(seatOfUnitApart(posted, battery)).toEqual(FIXED_BATTERY)
        expect(seatOfUnitApart(posted, cavalry)).toEqual(DETACHED)
    })

    it('reports what is wrong only once every unit is placed', () => {
        const { state, playerId, setup } = frenchToSetUp()
        const everyone = state
            .unitsOf(playerId)
            .map((unit) => unit.id)
            .toSorted()
        const commanders = setup.corps.map((entry) => entry.commanderId)
        const crowded: ArmySetup = everyone.reduce(
            (joined, unitId, index) =>
                withUnitJoining(joined, unitId, commanders[index < 32 ? index % 4 : 4]),
            setup
        )
        const table = setupTable(state, playerId, { setup: crowded, open: corps('lannes') })
        expect(table.unassigned).toBe(0)
        expect(table.problem).toBeDefined()
        expect(
            setupTable(state, playerId, { setup, open: corps('lannes') }).problem
        ).toBeUndefined()
    })
})

describe('the corps that start on the map', () => {
    it('are marked on their set-up locales, the open one apart, until they have units of their own', () => {
        const { state, playerId, setup } = frenchToSetUp()
        const unitId = nextOf(
            setupTable(state, playerId, { setup, open: corps('lannes') }),
            UnitType.Infantry,
            2
        )
        const joined = withUnitJoining(setup, unitId, 'lannes')
        const locales = setupLocales(state, { setup: joined, open: corps('lannes') })

        expect(locales.map((entry) => entry.commanderId)).toEqual([
            'bessieres',
            'lannes',
            'legrand',
            'murat',
            'st-hilaire',
            'vandamme'
        ])
        expect(locales.filter((entry) => entry.open).map((entry) => entry.commanderId)).toEqual([
            'lannes'
        ])
        expect(locales.filter((entry) => !entry.empty).map((entry) => entry.commanderId)).toEqual([
            'lannes'
        ])
    })

    it('are the two the Allied player chooses on 1 December, and no third', () => {
        const game = new TestGame({ scenario: Scenario.December1 })
        const state = game.hydrated
        const playerId = game.playerOf(Side.Allied)
        const setup = emptySetup(state, playerId)
        const untouched = setupTable(state, playerId, { setup, open: firstDestination(setup) })
        expect(
            untouched.corps.every((seat) => seat.offMap && seat.onMapStart === OnMapStart.Offered)
        ).toBe(true)
        expect(untouched.corpsStillToStartOnMap).toBe(2)
        expect(untouched.detached).toBeUndefined()
        expect(untouched.fixedBattery).toBeUndefined()

        const two = withCorpsOnMap(withCorpsOnMap(setup, 'bagration', true), 'langeron', true)
        const chosen = setupTable(state, playerId, { setup: two, open: firstDestination(two) })
        expect(
            chosen.corps
                .filter((seat) => seat.onMapStart === OnMapStart.Offered)
                .map((seat) => seat.commanderId)
        ).toEqual(['bagration', 'langeron'])
        expect(chosen.corpsStillToStartOnMap).toBe(0)
        expect(setupLocales(state, { setup: two, open: firstDestination(two) })).toHaveLength(2)
    })
})
