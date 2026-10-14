import { describe, expect, it } from 'vitest'
import { AUSTERLITZ } from '../components/austerlitz.js'
import { Side } from '../components/pieces.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import {
    alliedTurn,
    artillery,
    assault,
    cavalry,
    frenchTurn,
    guard,
    infantry,
    passTurns,
    type PiecePlacement,
    type TestGame,
    defendWith
} from '../testing/harness.js'
import { CommandKind, MoralePenaltyKind } from './attack.js'
import { FeintEnd } from './attackDeclaration.js'
import { VictoryKind } from './gameState.js'

const FROM = 95
const INTO = 108
const REFUGE = 96
const WIDE_FROM = 93
const WIDE_INTO = 94
const VILLAGE = 82
const BELOW_THE_SLOPE = 103

const approach = (from: number, to: number) => AUSTERLITZ.approachBetween(from, to).id
const unitMove = (unitId: string) => ({ kind: CommandKind.Unit, unitIds: [unitId] })

function announce(game: TestGame, side: Side, from: number, into: number, guardUnitId: string) {
    return game.act(ActionType.ThreatenAttack, game.playerOf(side), {
        approach: approach(from, into),
        guardUnitId
    })
}

function morale(game: TestGame, side: Side): number {
    return game.hydrated.playerOf(side).morale
}

describe('announcing a Guard Attack (rule 15)', () => {
    const placements: PiecePlacement[] = [
        { id: 'F-guard', side: Side.French, face: guard(), locale: FROM },
        { id: 'F-line', side: Side.French, face: infantry(3), locale: FROM },
        { id: 'F-far', side: Side.French, face: guard(), locale: WIDE_FROM },
        { id: 'A-inf', side: Side.Allied, face: infantry(2), locale: INTO }
    ]

    it('is made with the threat, by showing a Guard unit that could take part', () => {
        const game = frenchTurn(placements)
        expect(() => announce(game, Side.French, FROM, INTO, 'F-line')).toThrow(/Guard infantry/)
        expect(() => announce(game, Side.French, FROM, INTO, 'A-inf')).toThrow(/Guard infantry/)
        expect(() => announce(game, Side.French, FROM, INTO, 'F-far')).toThrow(/able to make/)

        announce(game, Side.French, FROM, INTO, 'F-guard')
        const state = game.hydrated
        expect(state.machineState).toBe(MachineState.DefenseResponse)
        expect(state.attack?.guardAttack).toBe(true)
        expect(state.unit('F-guard').shown).toEqual(guard())
        expect(state.unit('F-line').shown).toBeUndefined()
    })

    it('does not by itself commit the Guard', () => {
        const game = frenchTurn(placements)
        announce(game, Side.French, FROM, INTO, 'F-guard')
        const french = game.hydrated.playerOf(Side.French)
        expect(french.guardCommitted).toBe(false)
        expect(french.morale).toBe(23)
    })

    it('cannot be made out of an obstructed approach, though the Guard may still attack from there', () => {
        const game = frenchTurn([
            { id: 'F-guard', side: Side.French, face: guard(), locale: VILLAGE },
            { id: 'A-inf', side: Side.Allied, face: infantry(2), locale: WIDE_FROM }
        ])
        expect(AUSTERLITZ.approachBetween(VILLAGE, WIDE_FROM).obstructed).toBe(true)
        expect(() => announce(game, Side.French, VILLAGE, WIDE_FROM, 'F-guard')).toThrow(
            /obstructed/
        )

        const declared = assault(game, {
            attacker: Side.French,
            from: VILLAGE,
            into: WIDE_FROM,
            defenders: ['A-inf'],
            defenseLeaders: ['A-inf'],
            orders: [unitMove('F-guard')],
            leaders: ['F-guard']
        })
        expect(declared).toMatchObject({ initialResult: 1, attackerWon: true })
    })

    it('may be made into an obstructed approach', () => {
        const game = frenchTurn([
            { id: 'F-guard', side: Side.French, face: guard(), locale: WIDE_FROM },
            { id: 'A-inf', side: Side.Allied, face: infantry(2), locale: VILLAGE }
        ])
        expect(AUSTERLITZ.approachBetween(WIDE_FROM, VILLAGE).obstructed).toBe(false)
        expect(AUSTERLITZ.approachBetween(VILLAGE, WIDE_FROM).obstructed).toBe(true)
        announce(game, Side.French, WIDE_FROM, VILLAGE, 'F-guard')
        expect(game.hydrated.attack?.guardAttack).toBe(true)
    })

    it('cannot be turned into a feint once the defender stands', () => {
        const game = frenchTurn(placements)
        announce(game, Side.French, FROM, INTO, 'F-guard')
        defendWith(game, game.playerOf(Side.Allied), ['A-inf'])
        game.act(ActionType.LeadDefense, game.playerOf(Side.Allied), { leaderIds: ['A-inf'] })
        expect(game.state.machineState).toBe(MachineState.AttackDeclaration)
        expect(game.hydrated.unit('A-inf').shown).toEqual(infantry(2))
        expect(() =>
            game.act(ActionType.DeclareFeint, game.playerOf(Side.French), {
                orders: [unitMove('F-guard')],
                end: FeintEnd.Reserve
            })
        ).toThrow()
    })

    it('binds no Guard to follow up when the defender retreats instead', () => {
        const game = frenchTurn([
            { id: 'F-guard', side: Side.French, face: guard(), locale: FROM },
            { id: 'F-line', side: Side.French, face: infantry(3), locale: FROM },
            { id: 'A-cav', side: Side.Allied, face: cavalry(2), locale: INTO }
        ])
        announce(game, Side.French, FROM, INTO, 'F-guard')
        game.act(ActionType.Retreat, game.playerOf(Side.Allied), {
            losses: {},
            destinations: { 'A-cav': REFUGE },
            kept: {}
        })
        game.act(ActionType.Occupy, game.playerOf(Side.French), { orders: [unitMove('F-line')] })
        const state = game.hydrated
        expect(state.machineState).toBe(MachineState.Commanding)
        expect(state.unit('F-line').position).toEqual({ locale: INTO })
        expect(state.unit('F-guard').position).toEqual({ locale: FROM })
        expect(state.playerOf(Side.French).guardCommitted).toBe(false)
        expect(state.playerOf(Side.French).guardAttackForfeited).toBe(false)
        expect(state.playerOf(Side.French).morale).toBe(23)
    })
})

