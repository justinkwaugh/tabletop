import { describe, expect, it } from 'vitest'
import { AUSTERLITZ } from '../components/austerlitz.js'
import { Side } from '../components/pieces.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import {
    assault,
    frenchTurn,
    infantry,
    type PiecePlacement,
    type TestGame
} from '../testing/harness.js'
import { CommandKind, type MoveOrder } from './attack.js'

const FROM = 95
const INTO = 108
const WIDE_FROM = 93
const WIDE_INTO = 94

function french(id: string, strength: number, commanderId?: string): PiecePlacement {
    return { id, side: Side.French, face: infantry(strength), locale: FROM, commanderId }
}

function corpsMove(commanderId: string, unitIds: string[]): MoveOrder {
    return { kind: CommandKind.Corps, commanderId, unitIds }
}

const holding: PiecePlacement = {
    id: 'A-inf',
    side: Side.Allied,
    face: infantry(3),
    locale: INTO,
    facing: FROM
}

function repulsed(attackers: readonly PiecePlacement[], orders: MoveOrder[]): TestGame {
    const game = frenchTurn([...attackers, holding])
    const declared = assault(game, {
        attacker: Side.French,
        from: FROM,
        into: INTO,
        defenders: ['A-inf'],
        defenseLeaders: ['A-inf'],
        orders,
        leaders: ['F-lead']
    })
    expect(declared).toMatchObject({ attackerWon: false })
    return game
}

function regroup(game: TestGame, keep: Record<string, string>) {
    return game.act(ActionType.Regroup, game.playerOf(Side.French), { keep })
}

describe('regrouping a corps thrown back from an attack (rule 11, step 11)', () => {
    const corps = [
        french('F-lead', 3, 'lannes'),
        french('F-2', 2, 'lannes'),
        french('F-3', 2, 'lannes')
    ]

    function thrownBack(): TestGame {
        return repulsed(
            [...corps, french('F-fresh', 3)],
            [corpsMove('lannes', ['F-lead', 'F-2', 'F-3'])]
        )
    }

    it('waits on the attacker to name the one unit that stays with its commander', () => {
        const game = thrownBack()
        expect(game.state.machineState).toBe(MachineState.ResolvingAttack)
        expect(game.activePlayerId).toBe(game.playerOf(Side.French))
        expect(() => regroup(game, {})).toThrow(/stays with lannes/)
        expect(() => regroup(game, { lannes: 'F-fresh' })).toThrow(/stays with lannes/)
        expect(() => game.act(ActionType.EndTurn, game.playerOf(Side.French))).toThrow()
    })

    it('detaches every other attacking unit and leaves them all in the attack reserve', () => {
        const game = thrownBack()
        regroup(game, { lannes: 'F-3' })
        const state = game.hydrated
        expect(state.machineState).toBe(MachineState.Commanding)
        expect(state.attack).toBeUndefined()
        expect(state.corpsUnits('lannes').map((unit) => unit.id)).toEqual(['F-3'])
        expect(state.unit('F-lead').commanderId).toBeUndefined()
        expect(state.unit('F-2').commanderId).toBeUndefined()
        expect(state.unit('F-lead').face).toEqual(infantry(1))
        for (const piece of [
            ...corps.map((unit) => state.unit(unit.id)),
            state.commander('lannes')
        ]) {
            expect(piece.position).toEqual({ locale: FROM })
        }
        expect(state.playerOf(Side.French).morale).toBe(21)
    })

    it('leaves the beaten pieces unable to move again, and the approach closed, for the turn', () => {
        const game = thrownBack()
        regroup(game, { lannes: 'F-3' })
        const player = game.playerOf(Side.French)
        const aside = { locale: FROM, approach: AUSTERLITZ.approachBetween(FROM, 83).id }
        expect(() =>
            game.act(ActionType.Move, player, {
                order: { kind: CommandKind.Unit, unitIds: ['F-2'] },
                to: aside
            })
        ).toThrow()
        expect(() =>
            game.act(ActionType.Move, player, { order: corpsMove('lannes', ['F-3']), to: aside })
        ).toThrow()
        expect(() =>
            game.act(ActionType.ThreatenAttack, player, {
                approach: AUSTERLITZ.approachBetween(FROM, INTO).id
            })
        ).toThrow(/No further attack/)
        game.act(ActionType.Move, player, {
            order: { kind: CommandKind.Unit, unitIds: ['F-fresh'] },
            to: aside
        })
        expect(game.hydrated.unit('F-fresh').position).toEqual(aside)
    })

    it('asks nothing of a corps with a single attacking unit left', () => {
        const game = repulsed(
            [french('F-lead', 2, 'lannes'), french('F-other', 3, 'lannes')],
            [corpsMove('lannes', ['F-lead', 'F-other'])]
        )
        const state = game.hydrated
        expect(state.machineState).toBe(MachineState.Commanding)
        expect(state.findUnit('F-lead')).toBeUndefined()
        expect(state.unit('F-other').face).toEqual(infantry(2))
        expect(state.unit('F-other').commanderId).toBe('lannes')
        expect(state.commander('lannes').position).toEqual({ locale: FROM })
        expect(state.playerOf(Side.French).morale).toBe(20)
    })
})

