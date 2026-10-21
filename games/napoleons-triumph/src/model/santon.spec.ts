import { assertExists, type GameConfig } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { AUSTERLITZ, SANTON_LOCALE } from '../components/austerlitz.js'
import { Side } from '../components/pieces.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import {
    TestGame,
    alliedTurn,
    artillery,
    assault,
    cavalry,
    frenchTurn,
    infantry,
    type PiecePlacement,
    defendWith
} from '../testing/harness.js'
import { CommandKind, type MoveOrder } from './attack.js'
import { FeintEnd } from './attackDeclaration.js'
import { setupLocaleOf, type Deployment } from './setup.js'

const NEIGHBOURS = [41, 42, 64]
const BELOW = 64
const ANOTHER_SIDE = 41

const santonRule = { santon: true }

const approach = (from: number, to: number) => AUSTERLITZ.approachBetween(from, to).id
const unitMove = (unitId: string): MoveOrder => ({ kind: CommandKind.Unit, unitIds: [unitId] })

const battery: PiecePlacement = {
    id: 'F-fixed',
    side: Side.French,
    face: artillery(),
    locale: SANTON_LOCALE
}

function fixBattery(game: TestGame): TestGame {
    game.arrange((state) => {
        state.unit('F-fixed').fixed = true
    })
    return game
}

function allied(id: string, face: PiecePlacement['face'], locale = BELOW): PiecePlacement {
    return { id, side: Side.Allied, face, locale }
}

function threaten(game: TestGame, side: Side, from: number, into: number) {
    return game.act(ActionType.ThreatenAttack, game.playerOf(side), {
        approach: approach(from, into)
    })
}

describe('setting up the fixed battery on the Santon (rules 6 and 18)', () => {
    function detachedToTheSanton(facing?: number) {
        return (deployment: Deployment) => {
            const named = deployment.fixedBattery
            assertExists(named, 'The suggested deployment names a fixed battery')
            const lannes = deployment.corps.find((corps) => corps.commanderId === 'lannes')
            const home = deployment.corps.find((corps) => corps.unitIds.includes(named.unitId))
            assertExists(lannes, 'Lannes leads a corps')
            assertExists(home, 'The battery is assigned to a corps')
            if (home !== lannes) {
                const [exchanged] = lannes.unitIds
                home.unitIds = home.unitIds.map((id) => (id === named.unitId ? exchanged : id))
                lannes.unitIds = lannes.unitIds.map((id) => (id === exchanged ? named.unitId : id))
            }
            deployment.detachments = [{ unitId: named.unitId, position: { locale: SANTON_LOCALE } }]
            deployment.fixedBattery =
                facing === undefined
                    ? { unitId: named.unitId }
                    : { unitId: named.unitId, approach: approach(SANTON_LOCALE, facing) }
        }
    }

    function fixedBatteryOf(game: TestGame) {
        const fixed = game.hydrated.units.find((unit) => unit.fixed)
        assertExists(fixed, 'A fixed battery was named')
        return fixed
    }

    it('puts it in reserve when the Santon rule is in use', () => {
        const game = new TestGame(santonRule)
        game.deploy(Side.Allied)
        expect(() => game.deploy(Side.French, detachedToTheSanton(BELOW))).toThrow(/in reserve/)
        game.deploy(Side.French, detachedToTheSanton())
        const fixed = fixedBatteryOf(game)
        expect(game.state.machineState).toBe(MachineState.Commanding)
        expect(fixed.position).toEqual({ locale: SANTON_LOCALE })
        expect(fixed.commanderId).toBeUndefined()
        expect(fixed.shown).toEqual(artillery())
    })

    it('may set up elsewhere, on an approach as usual, when the Santon rule is in use', () => {
        const game = new TestGame(santonRule)
        game.deploy(Side.Allied)
        const elsewhere = (approachIndex?: number) => (deployment: Deployment) => {
            const named = deployment.fixedBattery
            assertExists(named, 'The suggested deployment names a fixed battery')
            const home = deployment.corps.find((corps) => corps.unitIds.includes(named.unitId))
            assertExists(home, 'The battery is assigned to a corps')
            const locale = setupLocaleOf(game.hydrated.map, home.commanderId).id
            deployment.detachments = []
            deployment.fixedBattery =
                approachIndex === undefined
                    ? { unitId: named.unitId }
                    : {
                          unitId: named.unitId,
                          approach: game.hydrated.map.passableApproachesOf(locale)[approachIndex].id
                      }
        }
        expect(() => game.deploy(Side.French, elsewhere())).toThrow(/blocks an approach/)
        game.deploy(Side.French, elsewhere(0))
        const fixed = fixedBatteryOf(game)
        expect(fixed.position?.locale).not.toBe(SANTON_LOCALE)
        expect(fixed.position?.approach).toBeDefined()
    })

    it('puts it on an approach, as anywhere else, when the rule is not in use', () => {
        const game = new TestGame()
        game.deploy(Side.Allied)
        expect(() => game.deploy(Side.French, detachedToTheSanton())).toThrow(/blocks an approach/)
        game.deploy(Side.French, detachedToTheSanton(BELOW))
        expect(fixedBatteryOf(game).position).toEqual({
            locale: SANTON_LOCALE,
            approach: approach(SANTON_LOCALE, BELOW)
        })
    })
})

