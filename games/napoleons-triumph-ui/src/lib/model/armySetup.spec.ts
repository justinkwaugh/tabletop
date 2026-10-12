import { assertExists, type GameConfig } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import {
    MAX_CORPS_UNITS,
    MAX_FRENCH_DETACHMENTS,
    SANTON_LOCALE,
    Scenario,
    Side,
    UnitType,
    commandersOf,
    deployArmy,
    nearAlliedObjective,
    type Deployment,
    type HydratedNapoleonsTriumphGameState
} from '@tabletop/napoleons-triumph'
import { TestGame, suggestedDeployment } from '@tabletop/napoleons-triumph/testing'
import {
    arrayedArmy,
    corpsCards,
    creditsOf,
    deploymentOf,
    detachedPosts,
    detachmentsUsed,
    emptySetup,
    fits,
    fixedBatteryPosts,
    postStances,
    setupLocaleOf,
    setupProblem,
    stanceTargets,
    unassignedStacks,
    withCorpsOnMap,
    withCorpsStance,
    withFixedBatteryOnTheSanton,
    withFixedBatteryPosted,
    withUnitDetached,
    withUnitJoining,
    withUnitReturned,
    type ArmySetup
} from './armySetup.js'
import { copyOf } from './stateCopy.js'
import { TargetKind } from './targets.js'

function frenchToSetUp(config: GameConfig = {}) {
    const game = new TestGame(config)
    game.deploy(Side.Allied)
    const state = game.hydrated
    const playerId = game.playerOf(Side.French)
    return { game, state, playerId, setup: emptySetup(state, Side.French) }
}

function unitIdsOf(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    type?: UnitType
): string[] {
    return state
        .unitsOf(playerId)
        .filter((unit) => type === undefined || unit.face?.type === type)
        .map((unit) => unit.id)
        .toSorted()
}

function joining(setup: ArmySetup, commanderId: string, unitIds: string[]): ArmySetup {
    return unitIds.reduce((joined, unitId) => withUnitJoining(joined, unitId, commanderId), setup)
}

function cardOf(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    setup: ArmySetup,
    commanderId: string
) {
    const card = corpsCards(state, playerId, setup).find(
        (candidate) => candidate.commanderId === commanderId
    )
    assertExists(card, `${commanderId} has no card`)
    return card
}

/** The set-up the specs deploy, arranged the way a player would: who stays with each commander and who stands apart. */
function setupFrom(state: HydratedNapoleonsTriumphGameState, deployment: Deployment): ArmySetup {
    const battery = deployment.fixedBattery
    const batteryCorps = deployment.corps.find(
        (corps) => battery !== undefined && corps.unitIds.includes(battery.unitId)
    )
    const detached = [...deployment.detachments]
    if (battery?.approach !== undefined && batteryCorps) {
        detached.push({
            unitId: battery.unitId,
            position: {
                locale: setupLocaleOf(state.map, batteryCorps.commanderId).id,
                approach: battery.approach
            }
        })
    }
    return {
        corps: deployment.corps.map((corps) => ({
            commanderId: corps.commanderId,
            unitIds: corps.unitIds.filter((id) => !detached.some((entry) => entry.unitId === id)),
            offMap: corps.offMap === true,
            approach: corps.approach
        })),
        detached,
        fixedBatteryId: battery?.unitId
    }
}

describe('an untouched set-up', () => {
    it('starts every corps empty, with only the reinforcement corps off the map', () => {
        const { setup } = frenchToSetUp()
        expect(setup.corps.every((corps) => corps.unitIds.length === 0)).toBe(true)
        expect(
            setup.corps.filter((corps) => corps.offMap).map((corps) => corps.commanderId)
        ).toEqual(['bernadotte', 'davout'])
        expect(setup.detached).toEqual([])
    })

    it('holds every Allied corps off the map on 1 December until two are chosen', () => {
        const game = new TestGame({ scenario: Scenario.December1 })
        const state = game.hydrated
        const playerId = game.playerOf(Side.Allied)
        const setup = emptySetup(state, Side.Allied)
        expect(setup.corps.every((corps) => corps.offMap)).toBe(true)

        const two = withCorpsOnMap(withCorpsOnMap(setup, 'bagration', true), 'langeron', true)
        expect(fits(state, playerId, two)).toBe(true)
        expect(fits(state, playerId, withCorpsOnMap(two, 'kienmayer', true))).toBe(false)
    })

    it('offers the whole army as one stack per face, strongest infantry first', () => {
        const { state, playerId, setup } = frenchToSetUp()
        const stacks = unassignedStacks(state, playerId, setup)
        expect(
            stacks.map(({ face, unitIds }) => [
                face.type,
                face.strength,
                face.guard === true,
                unitIds.length
            ])
        ).toEqual([
            [UnitType.Infantry, 3, true, 2],
            [UnitType.Infantry, 3, false, 7],
            [UnitType.Infantry, 2, false, 16],
            [UnitType.Cavalry, 3, false, 3],
            [UnitType.Cavalry, 2, false, 5],
            [UnitType.Artillery, 1, false, 3]
        ])
    })
})

