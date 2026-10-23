import { describe, expect, it } from 'vitest'
import { Side } from '../components/pieces.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import {
    TestGame,
    arrangeBattlefield,
    artillery,
    cavalry,
    infantry,
    type PiecePlacement,
    defendWith
} from '../testing/harness.js'
import { CommandKind, ResultTermKind } from './attack.js'
import { FeintEnd } from './attackDeclaration.js'

const ATTACK_FROM = 95
const DEFEND_IN = 108

function frenchTurn(placements: readonly PiecePlacement[]): TestGame {
    const game = new TestGame()
    game.deployBoth()
    game.act(ActionType.EndTurn, game.playerOf(Side.Allied))
    arrangeBattlefield(game, placements)
    return game
}

function threaten(game: TestGame) {
    const approach = game.hydrated.map.approachBetween(ATTACK_FROM, DEFEND_IN).id
    game.act(ActionType.ThreatenAttack, game.playerOf(Side.French), { approach })
}

describe('rule 11, steps 2 to 4: the defence is named, then pressed, then led', () => {
    const reserve: PiecePlacement[] = [
        { id: 'F-inf', side: Side.French, face: infantry(3), locale: ATTACK_FROM },
        {
            id: 'A-big',
            side: Side.Allied,
            face: infantry(3),
            locale: DEFEND_IN,
            commanderId: 'langeron'
        },
        {
            id: 'A-small',
            side: Side.Allied,
            face: infantry(2),
            locale: DEFEND_IN,
            commanderId: 'langeron'
        },
        { id: 'A-out', side: Side.Allied, face: infantry(2), locale: DEFEND_IN }
    ]

    function stood() {
        const game = frenchTurn(reserve)
        const french = game.playerOf(Side.French)
        const allied = game.playerOf(Side.Allied)
        threaten(game)
        game.act(ActionType.DeclareDefense, allied, { unitIds: ['A-big', 'A-small'] })
        return { game, french, allied }
    }

    it('asks the defender only for the defending pieces, and then the attacker whether to press', () => {
        const { game, french } = stood()
        expect(game.state.machineState).toBe(MachineState.FeintDecision)
        expect(game.state.activePlayerIds).toEqual([french])
        expect(game.state.attack?.defenseLeaderIds).toEqual([])
    })

    it('shows nothing when the attack is pressed, and passes to the defender to name the leading units', () => {
        const { game, french, allied } = stood()
        const pressed = game.act(ActionType.PressAttack, french)
        expect(pressed.some((action) => action.revealsInfo === true)).toBe(false)
        expect(game.state.machineState).toBe(MachineState.DefenseDeclaration)
        expect(game.state.activePlayerIds).toEqual([allied])
        expect(game.hydrated.unitsHiddenFrom(french).map((unit) => unit.id)).toEqual(
            expect.arrayContaining(['A-big', 'A-small'])
        )
    })

    it('turns the leading units face-up as the defender names them, and passes to the attack declaration', () => {
        const { game, french, allied } = stood()
        game.act(ActionType.PressAttack, french)
        game.act(ActionType.LeadDefense, allied, { leaderIds: ['A-big'] })
        expect(game.state.machineState).toBe(MachineState.AttackDeclaration)
        expect(game.state.activePlayerIds).toEqual([french])
        expect(game.state.attack?.defenseLeaderIds).toEqual(['A-big'])
        expect(game.hydrated.unit('A-big').shown).toEqual(infantry(3))
        expect(game.hydrated.unit('A-small').shown).toBeUndefined()
    })

    it('lets the defence name no leading unit', () => {
        const { game, french, allied } = stood()
        game.act(ActionType.PressAttack, french)
        game.act(ActionType.LeadDefense, allied, { leaderIds: [] })
        expect(game.state.machineState).toBe(MachineState.AttackDeclaration)
        expect(game.state.attack?.defenseLeaderIds).toEqual([])
    })

    it('takes leading units only from the defending pieces, each once, and only when it is time', () => {
        const { game, french, allied } = stood()
        expect(() => game.act(ActionType.LeadDefense, allied, { leaderIds: ['A-big'] })).toThrow()
        game.act(ActionType.PressAttack, french)
        expect(() => game.act(ActionType.LeadDefense, allied, { leaderIds: ['A-out'] })).toThrow(
            /defending pieces/
        )
        expect(() =>
            game.act(ActionType.LeadDefense, allied, { leaderIds: ['A-big', 'A-big'] })
        ).toThrow(/named once/)
        expect(() => game.act(ActionType.LeadDefense, french, { leaderIds: [] })).toThrow()
    })

    it('names pieces blocking the approach as the defenders without asking, since they must all defend', () => {
        const game = frenchTurn([
            { id: 'F-inf', side: Side.French, face: infantry(3), locale: ATTACK_FROM },
            {
                id: 'A-front',
                side: Side.Allied,
                face: infantry(2),
                locale: DEFEND_IN,
                facing: ATTACK_FROM
            },
            { id: 'A-back', side: Side.Allied, face: infantry(2), locale: DEFEND_IN }
        ])
        const approach = game.hydrated.map.approachBetween(ATTACK_FROM, DEFEND_IN).id
        const threat = game.act(ActionType.ThreatenAttack, game.playerOf(Side.French), {
            approach
        })
        expect(threat.map((action) => action.type)).toEqual([
            ActionType.ThreatenAttack,
            ActionType.DeclareDefense
        ])
        expect(game.state.attack?.defendingUnitIds).toEqual(['A-front'])
        expect(game.state.machineState).toBe(MachineState.FeintDecision)
        expect(game.state.activePlayerIds).toEqual([game.playerOf(Side.French)])
    })

    it('still shows the leading units as it is pressed, for an attack whose defence named them with its pieces', () => {
        const { game, french } = stood()
        game.arrange((state) => {
            const attack = state.attack
            if (attack) {
                attack.awaits = undefined
                attack.defensePlan = { playerId: attack.defenderId, leaderIds: ['A-small'] }
            }
        })
        expect(game.state.machineState).toBe(MachineState.FeintDecision)
        game.act(ActionType.PressAttack, french)
        expect(game.state.machineState).toBe(MachineState.AttackDeclaration)
        expect(game.state.attack?.defenseLeaderIds).toEqual(['A-small'])
        expect(game.hydrated.unit('A-small').shown).toEqual(infantry(2))
    })
})