describe('the Santon with the fixed battery set up elsewhere (rule 18)', () => {
    function footOnTheSanton(withTheBattery: boolean): TestGame {
        const foot: PiecePlacement = {
            id: 'F-foot',
            side: Side.French,
            face: infantry(2),
            locale: SANTON_LOCALE
        }
        const fixed: PiecePlacement = withTheBattery
            ? battery
            : { ...battery, locale: ANOTHER_SIDE, facing: SANTON_LOCALE }
        return fixBattery(alliedTurn([foot, fixed, allied('A-lead', infantry(3))], santonRule))
    }

    function climb(game: TestGame): unknown {
        return assault(game, {
            attacker: Side.Allied,
            from: BELOW,
            into: SANTON_LOCALE,
            defenders: ['F-foot'],
            defenseLeaders: ['F-foot'],
            orders: [unitMove('A-lead')],
            leaders: ['A-lead']
        })
    }

    it('gives French infantry in its reserve no slope, as in any other reserve', () => {
        expect(climb(footOnTheSanton(true))).toMatchObject({ initialResult: 0 })
        expect(climb(footOnTheSanton(false))).toMatchObject({
            initialResult: 1,
            attackerWon: true
        })
    })
})

describe('the fixed battery defending from the reserve of the Santon (rule 18)', () => {
    function attacked(
        attackers: readonly PiecePlacement[],
        config: GameConfig = santonRule
    ): TestGame {
        return fixBattery(alliedTurn([battery, ...attackers], config))
    }

    function climb(game: TestGame, orders: MoveOrder[]): unknown {
        return assault(game, {
            attacker: Side.Allied,
            from: BELOW,
            into: SANTON_LOCALE,
            defenders: ['F-fixed'],
            defenseLeaders: ['F-fixed'],
            orders,
            leaders: ['A-lead']
        })
    }

    it.each(NEIGHBOURS)('may lead the defence against an attack from locale %i', (neighbour) => {
        const game = attacked([allied('A-lead', infantry(3), neighbour)])
        threaten(game, Side.Allied, neighbour, SANTON_LOCALE)
        defendWith(game, game.playerOf(Side.French), ['F-fixed'])
        expect(game.state.machineState).toBe(MachineState.FeintDecision)
        game.act(ActionType.PressAttack, game.playerOf(Side.Allied))
        game.act(ActionType.LeadDefense, game.playerOf(Side.French), { leaderIds: ['F-fixed'] })
        expect(game.hydrated.attack?.defenseLeaderIds).toEqual(['F-fixed'])
    })

    it('may not lead from reserve when the rule is not in use', () => {
        const game = attacked([allied('A-lead', infantry(3))], {})
        threaten(game, Side.Allied, BELOW, SANTON_LOCALE)
        defendWith(game, game.playerOf(Side.French), ['F-fixed'])
        game.act(ActionType.PressAttack, game.playerOf(Side.Allied))
        expect(() =>
            game.act(ActionType.LeadDefense, game.playerOf(Side.French), {
                leaderIds: ['F-fixed']
            })
        ).toThrow(/cannot lead/)
    })

    it('has the printed penalty of the slope: three-strength infantry wins by one and takes the guns', () => {
        const game = attacked([allied('A-lead', infantry(3))])
        expect(climb(game, [unitMove('A-lead')])).toMatchObject({
            initialResult: 1,
            attackerWon: true
        })
        const state = game.hydrated
        expect(state.findUnit('F-fixed')).toBeUndefined()
        expect(state.unit('A-lead').face).toEqual(infantry(2))
        expect(state.unit('A-lead').position).toEqual({ locale: SANTON_LOCALE })
        expect(state.playerOf(Side.French).morale).toBe(22)
        expect(state.playerOf(Side.Allied).morale).toBe(27)
    })

    it('does not block the approach: a tie against one unit goes to the French, who lose nothing', () => {
        const game = attacked([allied('A-lead', infantry(2))])
        expect(climb(game, [unitMove('A-lead')])).toMatchObject({
            initialResult: 0,
            attackerWon: false
        })
        const state = game.hydrated
        expect(state.machineState).toBe(MachineState.Commanding)
        expect(state.unit('F-fixed').position).toEqual({ locale: SANTON_LOCALE })
        expect(state.unit('A-lead').face).toEqual(infantry(1))
        expect(state.unit('A-lead').position).toEqual({ locale: BELOW })
        expect(state.playerOf(Side.Allied).morale).toBe(26)
        expect(state.playerOf(Side.French).morale).toBe(23)
    })

    it('loses a tie to greater numbers, and the guns in the retreat that follows', () => {
        const corps = (id: string): PiecePlacement => ({
            ...allied(id, infantry(2)),
            commanderId: 'langeron'
        })
        const game = attacked([corps('A-lead'), corps('A-second')])
        expect(
            climb(game, [
                {
                    kind: CommandKind.Corps,
                    commanderId: 'langeron',
                    unitIds: ['A-lead', 'A-second']
                }
            ])
        ).toMatchObject({ initialResult: 0, attackerWon: true })
        expect(game.hydrated.unit('F-fixed').face).toEqual(artillery())
        expect(game.state.machineState).toBe(MachineState.Retreating)
        game.act(ActionType.Retreat, game.playerOf(Side.French), {
            losses: {},
            destinations: {},
            kept: {}
        })
        const state = game.hydrated
        expect(state.findUnit('F-fixed')).toBeUndefined()
        expect(state.unit('A-second').position).toEqual({ locale: SANTON_LOCALE })
        expect(state.commander('langeron').position).toEqual({ locale: SANTON_LOCALE })
        expect(state.playerOf(Side.French).morale).toBe(22)
    })

    it('defends one approach in a turn, so a second threat from another side takes the hill', () => {
        const game = attacked([
            allied('A-foot', infantry(2)),
            allied('A-horse', cavalry(2), ANOTHER_SIDE)
        ])
        const french = game.playerOf(Side.French)
        const attacker = game.playerOf(Side.Allied)
        threaten(game, Side.Allied, BELOW, SANTON_LOCALE)
        defendWith(game, french, ['F-fixed'])
        game.act(ActionType.DeclareFeint, attacker, {
            orders: [unitMove('A-foot')],
            end: FeintEnd.Reserve
        })
        expect(game.state.machineState).toBe(MachineState.Commanding)
        expect(game.hydrated.unit('F-fixed').position).toEqual({ locale: SANTON_LOCALE })

        threaten(game, Side.Allied, ANOTHER_SIDE, SANTON_LOCALE)
        expect(game.engine.getValidActionTypesForPlayer(game.game, game.state, french)).toEqual([
            ActionType.Retreat
        ])
        expect(() =>
            game.act(ActionType.DeclareDefense, french, { unitIds: ['F-fixed'] })
        ).toThrow()
        game.act(ActionType.Retreat, french, { losses: {}, destinations: {}, kept: {} })
        game.act(ActionType.Occupy, attacker, { orders: [unitMove('A-horse')] })
        const state = game.hydrated
        expect(state.findUnit('F-fixed')).toBeUndefined()
        expect(state.unit('A-horse').position).toEqual({ locale: SANTON_LOCALE })
        expect(state.playerOf(Side.French).morale).toBe(22)
    })
})