describe('what a corps still needs and can take', () => {
    it('needs its minimum while empty and one unit fewer for each that joins', () => {
        const { state, playerId, setup } = frenchToSetUp()
        expect(cardOf(state, playerId, setup, 'lannes').stillNeeded).toBe(4)
        const [first, second] = unitIdsOf(state, playerId)
        const joined = joining(setup, 'lannes', [first, second])
        expect(cardOf(state, playerId, joined, 'lannes').stillNeeded).toBe(2)
        expect(cardOf(state, playerId, withUnitReturned(joined, first), 'lannes').stillNeeded).toBe(
            3
        )
    })

    it('takes eight units and no more', () => {
        const { state, playerId, setup } = frenchToSetUp()
        const units = unitIdsOf(state, playerId)
        const full = joining(setup, 'lannes', units.slice(0, MAX_CORPS_UNITS))
        expect(cardOf(state, playerId, full, 'lannes').room).toBe(0)
        expect(fits(state, playerId, withUnitJoining(full, units[MAX_CORPS_UNITS], 'lannes'))).toBe(
            false
        )
    })

    it('takes no more than its set-up locale holds', () => {
        const { state, playerId, setup } = frenchToSetUp()
        const capacity = setupLocaleOf(state.map, 'legrand').capacity
        expect(capacity).toBeLessThan(MAX_CORPS_UNITS)
        expect(cardOf(state, playerId, setup, 'legrand').room).toBe(capacity)

        const units = unitIdsOf(state, playerId)
        const full = joining(setup, 'legrand', units.slice(0, capacity))
        expect(cardOf(state, playerId, full, 'legrand').room).toBe(0)
        expect(fits(state, playerId, withUnitJoining(full, units[capacity], 'legrand'))).toBe(false)
    })

    it('has less room in its locale for every unit detached into it', () => {
        const { state, playerId, setup } = frenchToSetUp()
        const home = setupLocaleOf(state.map, 'legrand')
        const [first] = unitIdsOf(state, playerId)
        const posted = withUnitDetached(setup, first, { locale: home.id })
        expect(cardOf(state, playerId, posted, 'legrand').room).toBe(home.capacity - 1)
    })

    it('is not limited by a locale while it waits off the map', () => {
        const { state, playerId, setup } = frenchToSetUp()
        expect(cardOf(state, playerId, setup, 'davout').room).toBe(MAX_CORPS_UNITS)
    })
})