describe('rule 11 attack example 3: artillery against artillery', () => {
    const placements: PiecePlacement[] = [
        {
            id: 'F-art',
            side: Side.French,
            face: artillery(),
            locale: ATTACK_FROM,
            facing: DEFEND_IN
        },
        {
            id: 'A-art',
            side: Side.Allied,
            face: artillery(),
            locale: DEFEND_IN,
            facing: ATTACK_FROM
        },
        {
            id: 'A-inf',
            side: Side.Allied,
            face: infantry(2),
            locale: DEFEND_IN,
            facing: ATTACK_FROM
        }
    ]

    it('costs the defender one step of its choice and moves nobody', () => {
        const game = frenchTurn(placements)
        const french = game.playerOf(Side.French)
        const allied = game.playerOf(Side.Allied)
        threaten(game)
        expect(game.state.machineState).toBe(MachineState.FeintDecision)
        expect(() =>
            game.act(ActionType.Retreat, allied, { losses: {}, destinations: {}, kept: {} })
        ).toThrow()
        defendWith(game, allied, ['A-art', 'A-inf'])
        game.act(ActionType.PressAttack, french)
        game.act(ActionType.LeadDefense, allied, { leaderIds: ['A-art'] })
        expect(game.hydrated.unit('A-art').shown).toEqual(artillery())
        const declared = game.outcome(ActionType.DeclareAttack, french, {
            orders: [{ kind: CommandKind.Unit, unitIds: ['F-art'] }],
            wide: false,
            leaderIds: ['F-art']
        })
        expect(declared).toMatchObject({ initialResult: 1, finalResult: 1, attackerWon: true })
        expect(game.state.machineState).toBe(MachineState.ResolvingAttack)
        expect(game.activePlayerId).toBe(allied)
        game.act(ActionType.AssignLosses, allied, { allocation: { 'A-inf': 1 } })
        const state = game.hydrated
        expect(state.machineState).toBe(MachineState.Commanding)
        expect(state.findUnit('A-inf')?.face).toEqual(infantry(1))
        expect(state.unit('A-art').position?.locale).toBe(DEFEND_IN)
        expect(state.unit('F-art').position?.locale).toBe(ATTACK_FROM)
        expect(state.playerOf(Side.Allied).morale).toBe(26)
        expect(state.playerOf(Side.French).morale).toBe(23)
    })
})