describe('other French pieces in the reserve of the Santon (rule 18)', () => {
    const garrison: PiecePlacement = {
        id: 'F-inf',
        side: Side.French,
        face: infantry(2),
        locale: SANTON_LOCALE
    }

    function attackedFromBelow(game: TestGame, defenseLeaders: string[]): unknown {
        return assault(game, {
            attacker: Side.Allied,
            from: BELOW,
            into: SANTON_LOCALE,
            defenders: ['F-inf'],
            defenseLeaders,
            orders: [unitMove('A-lead')],
            leaders: ['A-lead']
        })
    }

    function stormed(game: TestGame): unknown {
        return attackedFromBelow(game, ['F-inf'])
    }

    it('have the slope in their favour while the battery stands there, and step up after holding', () => {
        const game = fixBattery(
            alliedTurn([battery, garrison, allied('A-lead', infantry(3))], santonRule)
        )
        expect(stormed(game)).toMatchObject({ initialResult: 0, attackerWon: false })
        const state = game.hydrated
        expect(state.machineState).toBe(MachineState.Commanding)
        expect(state.unit('F-inf').position).toEqual({
            locale: SANTON_LOCALE,
            approach: approach(SANTON_LOCALE, BELOW)
        })
        expect(state.unit('F-inf').face).toEqual(infantry(1))
        expect(state.unit('F-fixed').position).toEqual({ locale: SANTON_LOCALE })
        expect(state.unit('A-lead').face).toEqual(infantry(2))
        expect(state.playerOf(Side.Allied).morale).toBe(26)
        expect(state.playerOf(Side.French).morale).toBe(23)
    })

    it('lose it once the battery is gone', () => {
        const game = alliedTurn([garrison, allied('A-lead', infantry(3))], santonRule)
        expect(stormed(game)).toMatchObject({ initialResult: 1, attackerWon: true })
        const state = game.hydrated
        expect(state.findUnit('F-inf')).toBeUndefined()
        expect(state.unit('A-lead').position).toEqual({ locale: SANTON_LOCALE })
        expect(state.playerOf(Side.French).morale).toBe(21)
    })

    it('are sheltered from guns firing up the slope for as long as the battery stands there', () => {
        const guns: PiecePlacement = {
            ...allied('A-lead', artillery()),
            facing: SANTON_LOCALE
        }
        const sheltered = fixBattery(alliedTurn([battery, garrison, guns], santonRule))
        expect(attackedFromBelow(sheltered, [])).toMatchObject({ initialResult: 0 })
        expect(sheltered.hydrated.unit('F-inf').face).toEqual(infantry(2))
        expect(sheltered.hydrated.playerOf(Side.French).morale).toBe(23)

        const exposed = alliedTurn([garrison, guns], santonRule)
        expect(attackedFromBelow(exposed, [])).toMatchObject({ initialResult: 1 })
        expect(exposed.hydrated.unit('F-inf').face).toEqual(infantry(1))
        expect(exposed.hydrated.playerOf(Side.French).morale).toBe(22)
    })
})

