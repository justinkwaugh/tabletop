import { assertExists } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { MAX_CORPS_UNITS, Side, UnitType, commanderDefinition } from '../components/pieces.js'
import { Scenario } from '../components/timeTrack.js'
import { TestGame } from '../testing/harness.js'
import { suggestedDeployment } from '../testing/suggestedDeployment.js'
import type { HydratedNapoleonsTriumphGameState } from './gameState.js'
import { whyIllegal } from './legality.js'
import { faceOf } from './pieces.js'
import {
    MAX_FRENCH_DETACHMENTS,
    deployArmy,
    nearAlliedObjective,
    type CorpsDeployment,
    type Deployment
} from './setup.js'

interface SetUp {
    state: HydratedNapoleonsTriumphGameState
    playerId: string
    deployment: Deployment
}

function setUp(side: Side, config = {}): SetUp {
    const game = new TestGame(config)
    if (side === Side.French) {
        game.deploy(Side.Allied)
    }
    const state = game.hydrated
    return { state, playerId: game.playerOf(side), deployment: suggestedDeployment(state, side) }
}

function problemWith({ state, playerId, deployment }: SetUp): string | undefined {
    return whyIllegal(() => deployArmy(state, playerId, deployment))
}

function corpsOf(deployment: Deployment, commanderId: string): CorpsDeployment {
    const corps = deployment.corps.find((entry) => entry.commanderId === commanderId)
    assertExists(corps, `${commanderId} leads no corps`)
    return corps
}

function moveUnits(deployment: Deployment, from: string, to: string, count: number) {
    corpsOf(deployment, to).unitIds.push(...corpsOf(deployment, from).unitIds.splice(0, count))
}

function homeOf(state: HydratedNapoleonsTriumphGameState, commanderId: string): number {
    const locale = state.map.setupLocale(commanderId)
    assertExists(locale, `${commanderId} has no set-up locale`)
    return locale.id
}

describe('rule 6: assigning units to commanders', () => {
    it('accepts a set-up that gives every commander at least his minimum', () => {
        expect(problemWith(setUp(Side.Allied))).toBeUndefined()
        expect(problemWith(setUp(Side.French))).toBeUndefined()
    })

    it('rejects a corps below the minimum printed for its commander', () => {
        const allied = setUp(Side.Allied)
        const short = corpsOf(allied.deployment, 'kienmayer').unitIds.length - 2
        moveUnits(allied.deployment, 'kienmayer', 'bagration', short)
        expect(corpsOf(allied.deployment, 'kienmayer').unitIds).toHaveLength(
            commanderDefinition('kienmayer').minimumUnits - 1
        )
        expect(problemWith(allied)).toBe('Kienmayer leads between 3 and 8 units')
    })

    it('rejects a corps of more than eight units', () => {
        const allied = setUp(Side.Allied)
        moveUnits(allied.deployment, 'langeron', 'bagration', 1)
        moveUnits(allied.deployment, 'dokhturov', 'bagration', 1)
        moveUnits(allied.deployment, 'constantine', 'bagration', 1)
        expect(corpsOf(allied.deployment, 'bagration').unitIds).toHaveLength(MAX_CORPS_UNITS)
        expect(problemWith(allied)).toBeUndefined()

        moveUnits(allied.deployment, 'miloradovich', 'bagration', 1)
        expect(problemWith(allied)).toBe('Bagration leads between 4 and 8 units')
    })

    it('rejects a unit left with no commander, or given to two', () => {
        const unassigned = setUp(Side.Allied)
        corpsOf(unassigned.deployment, 'bagration').unitIds.pop()
        expect(problemWith(unassigned)).toBe(
            'Every unit of the army is assigned to exactly one corps'
        )

        const twice = setUp(Side.Allied)
        const [shared] = corpsOf(twice.deployment, 'bagration').unitIds
        corpsOf(twice.deployment, 'langeron').unitIds.push(shared)
        expect(problemWith(twice)).toBe('Every unit of the army is assigned to exactly one corps')
    })

    it('rejects more units in a set-up locale than it holds', () => {
        const allied = setUp(Side.Allied)
        const capacity = allied.state.map.locale(homeOf(allied.state, 'kienmayer')).capacity
        expect(capacity).toBeLessThan(MAX_CORPS_UNITS)
        const kienmayer = corpsOf(allied.deployment, 'kienmayer')
        moveUnits(allied.deployment, 'bagration', 'kienmayer', 1)
        expect(kienmayer.unitIds).toHaveLength(capacity)
        expect(problemWith(allied)).toBeUndefined()

        moveUnits(allied.deployment, 'langeron', 'kienmayer', 1)
        expect(problemWith(allied)).toBe(
            `Locale ${homeOf(allied.state, 'kienmayer')} cannot hold that many units`
        )
    })

    it('lets a corps set up blocking an approach of its own locale, and no other', () => {
        const allied = setUp(Side.Allied)
        const home = homeOf(allied.state, 'langeron')
        const [own] = allied.state.map.passableApproachesOf(home)
        corpsOf(allied.deployment, 'langeron').approach = own.id
        expect(problemWith(allied)).toBeUndefined()

        const [foreign] = allied.state.map.passableApproachesOf(homeOf(allied.state, 'bagration'))
        corpsOf(allied.deployment, 'langeron').approach = foreign.id
        expect(problemWith(allied)).toBe('Langeron sets up in its own locale')
    })

    it('starts exactly two Allied corps on the map on 1 December', () => {
        const allied = setUp(Side.Allied, { scenario: Scenario.December1 })
        expect(allied.deployment.corps.filter((corps) => !corps.offMap)).toHaveLength(2)
        expect(problemWith(allied)).toBeUndefined()

        const held = allied.deployment.corps.find((corps) => corps.offMap)
        assertExists(held, 'Some Allied corps wait off the map on 1 December')
        delete held.offMap
        expect(problemWith(allied)).toBe('Two Allied corps start on the map on 1 December')
    })

    it('gives each French reinforcement corps a unit that is not two-strength infantry', () => {
        const french = setUp(Side.French)
        const isLine = (unitId: string) => {
            const face = faceOf(french.state.unit(unitId))
            return face.type === UnitType.Infantry && face.strength === 2
        }
        const davout = corpsOf(french.deployment, 'davout')
        const onMap = french.deployment.corps.filter((corps) => !corps.offMap)
        for (const [index, unitId] of davout.unitIds.entries()) {
            if (isLine(unitId)) {
                continue
            }
            const donor = onMap.find((corps) => corps.unitIds.some(isLine))
            assertExists(donor, 'Some corps on the map has line infantry to give')
            const given = donor.unitIds.findIndex(isLine)
            davout.unitIds[index] = donor.unitIds[given]
            donor.unitIds[given] = unitId
        }
        expect(davout.unitIds.every(isLine)).toBe(true)
        expect(problemWith(french)).toBe('Davout needs a unit other than two-strength infantry')
    })
})