describe('rule 11 attack example 4: infantry repulsed by a cavalry counter-attack', () => {
    const placements: PiecePlacement[] = [
        {
            id: 'F-block',
            side: Side.French,
            face: infantry(2),
            locale: ATTACK_FROM,
            facing: DEFEND_IN
        },
        { id: 'F-inf', side: Side.French, face: infantry(3), locale: ATTACK_FROM },
        {
            id: 'A-inf',
            side: Side.Allied,
            face: infantry(1),
            locale: DEFEND_IN,
            facing: ATTACK_FROM
        },
        { id: 'A-cav', side: Side.Allied, face: cavalry(3), locale: DEFEND_IN, facing: ATTACK_FROM }
    ]

    it('follows the worked example to a final result of -1', () => {
        const game = frenchTurn(placements)
        const french = game.playerOf(Side.French)
        const allied = game.playerOf(Side.Allied)
        threaten(game)
        defendWith(game, allied, ['A-inf', 'A-cav'])
        game.act(ActionType.PressAttack, french)
        game.act(ActionType.LeadDefense, allied, { leaderIds: ['A-inf'] })
        const declared = game.outcome(ActionType.DeclareAttack, french, {
            orders: [{ kind: CommandKind.Unit, unitIds: ['F-inf'] }],
            wide: false,
            leaderIds: ['F-inf']
        })
        expect(declared).toMatchObject({
            initialResult: 1,
            account: [
                { kind: ResultTermKind.AttackLeaders, value: 3, faces: [infantry(3)] },
                { kind: ResultTermKind.InfantryAgainstBlockers, value: -1 },
                { kind: ResultTermKind.DefenseLeaders, value: -1, faces: [infantry(1)] }
            ]
        })
        expect(game.state.machineState).toBe(MachineState.CounterAttackDecision)
        const countered = game.outcome(ActionType.CounterAttack, allied, { unitIds: ['A-cav'] })
        expect(countered).toMatchObject({
            finalResult: -1,
            attackerWon: false,
            moraleLost: 2,
            account: [{ kind: ResultTermKind.CounterAttack, value: -2, faces: [cavalry(3)] }]
        })
        const state = game.hydrated
        expect(state.machineState).toBe(MachineState.Commanding)
        expect(state.unit('F-inf').face).toEqual(infantry(1))
        expect(state.unit('F-inf').position).toEqual({ locale: ATTACK_FROM })
        expect(state.findUnit('A-inf')).toBeUndefined()
        expect(state.unit('A-cav').face).toEqual(cavalry(2))
        expect(state.playerOf(Side.French).morale).toBe(21)
        expect(state.playerOf(Side.Allied).morale).toBe(25)
        expect(state.playerOf(Side.Allied).heavyCavalryCommitted).toBe(true)
    })
})

describe('feints', () => {
    const placements: PiecePlacement[] = [
        { id: 'F-inf', side: Side.French, face: infantry(2), locale: ATTACK_FROM },
        {
            id: 'A-one',
            side: Side.Allied,
            face: infantry(2),
            locale: DEFEND_IN,
            commanderId: 'langeron'
        },
        {
            id: 'A-two',
            side: Side.Allied,
            face: infantry(2),
            locale: DEFEND_IN,
            commanderId: 'langeron'
        }
    ]

    it('draws a reserve defender up to the approach and closes the approach for the turn', () => {
        const game = frenchTurn(placements)
        const french = game.playerOf(Side.French)
        const allied = game.playerOf(Side.Allied)
        threaten(game)
        defendWith(game, allied, ['A-one', 'A-two'])
        game.act(ActionType.DeclareFeint, french, {
            orders: [{ kind: CommandKind.Unit, unitIds: ['F-inf'] }],
            end: FeintEnd.Approach
        })
        expect(game.state.machineState).toBe(MachineState.ResolvingAttack)
        expect(game.activePlayerId).toBe(allied)
        game.act(ActionType.Advance, allied, { unitIds: ['A-one'], commanderIds: [] })
        const state = game.hydrated
        const defenseApproach = state.map.approachBetween(DEFEND_IN, ATTACK_FROM).id
        expect(state.machineState).toBe(MachineState.Commanding)
        expect(state.unit('A-one').position).toEqual({
            locale: DEFEND_IN,
            approach: defenseApproach
        })
        expect(state.unit('A-one').commanderId).toBeUndefined()
        expect(state.unit('A-two').commanderId).toBe('langeron')
        expect(state.unit('F-inf').position?.approach).toBe(
            state.map.approachBetween(ATTACK_FROM, DEFEND_IN).id
        )
        expect(() => threaten(game)).toThrow()
    })

    it('refuses an advance that names a unit or commander more than once', () => {
        const game = frenchTurn(placements)
        const french = game.playerOf(Side.French)
        const allied = game.playerOf(Side.Allied)
        threaten(game)
        defendWith(game, allied, ['A-one', 'A-two'])
        game.act(ActionType.DeclareFeint, french, {
            orders: [{ kind: CommandKind.Unit, unitIds: ['F-inf'] }],
            end: FeintEnd.Approach
        })
        expect(() =>
            game.act(ActionType.Advance, allied, {
                unitIds: ['A-one', 'A-one'],
                commanderIds: []
            })
        ).toThrow('A piece advances once')
        expect(() =>
            game.act(ActionType.Advance, allied, {
                unitIds: ['A-one'],
                commanderIds: ['langeron', 'langeron']
            })
        ).toThrow('A piece advances once')
    })
})