describe('the leading units of a Guard Attack (rule 15)', () => {
    const corps = {
        kind: CommandKind.Corps,
        commanderId: 'lannes',
        unitIds: ['F-guard', 'F-line']
    }

    function declaring(): TestGame {
        const game = frenchTurn([
            {
                id: 'F-guard',
                side: Side.French,
                face: guard(),
                locale: WIDE_FROM,
                commanderId: 'lannes'
            },
            {
                id: 'F-line',
                side: Side.French,
                face: infantry(3),
                locale: WIDE_FROM,
                commanderId: 'lannes'
            },
            { id: 'A-inf', side: Side.Allied, face: infantry(3), locale: WIDE_INTO }
        ])
        announce(game, Side.French, WIDE_FROM, WIDE_INTO, 'F-guard')
        defendWith(game, game.playerOf(Side.Allied), ['A-inf'])
        game.act(ActionType.LeadDefense, game.playerOf(Side.Allied), { leaderIds: ['A-inf'] })
        return game
    }

    function declare(game: TestGame, leaderIds: string[]) {
        return game.outcome(ActionType.DeclareAttack, game.playerOf(Side.French), {
            orders: [corps],
            wide: true,
            leaderIds
        })
    }

    it('must be Guard infantry, and there must be one', () => {
        const game = declaring()
        expect(() => declare(game, ['F-line'])).toThrow(/led by Guard infantry/)
        expect(() => declare(game, [])).toThrow(/Guard leading unit/)
        expect(() => declare(game, ['F-guard', 'F-line'])).toThrow(/cannot be paired/)
    })

    it('may have line troops attacking behind them', () => {
        const game = declaring()
        expect(declare(game, ['F-guard'])).toMatchObject({ initialResult: 0, attackerWon: true })
        expect(game.hydrated.unit('F-guard').face).toEqual(infantry(2))
        expect(game.hydrated.unit('F-line').face).toEqual(infantry(3))
        expect(game.state.machineState).toBe(MachineState.Retreating)
    })
})