describe('units set up on their own', () => {
    it('may stand within two locales of a corps on the map, clear of the Allied objectives and the enemy', () => {
        const { state, playerId, setup } = frenchToSetUp()
        const [unitId] = unitIdsOf(state, playerId)
        const homes = setup.corps
            .filter((corps) => !corps.offMap)
            .map((corps) => setupLocaleOf(state.map, corps.commanderId).id)
        const posts = detachedPosts(state, playerId, setup, unitId)

        expect(posts.length).toBeGreaterThan(homes.length)
        for (const post of posts) {
            const { locale } = post.position
            expect(post.kind).toBe(TargetKind.Reserve)
            expect(homes.some((home) => (state.map.distance(home, locale) ?? Infinity) <= 2)).toBe(
                true
            )
            expect(nearAlliedObjective(state, locale)).toBe(false)
            expect(state.isEnemyOccupied(locale, playerId)).toBe(false)
        }
    })

    it('are placed without first joining a corps, and count as coming from the nearest commander', () => {
        const { state, playerId, setup } = frenchToSetUp()
        const [unitId] = unitIdsOf(state, playerId)
        const home = setupLocaleOf(state.map, 'st-hilaire').id
        const posted = withUnitDetached(setup, unitId, { locale: home })

        expect(posted.corps.every((corps) => corps.unitIds.length === 0)).toBe(true)
        expect(creditsOf(state, playerId, posted)).toEqual([
            { unitId, commanderId: 'st-hilaire', isDetachment: true }
        ])
    })

    it('number six at most', () => {
        const { state, playerId, setup } = frenchToSetUp()
        const units = unitIdsOf(state, playerId)
        const home = setupLocaleOf(state.map, 'murat').id
        const six = units
            .slice(0, MAX_FRENCH_DETACHMENTS)
            .reduce((posted, unitId) => withUnitDetached(posted, unitId, { locale: home }), setup)

        expect(fits(state, playerId, six)).toBe(true)
        expect(detachmentsUsed(state, playerId, six)).toBe(MAX_FRENCH_DETACHMENTS)
        expect(detachedPosts(state, playerId, six, units[MAX_FRENCH_DETACHMENTS])).toEqual([])
    })

    it('turn within their locale: to any approach, and back to reserve from one', () => {
        const { state, playerId, setup } = frenchToSetUp()
        const [unitId] = unitIdsOf(state, playerId)
        const home = setupLocaleOf(state.map, 'murat').id
        const approaches = state.map.passableApproachesOf(home)
        const inReserve = withUnitDetached(setup, unitId, { locale: home })
        expect(postStances(state.map, inReserve, unitId).map((target) => target.kind)).toEqual(
            approaches.map(() => TargetKind.Approach)
        )

        const blocking = withUnitDetached(inReserve, unitId, {
            locale: home,
            approach: approaches[0].id
        })
        expect(blocking.detached).toHaveLength(1)
        expect(postStances(state.map, blocking, unitId).map((target) => target.kind)).toEqual([
            TargetKind.Reserve,
            ...approaches.slice(1).map(() => TargetKind.Approach)
        ])
    })

    it('bring a thin corps up to its minimum once no other unit is left to do it', () => {
        const { state, playerId } = frenchToSetUp()
        const suggested = setupFrom(state, suggestedDeployment(state, Side.French))
        const corps = suggested.corps.find((entry) => entry.commanderId === 'st-hilaire')
        assertExists(corps, 'St. Hilaire leads a corps')
        const [kept, ...sent] = corps.unitIds
        const home = setupLocaleOf(state.map, 'st-hilaire').id
        const thin = sent.reduce(
            (posted, unitId) => withUnitDetached(posted, unitId, { locale: home }),
            suggested
        )

        const card = cardOf(state, playerId, thin, 'st-hilaire')
        expect(card.unitIds).toEqual([kept])
        expect(card.creditedIds).toEqual(sent.slice(0, 2))
        expect(card.stillNeeded).toBe(0)
        expect(setupProblem(state, playerId, thin)).toBeUndefined()
    })

    it('never leave a corps with no unit of its own', () => {
        const { state, playerId, setup } = frenchToSetUp()
        const home = setupLocaleOf(state.map, 'murat').id
        const posted = unitIdsOf(state, playerId)
            .slice(0, 4)
            .reduce((all, unitId) => withUnitDetached(all, unitId, { locale: home }), setup)
        expect(cardOf(state, playerId, posted, 'murat').stillNeeded).toBeGreaterThan(0)
    })
})

describe('the fixed battery', () => {
    it('blocks an approach of a corps’s own locale without being one of the six detachments', () => {
        const { state, playerId, setup } = frenchToSetUp()
        const [battery] = unitIdsOf(state, playerId, UnitType.Artillery)
        const home = setupLocaleOf(state.map, 'lannes').id
        const [approach] = state.map.passableApproachesOf(home)
        const posted = withFixedBatteryPosted(setup, battery, {
            locale: home,
            approach: approach.id
        })

        expect(creditsOf(state, playerId, posted)).toEqual([
            { unitId: battery, commanderId: 'lannes', isDetachment: false }
        ])
        expect(detachmentsUsed(state, playerId, posted)).toBe(0)
    })

    it('is a detachment when it stands in any other locale', () => {
        const { state, playerId, setup } = frenchToSetUp()
        const [battery] = unitIdsOf(state, playerId, UnitType.Artillery)
        const home = setupLocaleOf(state.map, 'lannes').id
        const elsewhere = fixedBatteryPosts(state, playerId, setup, battery).find(
            (post) => state.map.distance(home, post.position.locale) === 1
        )
        assertExists(elsewhere, 'The fixed battery may stand next to Lannes')
        const [approach] = state.map.passableApproachesOf(elsewhere.position.locale)
        const posted = withFixedBatteryPosted(setup, battery, {
            locale: elsewhere.position.locale,
            approach: approach.id
        })
        expect(detachmentsUsed(state, playerId, posted)).toBe(1)
    })

    it('may stand in the set-up locale of every corps on the map', () => {
        const { state, playerId, setup } = frenchToSetUp()
        const [battery] = unitIdsOf(state, playerId, UnitType.Artillery)
        const offered = fixedBatteryPosts(state, playerId, setup, battery).map(
            (post) => post.position.locale
        )
        for (const corps of setup.corps.filter((entry) => !entry.offMap)) {
            expect(offered).toContain(setupLocaleOf(state.map, corps.commanderId).id)
        }
    })

    it('has to block an approach, so it turns only from one approach to another', () => {
        const { state, playerId, setup } = frenchToSetUp()
        const [battery] = unitIdsOf(state, playerId, UnitType.Artillery)
        const home = setupLocaleOf(state.map, 'lannes').id
        const [approach] = state.map.passableApproachesOf(home)
        const blocking = withFixedBatteryPosted(setup, battery, {
            locale: home,
            approach: approach.id
        })
        expect(
            postStances(state.map, blocking, battery).every(
                (target) => target.kind === TargetKind.Approach
            )
        ).toBe(true)
    })

    it('gives way to the artillery unit named after it', () => {
        const { state, playerId, setup } = frenchToSetUp()
        const [first, second] = unitIdsOf(state, playerId, UnitType.Artillery)
        const home = setupLocaleOf(state.map, 'lannes').id
        const replaced = withFixedBatteryPosted(
            withFixedBatteryPosted(setup, first, { locale: home }),
            second,
            { locale: home }
        )
        expect(replaced.fixedBatteryId).toBe(second)
        expect(replaced.detached.map((entry) => entry.unitId)).toEqual([second])
    })

    it('stands on the Santon, in reserve and as a detachment, when the Santon rule is in use', () => {
        const { state, playerId, setup } = frenchToSetUp({ santon: true })
        const [battery] = unitIdsOf(state, playerId, UnitType.Artillery)
        const posted = withFixedBatteryOnTheSanton(setup, battery)

        expect(posted.detached).toEqual([{ unitId: battery, position: { locale: SANTON_LOCALE } }])
        expect(fits(state, playerId, posted)).toBe(true)
        expect(detachmentsUsed(state, playerId, posted)).toBe(1)
    })
})