describe('retreats', () => {
    it('lets a reserve defender retreat before combat, at a cost to its idle infantry', () => {
        const game = frenchTurn([
            { id: 'F-inf', side: Side.French, face: infantry(3), locale: ATTACK_FROM },
            {
                id: 'A-inf',
                side: Side.Allied,
                face: infantry(2),
                locale: DEFEND_IN,
                commanderId: 'langeron'
            },
            {
                id: 'A-cav',
                side: Side.Allied,
                face: cavalry(2),
                locale: DEFEND_IN,
                commanderId: 'langeron'
            }
        ])
        const french = game.playerOf(Side.French)
        const allied = game.playerOf(Side.Allied)
        threaten(game)
        expect(() =>
            game.act(ActionType.Retreat, allied, {
                losses: {},
                destinations: { 'A-inf': 96, 'A-cav': 96 },
                kept: { langeron: 'A-inf' }
            })
        ).toThrow()
        game.act(ActionType.Retreat, allied, {
            losses: { 'A-inf': 1 },
            destinations: { 'A-inf': 96, 'A-cav': 96 },
            kept: { langeron: 'A-cav' }
        })
        expect(game.state.machineState).toBe(MachineState.Occupying)
        game.act(ActionType.Occupy, french, {
            orders: [{ kind: CommandKind.Unit, unitIds: ['F-inf'] }]
        })
        const state = game.hydrated
        expect(state.machineState).toBe(MachineState.Commanding)
        expect(state.unit('F-inf').position).toEqual({ locale: DEFEND_IN })
        expect(state.unit('A-inf').face).toEqual(infantry(1))
        expect(state.unit('A-inf').commanderId).toBeUndefined()
        expect(state.commander('langeron').position).toEqual({ locale: 96 })
        expect(state.playerOf(Side.Allied).morale).toBe(26)
    })

    it('throws a beaten defender out of the locale and brings the attackers in', () => {
        const game = frenchTurn([
            { id: 'F-inf', side: Side.French, face: infantry(3), locale: ATTACK_FROM },
            { id: 'A-inf', side: Side.Allied, face: infantry(2), locale: DEFEND_IN },
            { id: 'A-art', side: Side.Allied, face: artillery(), locale: DEFEND_IN }
        ])
        const french = game.playerOf(Side.French)
        const allied = game.playerOf(Side.Allied)
        threaten(game)
        defendWith(game, allied, ['A-inf'])
        game.act(ActionType.PressAttack, french)
        game.act(ActionType.LeadDefense, allied, { leaderIds: ['A-inf'] })
        game.act(ActionType.DeclareAttack, french, {
            orders: [{ kind: CommandKind.Unit, unitIds: ['F-inf'] }],
            wide: false,
            leaderIds: ['F-inf']
        })
        expect(game.state.machineState).toBe(MachineState.Retreating)
        game.act(ActionType.Retreat, allied, { losses: {}, destinations: {}, kept: {} })
        const state = game.hydrated
        expect(state.machineState).toBe(MachineState.Commanding)
        expect(state.unit('F-inf').position).toEqual({ locale: DEFEND_IN })
        expect(state.unit('F-inf').face).toEqual(infantry(2))
        expect(state.findUnit('A-art')).toBeUndefined()
        expect(state.findUnit('A-inf')).toBeUndefined()
        expect(state.playerOf(Side.Allied).morale).toBe(24)
        expect(state.limits.stormedLocales).toEqual([DEFEND_IN])
    })
})

