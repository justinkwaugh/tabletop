import { describe, expect, it } from 'vitest'
import { AUSTERLITZ } from '../components/austerlitz.js'
import { Side } from '../components/pieces.js'
import { Scenario, roundLabel } from '../components/timeTrack.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import {
    assault,
    cavalry,
    frenchTurn,
    infantry,
    passTurns,
    type PiecePlacement,
    type TestGame
} from '../testing/harness.js'
import { CommandKind } from './attack.js'

const FROM = 95
const INTO = 108
const BEHIND = 109
const DEAD_END = 99
const INTO_THE_DEAD_END = 87
const OTHER_WAY_OUT = 88

const twoDays = { scenario: Scenario.December1 }

function label(game: TestGame): string {
    return roundLabel(game.hydrated.currentRound, true)
}

function passUntil(game: TestGame, round: string) {
    while (label(game) !== round) {
        passTurns(game, 1)
    }
}

function threaten(game: TestGame, side: Side, from: number, into: number) {
    return game.act(ActionType.ThreatenAttack, game.playerOf(side), {
        approach: AUSTERLITZ.approachBetween(from, into).id
    })
}

describe('the night round (rule 14)', () => {
    const placements: PiecePlacement[] = [
        { id: 'F-inf', side: Side.French, face: infantry(3), locale: FROM },
        { id: 'A-inf', side: Side.Allied, face: infantry(2), locale: INTO },
        { id: 'A-cav', side: Side.Allied, face: cavalry(2), locale: INTO }
    ]

    it('follows 4:00PM on 1 December and gives each player a turn before 7:00AM', () => {
        const game = frenchTurn(placements, twoDays)
        passUntil(game, '1 December · 4:00PM')
        passTurns(game, 2)
        expect(label(game)).toBe('1 December · Night')
        expect(game.hydrated.currentRound.night).toBe(true)
        expect(game.activePlayerId).toBe(game.playerOf(Side.Allied))
        passTurns(game, 1)
        expect(label(game)).toBe('1 December · Night')
        expect(game.activePlayerId).toBe(game.playerOf(Side.French))
        passTurns(game, 1)
        expect(label(game)).toBe('2 December · 7:00AM')
        expect(game.hydrated.currentRound.night).toBe(false)
    })

    it('lets pieces move but not attack', () => {
        const game = frenchTurn(placements, twoDays)
        const french = game.playerOf(Side.French)
        const allied = game.playerOf(Side.Allied)
        passUntil(game, '1 December · Night')

        const open = game.engine.getValidActionTypesForPlayer(game.game, game.state, allied)
        expect(open).toContain(ActionType.Move)
        expect(open).not.toContain(ActionType.ThreatenAttack)
        expect(() => threaten(game, Side.Allied, INTO, FROM)).toThrow()
        game.act(ActionType.Move, allied, {
            order: { kind: CommandKind.Unit, unitIds: ['A-cav'] },
            to: { locale: BEHIND }
        })
        expect(game.hydrated.unit('A-cav').position).toEqual({ locale: BEHIND })
        passTurns(game, 1)

        expect(() => threaten(game, Side.French, FROM, INTO)).toThrow()
        const forward = { locale: FROM, approach: AUSTERLITZ.approachBetween(FROM, INTO).id }
        game.act(ActionType.Move, french, {
            order: { kind: CommandKind.Unit, unitIds: ['F-inf'] },
            to: forward
        })
        expect(game.hydrated.unit('F-inf').position).toEqual(forward)
        expect(game.state.machineState).toBe(MachineState.Commanding)
        passTurns(game, 1)

        expect(label(game)).toBe('2 December · 7:00AM')
        expect(game.engine.getValidActionTypesForPlayer(game.game, game.state, allied)).toContain(
            ActionType.ThreatenAttack
        )
        threaten(game, Side.Allied, INTO, FROM)
        expect(game.state.machineState).toBe(MachineState.DefenseResponse)
    })

    it('opens with each army regaining half the morale it has lost, rounded down, and four at most', () => {
        const trapped = (id: string, strength: number): PiecePlacement => ({
            id,
            side: Side.Allied,
            face: infantry(strength),
            locale: DEAD_END
        })
        const game = frenchTurn(
            [
                trapped('A-1', 3),
                trapped('A-2', 3),
                trapped('A-3', 3),
                trapped('A-4', 2),
                { id: 'F-threat', side: Side.French, face: infantry(2), locale: INTO_THE_DEAD_END },
                { id: 'F-cork', side: Side.French, face: cavalry(2), locale: OTHER_WAY_OUT },
                {
                    id: 'F-lead',
                    side: Side.French,
                    face: infantry(2),
                    locale: FROM,
                    commanderId: 'lannes'
                },
                {
                    id: 'F-other',
                    side: Side.French,
                    face: infantry(3),
                    locale: FROM,
                    commanderId: 'lannes'
                },
                { id: 'A-wall', side: Side.Allied, face: infantry(3), locale: INTO, facing: FROM }
            ],
            twoDays
        )
        threaten(game, Side.French, INTO_THE_DEAD_END, DEAD_END)
        game.act(ActionType.Retreat, game.playerOf(Side.Allied), {
            losses: { 'A-4': 2 },
            destinations: {},
            kept: {}
        })
        game.act(ActionType.Occupy, game.playerOf(Side.French), {
            orders: [{ kind: CommandKind.Unit, unitIds: ['F-threat'] }]
        })
        expect(game.hydrated.playerOf(Side.Allied).morale).toBe(27 - 11)

        assault(game, {
            attacker: Side.French,
            from: FROM,
            into: INTO,
            defenders: ['A-wall'],
            defenseLeaders: ['A-wall'],
            orders: [
                { kind: CommandKind.Corps, commanderId: 'lannes', unitIds: ['F-lead', 'F-other'] }
            ],
            leaders: ['F-lead']
        })
        expect(game.hydrated.playerOf(Side.French).morale).toBe(23 - 3)

        passUntil(game, '1 December · 4:00PM')
        passTurns(game, 1)
        expect(game.hydrated.playerOf(Side.Allied).morale).toBe(16)
        expect(game.hydrated.playerOf(Side.French).morale).toBe(20)
        passTurns(game, 1)
        expect(label(game)).toBe('1 December · Night')
        expect(game.activePlayerId).toBe(game.playerOf(Side.Allied))
        expect(game.hydrated.playerOf(Side.Allied).morale).toBe(16 + 4)
        expect(game.hydrated.playerOf(Side.French).morale).toBe(20 + 1)

        passUntil(game, '2 December · 8:00AM')
        expect(game.hydrated.playerOf(Side.Allied).morale).toBe(20)
        expect(game.hydrated.playerOf(Side.French).morale).toBe(21)
    })
})

describe('the 2 December game', () => {
    it('has no night round', () => {
        const game = frenchTurn([
            { id: 'F-inf', side: Side.French, face: infantry(3), locale: FROM },
            { id: 'A-inf', side: Side.Allied, face: infantry(2), locale: INTO }
        ])
        const rounds = new Set<string>()
        while (game.state.machineState !== MachineState.EndOfGame) {
            rounds.add(label(game))
            expect(game.hydrated.currentRound.night).toBe(false)
            passTurns(game, 1)
        }
        expect(rounds.size).toBe(10)
    })
})