describe('where the beaten attackers end up (rule 11, step 11)', () => {
    it('withdraws them from the attack approach into reserve and leaves other pieces on it', () => {
        const blocking = (placement: PiecePlacement) => ({ ...placement, facing: INTO })
        const game = repulsed(
            [
                blocking(french('F-lead', 3, 'lannes')),
                blocking(french('F-2', 2, 'lannes')),
                blocking(french('F-stays', 2))
            ],
            [corpsMove('lannes', ['F-lead', 'F-2'])]
        )
        regroup(game, { lannes: 'F-2' })
        const state = game.hydrated
        expect(state.unit('F-lead').position).toEqual({ locale: FROM })
        expect(state.unit('F-2').position).toEqual({ locale: FROM })
        expect(state.commander('lannes').position).toEqual({ locale: FROM })
        expect(state.unit('F-stays').position).toEqual({
            locale: FROM,
            approach: AUSTERLITZ.approachBetween(FROM, INTO).id
        })
        expect(state.unit('F-lead').commanderId).toBeUndefined()
        expect(state.unit('F-2').commanderId).toBe('lannes')
    })

    it('leaves the rest of a corps alone when only a detachment of it attacked', () => {
        const game = frenchTurn([
            french('F-lead', 3, 'lannes'),
            french('F-2', 2, 'lannes'),
            french('F-3', 2, 'lannes'),
            french('F-4', 2, 'lannes'),
            holding
        ])
        const declared = assault(game, {
            attacker: Side.French,
            from: FROM,
            into: INTO,
            defenders: ['A-inf'],
            defenseLeaders: ['A-inf'],
            orders: [
                { kind: CommandKind.Detach, commanderId: 'lannes', unitIds: ['F-lead', 'F-2'] }
            ],
            leaders: ['F-lead']
        })
        expect(declared).toMatchObject({ attackerWon: false })
        const state = game.hydrated
        expect(state.machineState).toBe(MachineState.Commanding)
        expect(state.corpsUnits('lannes').map((unit) => unit.id)).toEqual(['F-3', 'F-4'])
        expect(state.unit('F-lead').commanderId).toBeUndefined()
        expect(state.unit('F-2').commanderId).toBeUndefined()
        expect(state.commander('lannes').position).toEqual({ locale: FROM })
    })
})