describe('errata and designer rulings', () => {
    const WIDE_FROM = 93
    const WIDE_INTO = 94

    it('lets two batteries combine their Unit Moves only to lead the attack together', () => {
        const pair = [
            { kind: CommandKind.Unit, unitIds: ['F-art-a'] },
            { kind: CommandKind.Unit, unitIds: ['F-art-b'] }
        ]
        const game = frenchTurn([
            {
                id: 'F-art-a',
                side: Side.French,
                face: artillery(),
                locale: WIDE_FROM,
                facing: WIDE_INTO
            },
            {
                id: 'F-art-b',
                side: Side.French,
                face: artillery(),
                locale: WIDE_FROM,
                facing: WIDE_INTO
            },
            { id: 'A-inf', side: Side.Allied, face: infantry(3), locale: WIDE_INTO }
        ])
        const french = game.playerOf(Side.French)
        const approach = game.hydrated.map.approachBetween(WIDE_FROM, WIDE_INTO).id
        game.act(ActionType.ThreatenAttack, french, { approach })
        defendWith(game, game.playerOf(Side.Allied), ['A-inf'])
        expect(() =>
            game.act(ActionType.DeclareFeint, french, { orders: pair, end: FeintEnd.Approach })
        ).toThrow(/lead an attack together/)
        game.act(ActionType.PressAttack, french)
        game.act(ActionType.LeadDefense, game.playerOf(Side.Allied), { leaderIds: [] })
        expect(() =>
            game.act(ActionType.DeclareAttack, french, {
                orders: pair,
                wide: true,
                leaderIds: ['F-art-a']
            })
        ).toThrow(/lead an attack together/)
        const declared = game.outcome(ActionType.DeclareAttack, french, {
            orders: pair,
            wide: true,
            leaderIds: ['F-art-a', 'F-art-b']
        })
        expect(declared).toMatchObject({ initialResult: 2, attackerWon: true })
    })

    it('never sends the fixed battery forward after a feint', () => {
        const game = new TestGame()
        game.deployBoth()
        arrangeBattlefield(game, [
            { id: 'A-inf', side: Side.Allied, face: infantry(2), locale: WIDE_INTO },
            { id: 'F-fixed', side: Side.French, face: artillery(), locale: WIDE_FROM },
            {
                id: 'F-inf',
                side: Side.French,
                face: infantry(2),
                locale: WIDE_FROM,
                commanderId: 'lannes'
            }
        ])
        game.arrange((state) => {
            state.unit('F-fixed').fixed = true
        })
        const allied = game.playerOf(Side.Allied)
        const french = game.playerOf(Side.French)
        const approach = game.hydrated.map.approachBetween(WIDE_INTO, WIDE_FROM).id
        const feint = {
            orders: [{ kind: CommandKind.Unit, unitIds: ['A-inf'] }],
            end: FeintEnd.Reserve
        }

        game.act(ActionType.ThreatenAttack, allied, { approach })
        defendWith(game, french, ['F-fixed', 'F-inf'])
        game.act(ActionType.DeclareFeint, allied, feint)
        const state = game.hydrated
        expect(state.attack).toBeUndefined()
        expect(state.unit('F-inf').position).toEqual({
            locale: WIDE_FROM,
            approach: state.map.approachBetween(WIDE_FROM, WIDE_INTO).id
        })
        expect(state.unit('F-fixed').position).toEqual({ locale: WIDE_FROM })
    })

    it('asks for no advance when only the fixed battery was named', () => {
        const game = new TestGame()
        game.deployBoth()
        arrangeBattlefield(game, [
            { id: 'A-inf', side: Side.Allied, face: infantry(2), locale: WIDE_INTO },
            { id: 'F-fixed', side: Side.French, face: artillery(), locale: WIDE_FROM }
        ])
        game.arrange((state) => {
            state.unit('F-fixed').fixed = true
        })
        const allied = game.playerOf(Side.Allied)
        const approach = game.hydrated.map.approachBetween(WIDE_INTO, WIDE_FROM).id
        game.act(ActionType.ThreatenAttack, allied, { approach })
        defendWith(game, game.playerOf(Side.French), ['F-fixed'])
        game.act(ActionType.DeclareFeint, allied, {
            orders: [{ kind: CommandKind.Unit, unitIds: ['A-inf'] }],
            end: FeintEnd.Reserve
        })
        expect(game.state.machineState).toBe(MachineState.Commanding)
        expect(game.activePlayerId).toBe(allied)
    })
})