describe('the effect of a Guard Attack on the defense leading units (rule 15)', () => {
    function guardAgainst(defenders: readonly PiecePlacement[], leaderId: string): TestGame {
        const game = frenchTurn([
            { id: 'F-guard', side: Side.French, face: guard(), locale: FROM },
            ...defenders
        ])
        announce(game, Side.French, FROM, INTO, 'F-guard')
        defendWith(
            game,
            game.playerOf(Side.Allied),
            defenders.map((defender) => defender.id)
        )
        game.act(ActionType.LeadDefense, game.playerOf(Side.Allied), { leaderIds: [leaderId] })
        return game
    }

    function lead(game: TestGame) {
        return game.outcome(ActionType.DeclareAttack, game.playerOf(Side.French), {
            orders: [unitMove('F-guard')],
            wide: false,
            leaderIds: ['F-guard']
        })
    }

    it('counts a two-strength leading unit as one: the Guard beats two-strength infantry on an approach', () => {
        const game = guardAgainst(
            [{ id: 'A-inf', side: Side.Allied, face: infantry(2), locale: INTO, facing: FROM }],
            'A-inf'
        )
        expect(lead(game)).toMatchObject({ initialResult: 1, finalResult: 1, attackerWon: true })
        const state = game.hydrated
        expect(state.findUnit('A-inf')).toBeUndefined()
        expect(state.unit('F-guard').position).toEqual({ locale: INTO })
        expect(state.playerOf(Side.Allied).morale).toBe(25)
    })

    it('counts a one-strength leading unit as nothing, yet the Guard still pays a step for it', () => {
        const game = guardAgainst(
            [{ id: 'A-inf', side: Side.Allied, face: infantry(1), locale: INTO, facing: FROM }],
            'A-inf'
        )
        expect(lead(game)).toMatchObject({ initialResult: 2, attackerWon: true })
        const state = game.hydrated
        expect(state.unit('F-guard').face).toEqual(infantry(2))
        expect(state.findUnit('A-inf')).toBeUndefined()
        expect(state.playerOf(Side.Allied).morale).toBe(26)
    })

    it('does not weaken the units that counter-attack', () => {
        const game = guardAgainst(
            [
                { id: 'A-lead', side: Side.Allied, face: infantry(2), locale: INTO, facing: FROM },
                {
                    id: 'A-counter',
                    side: Side.Allied,
                    face: infantry(2),
                    locale: INTO,
                    facing: FROM
                },
                { id: 'A-art', side: Side.Allied, face: artillery(), locale: INTO, facing: FROM }
            ],
            'A-lead'
        )
        expect(lead(game)).toMatchObject({ initialResult: 1 })
        expect(game.state.machineState).toBe(MachineState.CounterAttackDecision)
        const countered = game.outcome(ActionType.CounterAttack, game.playerOf(Side.Allied), {
            unitIds: ['A-counter']
        })
        expect(countered).toMatchObject({ finalResult: 0, attackerWon: false })
        const state = game.hydrated
        expect(state.unit('A-lead').face).toEqual(infantry(1))
        expect(state.unit('A-counter').face).toEqual(infantry(1))
        expect(state.unit('F-guard').face).toEqual(infantry(2))
        expect(state.unit('F-guard').position).toEqual({ locale: FROM })
        expect(state.playerOf(Side.Allied).morale).toBe(27)
    })

    it('counts a leading battery as nothing, though it still spares the defender a loss', () => {
        const game = guardAgainst(
            [
                { id: 'A-art', side: Side.Allied, face: artillery(), locale: INTO, facing: FROM },
                { id: 'A-inf', side: Side.Allied, face: infantry(3), locale: INTO, facing: FROM }
            ],
            'A-art'
        )
        const allied = game.playerOf(Side.Allied)
        expect(lead(game)).toMatchObject({ initialResult: 2 })
        game.act(ActionType.CounterAttack, allied, { unitIds: [] })
        expect(() =>
            game.act(ActionType.AssignLosses, allied, { allocation: { 'A-inf': 3 } })
        ).toThrow()
        game.act(ActionType.AssignLosses, allied, { allocation: { 'A-inf': 2 } })
        const state = game.hydrated
        expect(state.unit('A-inf').face).toEqual(infantry(1))
        expect(state.unit('A-art').face).toEqual(artillery())
        expect(state.unit('F-guard').face).toEqual(infantry(2))
        expect(state.playerOf(Side.Allied).morale).toBe(25)
        expect(state.machineState).toBe(MachineState.Retreating)
    })

    it('counts each of two two-strength leading units as one across a wide approach', () => {
        const guards = ['F-guard', 'F-second']
        const defenders = ['A-1', 'A-2']
        const game = frenchTurn([
            ...guards.map((id): PiecePlacement => ({
                id,
                side: Side.French,
                face: guard(),
                locale: WIDE_FROM,
                commanderId: 'lannes'
            })),
            ...defenders.map((id): PiecePlacement => ({
                id,
                side: Side.Allied,
                face: infantry(2),
                locale: WIDE_INTO,
                facing: WIDE_FROM
            }))
        ])
        const declared = assault(game, {
            attacker: Side.French,
            from: WIDE_FROM,
            into: WIDE_INTO,
            guardUnitId: 'F-guard',
            defenders,
            defenseLeaders: defenders,
            orders: [{ kind: CommandKind.Corps, commanderId: 'lannes', unitIds: guards }],
            wide: true,
            leaders: guards
        })
        expect(declared).toMatchObject({ initialResult: 3, attackerWon: true })
        const state = game.hydrated
        expect(guards.map((id) => state.unit(id).face)).toEqual([infantry(2), infantry(2)])
        expect(guards.map((id) => state.unit(id).position)).toEqual([
            { locale: WIDE_INTO },
            { locale: WIDE_INTO }
        ])
        expect(defenders.map((id) => state.findUnit(id))).toEqual([undefined, undefined])
        expect(state.playerOf(Side.Allied).morale).toBe(23)
        expect(state.playerOf(Side.French).morale).toBe(19)
    })
})