describe('rule 6: French detachments', () => {
    function detachable(french: SetUp, commanderId: string): string {
        const unitId = corpsOf(french.deployment, commanderId).unitIds.find(
            (id) => id !== french.deployment.fixedBattery?.unitId
        )
        assertExists(unitId, `${commanderId} has a unit to detach`)
        return unitId
    }

    it('lets a unit stand on its own within two locales of its commander', () => {
        const french = setUp(Side.French)
        const home = homeOf(french.state, 'murat')
        const twoAway = french.state.map.allLocales.find(
            (locale) =>
                french.state.map.distance(home, locale.id) === 2 &&
                !nearAlliedObjective(french.state, locale.id) &&
                !french.state.isEnemyOccupied(locale.id, french.playerId)
        )
        assertExists(twoAway, 'Some open locale lies two from Murat')
        french.deployment.detachments.push({
            unitId: detachable(french, 'murat'),
            position: { locale: twoAway.id }
        })
        expect(problemWith(french)).toBeUndefined()
    })

    it('rejects one three locales away', () => {
        const french = setUp(Side.French)
        const home = homeOf(french.state, 'murat')
        const threeAway = french.state.map.allLocales.find(
            (locale) =>
                french.state.map.distance(home, locale.id) === 3 &&
                !nearAlliedObjective(french.state, locale.id)
        )
        assertExists(threeAway, 'Some locale lies three from Murat')
        french.deployment.detachments.push({
            unitId: detachable(french, 'murat'),
            position: { locale: threeAway.id }
        })
        expect(problemWith(french)).toBe('A detachment stays within two locales of its commander')
    })

    it('rejects a seventh', () => {
        const french = setUp(Side.French)
        const detached = french.deployment.corps
            .filter((corps) => !corps.offMap)
            .flatMap((corps) =>
                corps.unitIds
                    .filter((id) => id !== french.deployment.fixedBattery?.unitId)
                    .slice(0, 2)
                    .map((unitId) => ({
                        unitId,
                        position: { locale: homeOf(french.state, corps.commanderId) }
                    }))
            )
        french.deployment.detachments.push(...detached.slice(0, MAX_FRENCH_DETACHMENTS))
        expect(problemWith(french)).toBeUndefined()

        french.deployment.detachments.push(detached[MAX_FRENCH_DETACHMENTS])
        expect(problemWith(french)).toBe('At most six units are detached')
    })

    it('counts a detached unit towards the minimum of the commander it left, who keeps at least one', () => {
        const french = setUp(Side.French)
        const home = homeOf(french.state, 'murat')
        const [kept, ...sent] = corpsOf(french.deployment, 'murat').unitIds
        french.deployment.detachments.push(
            ...sent.map((unitId) => ({ unitId, position: { locale: home } }))
        )
        expect(problemWith(french)).toBeUndefined()

        french.deployment.detachments.push({ unitId: kept, position: { locale: home } })
        expect(problemWith(french)).toBe('A commander cannot detach its last unit')
    })

    it('checks the capacity of a set-up locale only after the detachments', () => {
        const french = setUp(Side.French)
        const legrand = corpsOf(french.deployment, 'legrand')
        const capacity = french.state.map.locale(homeOf(french.state, 'legrand')).capacity
        expect(legrand.unitIds).toHaveLength(capacity)
        moveUnits(french.deployment, 'bessieres', 'legrand', 1)
        expect(problemWith(french)).toContain('cannot hold that many units')

        const away = french.state.map
            .adjacentLocales(homeOf(french.state, 'legrand'))
            .find(
                (locale) =>
                    !nearAlliedObjective(french.state, locale) &&
                    !french.state.isEnemyOccupied(locale, french.playerId)
            )
        assertExists(away, 'Some open locale lies next to Legrand')
        french.deployment.detachments.push({
            unitId: legrand.unitIds[0],
            position: { locale: away }
        })
        expect(problemWith(french)).toBeUndefined()
    })

    it('keeps them out of the Allied objective locales and the locales next to them', () => {
        const french = setUp(Side.French)
        const barred = french.deployment.corps
            .filter((corps) => !corps.offMap)
            .flatMap((corps) => {
                const home = homeOf(french.state, corps.commanderId)
                return french.state.map.allLocales
                    .filter(
                        (locale) =>
                            (french.state.map.distance(home, locale.id) ?? Infinity) <= 2 &&
                            nearAlliedObjective(french.state, locale.id) &&
                            !french.state.isEnemyOccupied(locale.id, french.playerId)
                    )
                    .map((locale) => ({ commanderId: corps.commanderId, locale: locale.id }))
            })
        const [first] = barred
        assertExists(first, 'Some French corps sets up within two locales of an Allied objective')
        french.deployment.detachments.push({
            unitId: detachable(french, first.commanderId),
            position: { locale: first.locale }
        })
        expect(problemWith(french)).toBe('Detachments keep clear of the Allied objectives')
    })

    it('belongs to the French alone', () => {
        const allied = setUp(Side.Allied)
        allied.deployment.detachments.push({
            unitId: corpsOf(allied.deployment, 'bagration').unitIds[0],
            position: { locale: homeOf(allied.state, 'bagration') }
        })
        expect(problemWith(allied)).toBe('Only the French detach units during set-up')
    })
})

describe('rule 6: the French fixed battery', () => {
    it('has to be named while artillery stands on the map', () => {
        const french = setUp(Side.French)
        delete french.deployment.fixedBattery
        expect(problemWith(french)).toBe(
            'The French name one battery on the map as their fixed battery'
        )
    })

    it('blocks an approach of its set-up locale without being detached, and is shown to both players', () => {
        const french = setUp(Side.French)
        const battery = french.deployment.fixedBattery
        assertExists(battery?.approach, 'The suggested fixed battery blocks an approach')
        deployArmy(french.state, french.playerId, french.deployment)
        const unit = french.state.unit(battery.unitId)

        expect(french.deployment.detachments).toEqual([])
        expect(unit.fixed).toBe(true)
        expect(unit.position?.approach).toBe(battery.approach)
        expect(unit.commanderId).toBeUndefined()
        expect(unit.shown).toEqual(unit.face)
    })

    it('cannot stay in reserve', () => {
        const french = setUp(Side.French)
        const battery = french.deployment.fixedBattery
        assertExists(battery, 'The suggested French set-up names a fixed battery')
        delete battery.approach
        expect(problemWith(french)).toBe('The fixed battery blocks an approach')
    })
})