describe('Guard infantry beside line infantry', () => {
    const placements: PiecePlacement[] = [
        { id: 'F-inf', side: Side.French, face: infantry(3), locale: 93, commanderId: 'lannes' },
        { id: 'F-inf-b', side: Side.French, face: infantry(3), locale: 93, commanderId: 'lannes' },
        {
            id: 'A-guard',
            side: Side.Allied,
            face: { ...infantry(3), guard: true },
            locale: 94,
            commanderId: 'constantine'
        },
        {
            id: 'A-line',
            side: Side.Allied,
            face: infantry(2),
            locale: 94,
            commanderId: 'constantine'
        }
    ]

    it('leads a defence from reserve with it, but does not counter-attack with it', () => {
        const game = frenchTurn(placements)
        const french = game.playerOf(Side.French)
        const allied = game.playerOf(Side.Allied)
        const approach = game.hydrated.map.approachBetween(93, 94).id
        game.act(ActionType.ThreatenAttack, french, { approach })
        defendWith(game, allied, ['A-guard', 'A-line'])
        expect(game.state.machineState).toBe(MachineState.FeintDecision)
        game.act(ActionType.PressAttack, french)
        game.act(ActionType.LeadDefense, allied, { leaderIds: ['A-guard', 'A-line'] })
        expect(game.state.machineState).toBe(MachineState.AttackDeclaration)

        const second = frenchTurn(placements)
        second.act(ActionType.ThreatenAttack, second.playerOf(Side.French), { approach })
        defendWith(second, second.playerOf(Side.Allied), ['A-guard', 'A-line'])
        second.act(ActionType.PressAttack, second.playerOf(Side.French))
        second.act(ActionType.LeadDefense, second.playerOf(Side.Allied), { leaderIds: [] })
        second.act(ActionType.DeclareAttack, second.playerOf(Side.French), {
            orders: [
                { kind: CommandKind.Corps, commanderId: 'lannes', unitIds: ['F-inf', 'F-inf-b'] }
            ],
            wide: true,
            leaderIds: ['F-inf']
        })
        expect(second.state.machineState).toBe(MachineState.CounterAttackDecision)
        expect(() =>
            second.act(ActionType.CounterAttack, second.playerOf(Side.Allied), {
                unitIds: ['A-guard', 'A-line']
            })
        ).toThrow(/Guard infantry cannot be paired/)
    })
})