describe('where a corps stands', () => {
    it('is in reserve at first, with every approach of its own locale to choose from', () => {
        const { state, setup } = frenchToSetUp()
        const home = setupLocaleOf(state.map, 'lannes').id
        const targets = stanceTargets(state.map, setup, 'lannes')
        expect(targets.map((target) => target.position.locale)).toEqual(
            state.map.passableApproachesOf(home).map(() => home)
        )

        const [approach] = state.map.passableApproachesOf(home)
        const blocking = withCorpsStance(setup, 'lannes', approach.id)
        expect(stanceTargets(state.map, blocking, 'lannes')[0].kind).toBe(TargetKind.Reserve)
        expect(withCorpsStance(blocking, 'lannes', undefined)).toEqual(setup)
    })

    it('is nowhere on the map for a corps held off it', () => {
        const { state, setup } = frenchToSetUp()
        expect(stanceTargets(state.map, setup, 'davout')).toEqual([])
    })
})

describe('a finished set-up', () => {
    it('deploys by the rules and stands on the map exactly as it was shown, however the blocks are dealt', () => {
        for (const santon of [true, false]) {
            for (const scenario of Object.values(Scenario)) {
                for (let deal = 0; deal < 8; deal++) {
                    const seed = (deal * 2654435761).toString(16).padStart(32, '0').slice(-32)
                    const game = new TestGame({ santon, scenario }, seed)
                    for (const side of [Side.Allied, Side.French]) {
                        const state = game.hydrated
                        const playerId = game.playerOf(side)
                        const setup = setupFrom(state, suggestedDeployment(state, side))
                        const context = `${side}, santon ${santon}, ${scenario}, seed ${seed}`

                        expect(fits(state, playerId, setup), context).toBe(true)
                        expect(setupProblem(state, playerId, setup), context).toBeUndefined()

                        const deployed = copyOf(state)
                        deployArmy(deployed, playerId, deploymentOf(state, playerId, setup))
                        const shown = arrayedArmy(state, playerId, setup)
                        for (const unit of deployed.unitsOf(playerId)) {
                            const preview = shown.unit(unit.id)
                            expect(preview.position, `${context}, ${unit.id}`).toEqual(
                                unit.position
                            )
                            expect(preview.commanderId, `${context}, ${unit.id}`).toBe(
                                unit.commanderId
                            )
                        }
                        for (const commander of commandersOf(side)) {
                            expect(shown.commander(commander.id).position, context).toEqual(
                                deployed.commander(commander.id).position
                            )
                        }
                        game.deploy(side)
                    }
                }
            }
        }
    })

    it('says in the rules’ words what is still wrong once every unit is placed', () => {
        const { state, playerId } = frenchToSetUp()
        const suggested = setupFrom(state, suggestedDeployment(state, Side.French))
        const battery = suggested.fixedBatteryId
        assertExists(battery, 'The suggested French set-up names a fixed battery')
        const unnamed = withUnitJoining(suggested, battery, 'lannes')
        expect(setupProblem(state, playerId, unnamed)).toBe(
            'The French name one battery on the map as their fixed battery'
        )
    })
})