describe('a Guard Attack that is defeated (rule 15)', () => {
    function beatenOnTheSlope(): TestGame {
        const game = frenchTurn([
            { id: 'F-guard', side: Side.French, face: guard(), locale: BELOW_THE_SLOPE },
            { id: 'F-other', side: Side.French, face: guard(), locale: FROM },
            {
                id: 'A-inf',
                side: Side.Allied,
                face: infantry(2),
                locale: WIDE_FROM,
                facing: BELOW_THE_SLOPE
            },
            { id: 'A-far', side: Side.Allied, face: infantry(2), locale: INTO, facing: FROM }
        ])
        const declared = assault(game, {
            attacker: Side.French,
            from: BELOW_THE_SLOPE,
            into: WIDE_FROM,
            guardUnitId: 'F-guard',
            defenders: ['A-inf'],
            defenseLeaders: ['A-inf'],
            orders: [unitMove('F-guard')],
            leaders: ['F-guard']
        })
        expect(declared).toMatchObject({ initialResult: 0, attackerWon: false })
        return game
    }

    it('costs three morale on top of the first commitment of the Guard and the step lost', () => {
        const state = beatenOnTheSlope().hydrated
        expect(state.playerOf(Side.French).morale).toBe(23 - 4 - 1 - 3)
        expect(state.playerOf(Side.Allied).morale).toBe(27)
        expect(state.unit('F-guard').face).toEqual(infantry(2))
        expect(state.unit('A-inf').face).toEqual(infantry(1))
        expect(state.unit('F-guard').position).toEqual({ locale: BELOW_THE_SLOPE })
    })

    it('ends the army’s Guard Attacks for the rest of the game, not its attacks with the Guard', () => {
        const game = beatenOnTheSlope()
        expect(game.hydrated.playerOf(Side.French).guardAttackForfeited).toBe(true)
        expect(() => announce(game, Side.French, FROM, INTO, 'F-other')).toThrow(/no longer/)

        passTurns(game, 2)
        expect(() => announce(game, Side.French, FROM, INTO, 'F-other')).toThrow(/no longer/)
        const declared = assault(game, {
            attacker: Side.French,
            from: FROM,
            into: INTO,
            defenders: ['A-far'],
            defenseLeaders: ['A-far'],
            orders: [unitMove('F-other')],
            leaders: ['F-other']
        })
        expect(declared).toMatchObject({ initialResult: 0, attackerWon: false })
        expect(morale(game, Side.French)).toBe(15 - 1)
    })

    it('can break the army that made it, where the commitment of the Guard cannot', () => {
        const game = alliedTurn([
            { id: 'A-guard', side: Side.Allied, face: guard(), locale: WIDE_INTO },
            { id: 'F-guard', side: Side.French, face: guard(), locale: WIDE_FROM }
        ])
        game.arrange((state) => {
            state.playerOf(Side.French).morale = 1
            state.playerOf(Side.Allied).morale = 3
            state.playerOf(Side.Allied).guardCommitted = true
        })
        const declared = assault(game, {
            attacker: Side.Allied,
            from: WIDE_INTO,
            into: WIDE_FROM,
            guardUnitId: 'A-guard',
            defenders: ['F-guard'],
            defenseLeaders: ['F-guard'],
            orders: [unitMove('A-guard')],
            leaders: ['A-guard']
        })
        expect(declared).toMatchObject({ initialResult: 0, finalResult: 0, attackerWon: false })
        const state = game.hydrated
        expect(state.playerOf(Side.French).guardCommitted).toBe(true)
        expect(state.playerOf(Side.French).morale).toBe(1)
        expect(state.machineState).toBe(MachineState.EndOfGame)
        expect(state.victory).toBe(VictoryKind.Decisive)
        expect(state.winningPlayerIds).toEqual([game.playerOf(Side.French)])
    })
})

