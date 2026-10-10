import { describe, expect, it } from 'vitest'
import { Side, STARTING_MORALE } from '../components/pieces.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import {
    TestGame,
    arrangeBattlefield,
    artillery,
    cavalry,
    infantry,
    type PiecePlacement
} from '../testing/harness.js'
import { CommandKind } from './attack.js'
import { FeintEnd } from './attackDeclaration.js'
import { nextDecision } from './attackDecisions.js'

const WEST = 93
const EAST = 94

function alliedTurn(placements: readonly PiecePlacement[]): TestGame {
    const game = new TestGame()
    game.deployBoth()
    arrangeBattlefield(game, placements)
    return game
}

describe('the Allied limit of five corps commands', () => {
    const placements: PiecePlacement[] = [
        { id: 'A-1', side: Side.Allied, face: infantry(3), locale: EAST, commanderId: 'bagration' },
        { id: 'A-2', side: Side.Allied, face: infantry(2), locale: EAST, commanderId: 'bagration' },
        {
            id: 'A-3',
            side: Side.Allied,
            face: infantry(2),
            locale: EAST,
            commanderId: 'constantine'
        },
        {
            id: 'A-4',
            side: Side.Allied,
            face: infantry(2),
            locale: EAST,
            commanderId: 'constantine'
        },
        { id: 'F-inf', side: Side.French, face: infantry(2), locale: WEST }
    ]
    const together = [
        { kind: CommandKind.Corps, commanderId: 'bagration', unitIds: ['A-1', 'A-2'] },
        { kind: CommandKind.Corps, commanderId: 'constantine', unitIds: ['A-3', 'A-4'] }
    ]

    function pressed(alreadyUsed: number): TestGame {
        const game = alliedTurn(placements)
        const allied = game.playerOf(Side.Allied)
        game.arrange((state) => {
            state.getPlayerState(allied).corpsCommandsUsed = alreadyUsed
        })
        game.act(ActionType.ThreatenAttack, allied, {
            approach: game.hydrated.map.approachBetween(EAST, WEST).id
        })
        game.act(ActionType.DeclareDefense, game.playerOf(Side.French), {
            unitIds: ['F-inf'],
            leaderIds: []
        })
        game.act(ActionType.PressAttack, allied)
        return game
    }

    it('counts every command of a combined attack', () => {
        const declaration = { orders: together, wide: false, leaderIds: ['A-1'] }
        const overspent = pressed(4)
        expect(() =>
            overspent.act(ActionType.DeclareAttack, overspent.playerOf(Side.Allied), declaration)
        ).toThrow(/corps commands/)

        const affordable = pressed(3)
        affordable.act(ActionType.DeclareAttack, affordable.playerOf(Side.Allied), declaration)
        expect(affordable.hydrated.playerOf(Side.Allied).corpsCommandsUsed).toBe(5)
    })
})

describe('a corps is never just a commander', () => {
    function feinted(): TestGame {
        const game = alliedTurn([
            { id: 'A-inf', side: Side.Allied, face: infantry(2), locale: EAST },
            {
                id: 'F-1',
                side: Side.French,
                face: infantry(2),
                locale: WEST,
                commanderId: 'lannes'
            },
            { id: 'F-2', side: Side.French, face: infantry(2), locale: WEST, commanderId: 'lannes' }
        ])
        const allied = game.playerOf(Side.Allied)
        game.act(ActionType.ThreatenAttack, allied, {
            approach: game.hydrated.map.approachBetween(EAST, WEST).id
        })
        game.act(ActionType.DeclareDefense, game.playerOf(Side.French), {
            unitIds: ['F-1', 'F-2'],
            leaderIds: []
        })
        game.act(ActionType.DeclareFeint, allied, {
            orders: [{ kind: CommandKind.Unit, unitIds: ['A-inf'] }],
            end: FeintEnd.Reserve
        })
        return game
    }

    it('sends the commander forward when every unit with it advances', () => {
        const game = feinted()
        const french = game.playerOf(Side.French)
        expect(nextDecision(game.hydrated)).toMatchObject({ playerId: french })
        expect(() =>
            game.act(ActionType.Advance, french, { unitIds: ['F-1', 'F-2'], commanderIds: [] })
        ).toThrow(/goes forward/)
        game.act(ActionType.Advance, french, { unitIds: ['F-1', 'F-2'], commanderIds: ['lannes'] })
        const state = game.hydrated
        expect(state.commander('lannes').position).toEqual(state.unit('F-1').position)
        expect(state.corpsUnits('lannes')).toHaveLength(2)
    })

    it('lets the commander stay with a unit that stays', () => {
        const game = feinted()
        game.act(ActionType.Advance, game.playerOf(Side.French), {
            unitIds: ['F-1'],
            commanderIds: []
        })
        const state = game.hydrated
        expect(state.commander('lannes').position).toEqual({ locale: WEST })
        expect(state.unit('F-1').commanderId).toBeUndefined()
        expect(state.unit('F-2').commanderId).toBe('lannes')
    })
})