describe('two corps thrown back together (rule 11)', () => {
    function thrownBack(): TestGame {
        const at = (placement: PiecePlacement) => ({ ...placement, locale: WIDE_FROM })
        const game = frenchTurn([
            at(french('F-lead', 3, 'lannes')),
            at(french('F-a2', 2, 'lannes')),
            at(french('F-b1', 2, 'murat')),
            at(french('F-b2', 2, 'murat')),
            {
                id: 'A-1',
                side: Side.Allied,
                face: infantry(3),
                locale: WIDE_INTO,
                facing: WIDE_FROM
            },
            {
                id: 'A-2',
                side: Side.Allied,
                face: infantry(3),
                locale: WIDE_INTO,
                facing: WIDE_FROM
            }
        ])
        assault(game, {
            attacker: Side.French,
            from: WIDE_FROM,
            into: WIDE_INTO,
            defenders: ['A-1', 'A-2'],
            defenseLeaders: ['A-1', 'A-2'],
            orders: [corpsMove('lannes', ['F-lead', 'F-a2']), corpsMove('murat', ['F-b1', 'F-b2'])],
            leaders: ['F-lead'],
            target: 'A-1'
        })
        game.act(ActionType.CounterAttack, game.playerOf(Side.Allied), { unitIds: [] })
        return game
    }

    it('each keep one unit', () => {
        const game = thrownBack()
        expect(game.state.machineState).toBe(MachineState.ResolvingAttack)
        expect(() => regroup(game, { lannes: 'F-a2' })).toThrow(/stays with murat/)
        regroup(game, { lannes: 'F-a2', murat: 'F-b1' })
        const state = game.hydrated
        expect(state.machineState).toBe(MachineState.Commanding)
        expect(state.corpsUnits('lannes').map((unit) => unit.id)).toEqual(['F-a2'])
        expect(state.corpsUnits('murat').map((unit) => unit.id)).toEqual(['F-b1'])
        expect(state.unit('F-lead').commanderId).toBeUndefined()
        expect(state.unit('F-b2').commanderId).toBeUndefined()
    })
})

describe('a defence from reserve that throws the attack back (rule 11, step 11)', () => {
    it('has the attacker regroup and then the defender step up to the approach', () => {
        const defender = (id: string, strength: number): PiecePlacement => ({
            id,
            side: Side.Allied,
            face: infantry(strength),
            locale: INTO,
            commanderId: 'langeron'
        })
        const game = frenchTurn([
            french('F-lead', 3, 'lannes'),
            french('F-2', 2, 'lannes'),
            defender('A-1', 3),
            defender('A-2', 2),
            defender('A-3', 2)
        ])
        const attacker = game.playerOf(Side.French)
        const allied = game.playerOf(Side.Allied)
        const declared = assault(game, {
            attacker: Side.French,
            from: FROM,
            into: INTO,
            defenders: ['A-1', 'A-2', 'A-3'],
            defenseLeaders: ['A-1'],
            orders: [corpsMove('lannes', ['F-lead', 'F-2'])],
            leaders: ['F-lead']
        })
        expect(declared).toMatchObject({ initialResult: 0 })
        const countered = game.outcome(ActionType.CounterAttack, allied, { unitIds: [] })
        expect(countered).toMatchObject({ finalResult: 0, attackerWon: false })

        expect(game.activePlayerId).toBe(attacker)
        regroup(game, { lannes: 'F-2' })
        expect(game.state.machineState).toBe(MachineState.ResolvingAttack)
        expect(game.activePlayerId).toBe(allied)
        game.act(ActionType.Advance, allied, { unitIds: ['A-2'], commanderIds: [] })

        const state = game.hydrated
        expect(state.machineState).toBe(MachineState.Commanding)
        expect(game.activePlayerId).toBe(attacker)
        expect(state.unit('F-lead').commanderId).toBeUndefined()
        expect(state.unit('A-2').position).toEqual({
            locale: INTO,
            approach: AUSTERLITZ.approachBetween(INTO, FROM).id
        })
        expect(state.unit('A-2').commanderId).toBeUndefined()
        expect(state.commander('langeron').position).toEqual({ locale: INTO })
        expect(state.playerOf(Side.French).morale).toBe(22)
        expect(state.playerOf(Side.Allied).morale).toBe(27)
    })
})