describe('the Guard outside a Guard Attack (rule 15)', () => {
    it('gets no advantage over weak leading units and risks no more than its losses', () => {
        const game = frenchTurn([
            { id: 'F-guard', side: Side.French, face: guard(), locale: FROM },
            { id: 'A-inf', side: Side.Allied, face: infantry(2), locale: INTO, facing: FROM }
        ])
        const declared = assault(game, {
            attacker: Side.French,
            from: FROM,
            into: INTO,
            defenders: ['A-inf'],
            defenseLeaders: ['A-inf'],
            orders: [unitMove('F-guard')],
            leaders: ['F-guard']
        })
        expect(declared).toMatchObject({ initialResult: 0, attackerWon: false })
        const french = game.hydrated.playerOf(Side.French)
        expect(french.morale).toBe(23 - 4 - 1)
        expect(french.guardAttackForfeited).toBe(false)
    })

    it('leads an attack with another Guard unit, not with line infantry', () => {
        const game = frenchTurn([
            {
                id: 'F-guard',
                side: Side.French,
                face: guard(),
                locale: WIDE_FROM,
                commanderId: 'lannes'
            },
            {
                id: 'F-second',
                side: Side.French,
                face: guard(),
                locale: WIDE_FROM,
                commanderId: 'lannes'
            },
            {
                id: 'F-line',
                side: Side.French,
                face: infantry(3),
                locale: WIDE_FROM,
                commanderId: 'lannes'
            },
            { id: 'A-inf', side: Side.Allied, face: infantry(3), locale: WIDE_INTO }
        ])
        const french = game.playerOf(Side.French)
        const orders = [
            {
                kind: CommandKind.Corps,
                commanderId: 'lannes',
                unitIds: ['F-guard', 'F-second', 'F-line']
            }
        ]
        game.act(ActionType.ThreatenAttack, french, { approach: approach(WIDE_FROM, WIDE_INTO) })
        defendWith(game, game.playerOf(Side.Allied), ['A-inf'])
        game.act(ActionType.PressAttack, french)
        game.act(ActionType.LeadDefense, game.playerOf(Side.Allied), { leaderIds: ['A-inf'] })
        expect(() =>
            game.act(ActionType.DeclareAttack, french, {
                orders,
                wide: true,
                leaderIds: ['F-guard', 'F-line']
            })
        ).toThrow(/cannot be paired/)
        const declared = game.outcome(ActionType.DeclareAttack, french, {
            orders,
            wide: true,
            leaderIds: ['F-guard', 'F-second']
        })
        expect(declared).toMatchObject({ initialResult: 3, attackerWon: true })
    })
})