describe('elite commitment of defense leading units', () => {
    it('spares a leading unit that a narrow attack passes by', () => {
        const game = new TestGame()
        game.deployBoth()
        game.act(ActionType.EndTurn, game.playerOf(Side.Allied))
        arrangeBattlefield(game, [
            { id: 'F-inf', side: Side.French, face: infantry(3), locale: WEST },
            { id: 'A-heavy', side: Side.Allied, face: cavalry(3), locale: EAST, facing: WEST },
            { id: 'A-light', side: Side.Allied, face: cavalry(2), locale: EAST, facing: WEST }
        ])
        const french = game.playerOf(Side.French)
        game.act(ActionType.ThreatenAttack, french, {
            approach: game.hydrated.map.approachBetween(WEST, EAST).id
        })
        game.act(ActionType.DeclareDefense, game.playerOf(Side.Allied), {
            unitIds: ['A-heavy', 'A-light'],
            leaderIds: ['A-heavy', 'A-light']
        })
        game.act(ActionType.PressAttack, french)
        expect(game.hydrated.unit('A-heavy').shown).toEqual(cavalry(3))
        game.act(ActionType.DeclareAttack, french, {
            orders: [{ kind: CommandKind.Unit, unitIds: ['F-inf'] }],
            wide: false,
            leaderIds: ['F-inf'],
            targetLeaderId: 'A-light'
        })
        const allied = game.hydrated.playerOf(Side.Allied)
        expect(game.state.machineState).toBe(MachineState.CounterAttackDecision)
        expect(allied.heavyCavalryCommitted).toBe(false)
        expect(allied.morale).toBe(STARTING_MORALE[Side.Allied])
    })
})

describe('attaching', () => {
    it('takes the fixed battery into a corps like any other unit', () => {
        const game = new TestGame()
        game.deployBoth()
        game.act(ActionType.EndTurn, game.playerOf(Side.Allied))
        arrangeBattlefield(game, [
            {
                id: 'F-inf',
                side: Side.French,
                face: infantry(2),
                locale: WEST,
                facing: EAST,
                commanderId: 'lannes'
            },
            { id: 'F-fixed', side: Side.French, face: artillery(), locale: WEST, facing: EAST }
        ])
        game.arrange((state) => {
            state.unit('F-fixed').fixed = true
        })
        game.act(ActionType.Attach, game.playerOf(Side.French), {
            commanderId: 'lannes',
            unitId: 'F-fixed'
        })
        expect(game.hydrated.unit('F-fixed').commanderId).toBe('lannes')
    })
})

describe('the morale auction', () => {
    it('takes any bid that leaves the army chosen with morale', () => {
        const game = new TestGame({ sideSelection: 'Auction' })
        const [first] = game.state.activePlayerIds
        const highest = STARTING_MORALE[Side.Allied] - 1
        expect(() => game.act(ActionType.PlaceBid, first, { amount: highest + 1 })).toThrow()
        game.act(ActionType.PlaceBid, first, { amount: highest })
        const [second] = game.state.activePlayerIds
        game.act(ActionType.PassBid, second)
        expect(() => game.act(ActionType.ChooseSide, first, { side: Side.French })).toThrow(
            /no morale/
        )
        game.act(ActionType.ChooseSide, first, { side: Side.Allied })
        expect(game.hydrated.playerOf(Side.Allied).morale).toBe(1)
    })
})