describe('artillery attacking from the Santon (rule 18)', () => {
    function fire(game: TestGame, into: number, gun: string): unknown {
        return assault(game, {
            attacker: Side.French,
            from: SANTON_LOCALE,
            into,
            defenders: ['A-inf'],
            defenseLeaders: [],
            orders: [unitMove(gun)],
            leaders: [gun]
        })
    }

    it.each(NEIGHBOURS)('lets the fixed battery fire from reserve into locale %i', (neighbour) => {
        const game = fixBattery(
            frenchTurn([battery, allied('A-inf', infantry(2), neighbour)], santonRule)
        )
        expect(fire(game, neighbour, 'F-fixed')).toMatchObject({
            initialResult: 1,
            attackerWon: true
        })
        const state = game.hydrated
        expect(state.unit('A-inf').face).toEqual(infantry(1))
        expect(state.unit('A-inf').position).toEqual({ locale: neighbour })
        expect(state.unit('F-fixed').position).toEqual({ locale: SANTON_LOCALE })
        expect(state.playerOf(Side.Allied).morale).toBe(26)
    })

    it('keeps the fixed battery to the attack approach when the rule is not in use', () => {
        const game = fixBattery(frenchTurn([battery, allied('A-inf', infantry(2))]))
        expect(() => fire(game, BELOW, 'F-fixed')).toThrow(/attack approach/)
    })

    it('lets no other battery there lead an attack or a defence', () => {
        const other: PiecePlacement = {
            id: 'F-art',
            side: Side.French,
            face: artillery(),
            locale: SANTON_LOCALE,
            facing: BELOW
        }
        const attacking = frenchTurn([other, allied('A-inf', infantry(2))], santonRule)
        expect(() => fire(attacking, BELOW, 'F-art')).toThrow(/Santon/)

        const defending = alliedTurn([other, allied('A-inf', infantry(2))], santonRule)
        threaten(defending, Side.Allied, BELOW, SANTON_LOCALE)
        const french = defending.playerOf(Side.French)
        defendWith(defending, french, ['F-art'])
        expect(defending.state.machineState).toBe(MachineState.FeintDecision)
        defending.act(ActionType.PressAttack, defending.playerOf(Side.Allied))
        expect(() =>
            defending.act(ActionType.LeadDefense, french, { leaderIds: ['F-art'] })
        ).toThrow(/Santon/)
        defending.act(ActionType.LeadDefense, french, { leaderIds: [] })
        expect(defending.state.machineState).toBe(MachineState.AttackDeclaration)
    })
})