describe('committing the elite units (rule 15)', () => {
    it('costs four morale the first time the Guard leads and nothing after that', () => {
        const game = frenchTurn([
            { id: 'F-first', side: Side.French, face: guard(), locale: FROM },
            { id: 'F-second', side: Side.French, face: guard(), locale: WIDE_FROM },
            { id: 'A-one', side: Side.Allied, face: infantry(2), locale: INTO },
            { id: 'A-two', side: Side.Allied, face: infantry(2), locale: WIDE_INTO }
        ])
        assault(game, {
            attacker: Side.French,
            from: FROM,
            into: INTO,
            defenders: ['A-one'],
            defenseLeaders: ['A-one'],
            orders: [unitMove('F-first')],
            leaders: ['F-first']
        })
        expect(game.hydrated.playerOf(Side.French).guardCommitted).toBe(true)
        expect(morale(game, Side.French)).toBe(19)
        assault(game, {
            attacker: Side.French,
            from: WIDE_FROM,
            into: WIDE_INTO,
            defenders: ['A-two'],
            defenseLeaders: ['A-two'],
            orders: [unitMove('F-second')],
            leaders: ['F-second']
        })
        expect(game.hydrated.unit('F-second').position).toEqual({ locale: WIDE_INTO })
        expect(morale(game, Side.French)).toBe(19)
    })

    it('is done by a retreat, whether or not the elite unit is the one to suffer', () => {
        const game = alliedTurn([
            { id: 'A-inf', side: Side.Allied, face: infantry(2), locale: FROM },
            { id: 'F-guard', side: Side.French, face: guard(), locale: INTO },
            { id: 'F-line', side: Side.French, face: infantry(2), locale: INTO }
        ])
        game.act(ActionType.ThreatenAttack, game.playerOf(Side.Allied), {
            approach: approach(FROM, INTO)
        })
        game.act(ActionType.Retreat, game.playerOf(Side.French), {
            losses: { 'F-line': 1 },
            destinations: { 'F-guard': REFUGE, 'F-line': REFUGE },
            kept: {}
        })
        const state = game.hydrated
        expect(state.unit('F-guard').face).toEqual(guard())
        expect(state.playerOf(Side.French).guardCommitted).toBe(true)
        expect(state.playerOf(Side.French).morale).toBe(23 - 4 - 1)
    })

    it('costs two morale when heavy cavalry retreats without loss', () => {
        const game = alliedTurn([
            { id: 'A-inf', side: Side.Allied, face: infantry(2), locale: FROM },
            { id: 'F-heavy', side: Side.French, face: cavalry(3), locale: INTO }
        ])
        game.act(ActionType.ThreatenAttack, game.playerOf(Side.Allied), {
            approach: approach(FROM, INTO)
        })
        game.act(ActionType.Retreat, game.playerOf(Side.French), {
            losses: {},
            destinations: { 'F-heavy': REFUGE },
            kept: {}
        })
        const state = game.hydrated
        expect(state.unit('F-heavy').face).toEqual(cavalry(3))
        expect(state.playerOf(Side.French).heavyCavalryCommitted).toBe(true)
        expect(state.playerOf(Side.French).morale).toBe(21)
    })

    it('can bring an army down to its last point of morale but cannot break it', () => {
        const game = alliedTurn([
            { id: 'A-inf', side: Side.Allied, face: infantry(2), locale: FROM },
            { id: 'F-heavy', side: Side.French, face: cavalry(3), locale: INTO }
        ])
        game.arrange((state) => {
            state.playerOf(Side.French).morale = 2
        })
        game.act(ActionType.ThreatenAttack, game.playerOf(Side.Allied), {
            approach: approach(FROM, INTO)
        })
        game.act(ActionType.Retreat, game.playerOf(Side.French), {
            losses: {},
            destinations: { 'F-heavy': REFUGE },
            kept: {}
        })
        const state = game.hydrated
        expect(state.playerOf(Side.French).heavyCavalryCommitted).toBe(true)
        expect(state.playerOf(Side.French).morale).toBe(1)
        expect(state.victory).toBeUndefined()
        expect(state.machineState).toBe(MachineState.Occupying)
    })
})