describe('rule 11, step 2: commanders are defending pieces too', () => {
    const SECOND_FROM = 96
    const corps: PiecePlacement[] = [
        { id: 'F-one', side: Side.French, face: infantry(2), locale: ATTACK_FROM },
        { id: 'F-two', side: Side.French, face: infantry(2), locale: SECOND_FROM },
        ...['A-one', 'A-two', 'A-three'].map((id) => ({
            id,
            side: Side.Allied,
            face: infantry(2),
            locale: DEFEND_IN,
            commanderId: 'langeron'
        }))
    ]

    function feintFrom(game: TestGame, unitId: string) {
        game.act(ActionType.DeclareFeint, game.playerOf(Side.French), {
            orders: [{ kind: CommandKind.Unit, unitIds: [unitId] }],
            end: FeintEnd.Approach
        })
    }

    function threatenFrom(game: TestGame, from: number) {
        const approach = game.hydrated.map.approachBetween(from, DEFEND_IN).id
        game.act(ActionType.ThreatenAttack, game.playerOf(Side.French), { approach })
    }

    it('cannot name a commander against a second approach in the turn he was named against another', () => {
        const game = frenchTurn(corps)
        const allied = game.playerOf(Side.Allied)
        threatenFrom(game, ATTACK_FROM)
        game.act(ActionType.DeclareDefense, allied, {
            unitIds: ['A-one'],
            commanderIds: ['langeron']
        })
        feintFrom(game, 'F-one')
        game.act(ActionType.Advance, allied, { unitIds: ['A-one'], commanderIds: [] })
        threatenFrom(game, SECOND_FROM)
        expect(() =>
            game.act(ActionType.DeclareDefense, allied, {
                unitIds: ['A-two'],
                commanderIds: ['langeron']
            })
        ).toThrow(/different approach/)
        game.act(ActionType.DeclareDefense, allied, { unitIds: ['A-two'], commanderIds: [] })
        expect(game.state.attack?.defendingCommanderIds).toEqual([])
    })

    it('keeps an unnamed commander in reserve when his units advance, unless they are the last with him', () => {
        const game = frenchTurn(corps)
        const allied = game.playerOf(Side.Allied)
        threatenFrom(game, ATTACK_FROM)
        game.act(ActionType.DeclareDefense, allied, {
            unitIds: ['A-one', 'A-two'],
            commanderIds: []
        })
        feintFrom(game, 'F-one')
        expect(() =>
            game.act(ActionType.Advance, allied, {
                unitIds: ['A-one', 'A-two'],
                commanderIds: ['langeron']
            })
        ).toThrow(/named commander/)
        game.act(ActionType.Advance, allied, { unitIds: ['A-one', 'A-two'], commanderIds: [] })
        expect(game.hydrated.commander('langeron').position).toEqual({ locale: DEFEND_IN })
        expect(game.hydrated.unit('A-three').commanderId).toBe('langeron')
    })

    it('takes an unnamed commander forward with the last unit standing with him', () => {
        const game = frenchTurn(corps.filter((placement) => placement.id !== 'A-three'))
        const allied = game.playerOf(Side.Allied)
        threatenFrom(game, ATTACK_FROM)
        game.act(ActionType.DeclareDefense, allied, {
            unitIds: ['A-one', 'A-two'],
            commanderIds: []
        })
        feintFrom(game, 'F-one')
        game.act(ActionType.Advance, allied, {
            unitIds: ['A-one', 'A-two'],
            commanderIds: ['langeron']
        })
        const defenseApproach = game.hydrated.map.approachBetween(DEFEND_IN, ATTACK_FROM).id
        expect(game.hydrated.commander('langeron').position).toEqual({
            locale: DEFEND_IN,
            approach: defenseApproach
        })
    })

    it('advances a lone named unit at once when its commander was not named and has others with him', () => {
        const game = frenchTurn(corps)
        const allied = game.playerOf(Side.Allied)
        threatenFrom(game, ATTACK_FROM)
        game.act(ActionType.DeclareDefense, allied, { unitIds: ['A-one'], commanderIds: [] })
        feintFrom(game, 'F-one')
        expect(game.state.machineState).toBe(MachineState.Commanding)
        expect(game.hydrated.unit('A-one').position?.approach).toBe(
            game.hydrated.map.approachBetween(DEFEND_IN, ATTACK_FROM).id
        )
        expect(game.hydrated.unit('A-one').commanderId).toBeUndefined()
        expect(game.hydrated.commander('langeron').position).toEqual({ locale: DEFEND_IN })
    })

    it('names the commander of a corps blocking the approach with it, without asking', () => {
        const game = frenchTurn([
            corps[0],
            ...corps.slice(2).map((placement) => ({ ...placement, facing: ATTACK_FROM }))
        ])
        const approach = game.hydrated.map.approachBetween(ATTACK_FROM, DEFEND_IN).id
        const [, defense] = game.act(ActionType.ThreatenAttack, game.playerOf(Side.French), {
            approach
        })
        expect(defense).toMatchObject({
            type: ActionType.DeclareDefense,
            unitIds: ['A-one', 'A-two', 'A-three'],
            commanderIds: ['langeron']
        })
        expect(game.state.attack?.defendingCommanderIds).toEqual(['langeron'])
    })

    it('names a commander only together with a unit of his corps', () => {
        const game = frenchTurn([
            ...corps,
            { id: 'A-out', side: Side.Allied, face: infantry(2), locale: DEFEND_IN }
        ])
        threatenFrom(game, ATTACK_FROM)
        expect(() =>
            game.act(ActionType.DeclareDefense, game.playerOf(Side.Allied), {
                unitIds: ['A-out'],
                commanderIds: ['langeron']
            })
        ).toThrow(/unit of his corps/)
    })
})