describe('artillery on the Santon other than the fixed battery (rule 18)', () => {
    it('cannot hold its ground after a retreat before combat, since it could not have led', () => {
        const game = frenchTurn(
            [
                {
                    id: 'F-gun',
                    side: Side.French,
                    face: artillery(),
                    locale: SANTON_LOCALE,
                    facing: BELOW
                },
                allied('A-inf', infantry(3))
            ],
            santonRule
        )
        threaten(game, Side.French, SANTON_LOCALE, BELOW)
        const [refuge] = AUSTERLITZ.reachableNeighbours(BELOW).filter(
            (locale) => locale !== SANTON_LOCALE
        )
        const loss = AUSTERLITZ.approachBetween(BELOW, SANTON_LOCALE).wide ? 2 : 1
        game.act(ActionType.Retreat, game.playerOf(Side.Allied), {
            losses: { 'A-inf': loss },
            destinations: { 'A-inf': refuge },
            kept: {}
        })
        expect(() =>
            game.act(ActionType.Occupy, game.playerOf(Side.French), {
                orders: [unitMove('F-gun')],
                artilleryStays: true
            })
        ).toThrow(/could have led/)
        game.act(ActionType.Occupy, game.playerOf(Side.French), { orders: [unitMove('F-gun')] })
        expect(game.hydrated.unit('F-gun').position).toEqual({ locale: BELOW })
    })
})