describe('the record of what the elite units cost (rule 15)', () => {
    it('names the commitment of the Guard, then the defeat of its Guard Attack', () => {
        const game = frenchTurn([
            { id: 'F-guard', side: Side.French, face: guard(), locale: BELOW_THE_SLOPE },
            {
                id: 'A-inf',
                side: Side.Allied,
                face: infantry(2),
                locale: WIDE_FROM,
                facing: BELOW_THE_SLOPE
            }
        ])
        const french = game.playerOf(Side.French)
        const declared = assault(game, {
            attacker: Side.French,
            from: BELOW_THE_SLOPE,
            into: WIDE_FROM,
            guardUnitId: 'F-guard',
            defenders: ['A-inf'],
            defenseLeaders: ['A-inf'],
            orders: [unitMove('F-guard')],
            leaders: ['F-guard']
        })
        expect(declared).toMatchObject({
            attackerWon: false,
            moraleLost: 1,
            penalties: [
                { playerId: french, kind: MoralePenaltyKind.GuardCommitted, moraleLost: 4 },
                { playerId: french, kind: MoralePenaltyKind.GuardAttackDefeated, moraleLost: 3 }
            ]
        })
    })

    it('is kept with the declaration while a counter-attack is awaited, and with the counter-attack for what that costs', () => {
        const game = frenchTurn([
            { id: 'F-guard', side: Side.French, face: guard(), locale: FROM },
            { id: 'A-lead', side: Side.Allied, face: infantry(2), locale: INTO, facing: FROM },
            { id: 'A-heavy', side: Side.Allied, face: cavalry(3), locale: INTO, facing: FROM }
        ])
        const declared = assault(game, {
            attacker: Side.French,
            from: FROM,
            into: INTO,
            guardUnitId: 'F-guard',
            defenders: ['A-lead', 'A-heavy'],
            defenseLeaders: ['A-lead'],
            orders: [unitMove('F-guard')],
            leaders: ['F-guard']
        })
        expect(game.state.machineState).toBe(MachineState.CounterAttackDecision)
        expect(declared).toMatchObject({
            penalties: [
                {
                    playerId: game.playerOf(Side.French),
                    kind: MoralePenaltyKind.GuardCommitted,
                    moraleLost: 4
                }
            ]
        })
        const countered = game.outcome(ActionType.CounterAttack, game.playerOf(Side.Allied), {
            unitIds: ['A-heavy']
        })
        expect(countered).toMatchObject({
            attackerWon: false,
            penalties: [
                {
                    playerId: game.playerOf(Side.Allied),
                    kind: MoralePenaltyKind.HeavyCavalryCommitted,
                    moraleLost: 2
                },
                {
                    playerId: game.playerOf(Side.French),
                    kind: MoralePenaltyKind.GuardAttackDefeated,
                    moraleLost: 3
                }
            ]
        })
        expect(morale(game, Side.Allied)).toBe(27 - 2)
    })

    it('gives the morale that was really lost when an army has little left', () => {
        const game = alliedTurn([
            { id: 'A-guard', side: Side.Allied, face: guard(), locale: WIDE_INTO },
            { id: 'F-guard', side: Side.French, face: guard(), locale: WIDE_FROM }
        ])
        game.arrange((state) => {
            state.playerOf(Side.French).morale = 1
            state.playerOf(Side.Allied).morale = 3
            state.playerOf(Side.Allied).guardCommitted = true
        })
        const declared = assault(game, {
            attacker: Side.Allied,
            from: WIDE_INTO,
            into: WIDE_FROM,
            guardUnitId: 'A-guard',
            defenders: ['F-guard'],
            defenseLeaders: ['F-guard'],
            orders: [unitMove('A-guard')],
            leaders: ['A-guard']
        })
        expect(declared).toMatchObject({
            penalties: [
                {
                    playerId: game.playerOf(Side.French),
                    kind: MoralePenaltyKind.GuardCommitted,
                    moraleLost: 0
                },
                {
                    playerId: game.playerOf(Side.Allied),
                    kind: MoralePenaltyKind.GuardAttackDefeated,
                    moraleLost: 2
                }
            ],
            demoralizedId: game.playerOf(Side.Allied)
        })
    })

    it('names the commitment of an elite unit that only takes a loss', () => {
        const game = frenchTurn([
            { id: 'F-heavy', side: Side.French, face: cavalry(3), locale: FROM },
            { id: 'A-inf', side: Side.Allied, face: infantry(3), locale: INTO, facing: FROM }
        ])
        const declared = assault(game, {
            attacker: Side.French,
            from: FROM,
            into: INTO,
            defenders: ['A-inf'],
            defenseLeaders: ['A-inf'],
            orders: [unitMove('F-heavy')],
            leaders: []
        })
        expect(declared).toMatchObject({
            attackerWon: false,
            penalties: [
                {
                    playerId: game.playerOf(Side.French),
                    kind: MoralePenaltyKind.HeavyCavalryCommitted,
                    moraleLost: 2
                }
            ]
        })
        expect(game.hydrated.findUnit('F-heavy')?.face).not.toEqual(cavalry(3))
    })

    it('is kept with a retreat that commits an elite unit', () => {
        const game = alliedTurn([
            { id: 'A-inf', side: Side.Allied, face: infantry(2), locale: FROM },
            { id: 'F-heavy', side: Side.French, face: cavalry(3), locale: INTO }
        ])
        game.arrange((state) => {
            state.playerOf(Side.French).morale = 2
        })
        game.act(ActionType.ThreatenAttack, game.playerOf(Side.Allied), {
            approach: approach(FROM, INTO)
        })
        const retreated = game.outcome(ActionType.Retreat, game.playerOf(Side.French), {
            losses: {},
            destinations: { 'F-heavy': REFUGE },
            kept: {}
        })
        expect(retreated).toMatchObject({
            penalties: [
                {
                    playerId: game.playerOf(Side.French),
                    kind: MoralePenaltyKind.HeavyCavalryCommitted,
                    moraleLost: 1
                }
            ]
        })
    })

    it('is empty for an attack with no elite unit', () => {
        const game = frenchTurn([
            { id: 'F-line', side: Side.French, face: infantry(3), locale: FROM },
            { id: 'A-inf', side: Side.Allied, face: infantry(2), locale: INTO, facing: FROM }
        ])
        const declared = assault(game, {
            attacker: Side.French,
            from: FROM,
            into: INTO,
            defenders: ['A-inf'],
            defenseLeaders: ['A-inf'],
            orders: [unitMove('F-line')],
            leaders: ['F-line']
        })
        expect(declared).toMatchObject({ penalties: [] })
    })
})
