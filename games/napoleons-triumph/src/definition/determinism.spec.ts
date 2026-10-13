import { ActionSource, type GameAction } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { AUSTERLITZ } from '../components/austerlitz.js'
import { STARTING_ARMIES, Side, UnitType, type Face } from '../components/pieces.js'
import { CommandKind } from '../model/attack.js'
import { FeintEnd } from '../model/attackDeclaration.js'
import type { NapoleonsTriumphGameState } from '../model/gameState.js'
import { TestGame, arrangeBattlefield, type PiecePlacement } from '../testing/harness.js'
import { ActionType } from './actions.js'
import { SideSelection } from './config.js'
import { MachineState } from './states.js'

const SEED = '5eed5eed5eed5eed5eed5eed5eed5eed'
const OTHER_SEED = '0ddba110ddba110ddba110ddba110dd0'
const SIXTEEN_SEEDS = Array.from({ length: 16 }, (_, digit) => digit.toString(16).repeat(32))

const BETWEEN = 94
const ST_HILAIRE = 93
const BAGRATION = 67

function withoutInstanceId(state: NapoleonsTriumphGameState) {
    return { ...state, id: undefined }
}

function withoutTimestamps(actions: readonly GameAction[]) {
    return actions.map((action) => ({ ...action, createdAt: undefined }))
}

function facesById(game: TestGame): Record<string, Face | undefined> {
    return Object.fromEntries(game.canonical.units.map((unit) => [unit.id, unit.face]))
}

function ordered(faces: readonly (Face | undefined)[]): string[] {
    return faces.map((face) => JSON.stringify(face)).toSorted()
}

describe('starting a game from a master seed', () => {
    it('deals the same blocks to the same armies and players for the same seed', () => {
        const first = new TestGame({}, SEED)
        const second = new TestGame({}, SEED)
        expect(withoutInstanceId(second.canonical)).toEqual(withoutInstanceId(first.canonical))
        expect(second.playerOf(Side.Allied)).toBe(first.playerOf(Side.Allied))
    })

    it('deals the same armies differently for another seed', () => {
        const first = new TestGame({}, SEED)
        const second = new TestGame({}, OTHER_SEED)
        expect(facesById(second)).not.toEqual(facesById(first))
        for (const game of [first, second]) {
            for (const side of [Side.French, Side.Allied]) {
                const army = game.canonical.units.filter(
                    (unit) => unit.playerId === game.playerOf(side)
                )
                expect(ordered(army.map((unit) => unit.face))).toEqual(
                    ordered(STARTING_ARMIES[side])
                )
            }
        }
    })

    it('gives either player the Allies, depending on the seed', () => {
        const allies = SIXTEEN_SEEDS.map((seed) => new TestGame({}, seed).playerOf(Side.Allied))
        expect(new Set(allies)).toEqual(new Set(['p0', 'p1']))
        expect(SIXTEEN_SEEDS.map((seed) => new TestGame({}, seed).playerOf(Side.Allied))).toEqual(
            allies
        )
    })

    it('lets either player open the morale auction, depending on the seed (rule 17)', () => {
        const auction = { sideSelection: SideSelection.Auction }
        const openers = SIXTEEN_SEEDS.map((seed) => new TestGame(auction, seed).activePlayerId)
        expect(new Set(openers)).toEqual(new Set(['p0', 'p1']))
        expect(SIXTEEN_SEEDS.map((seed) => new TestGame(auction, seed).activePlayerId)).toEqual(
            openers
        )
    })
})

describe('playing the same actions from the same seed', () => {
    function opening(seed: string): { game: TestGame; transcript: GameAction[] } {
        const game = new TestGame({}, seed)
        const allied = game.playerOf(Side.Allied)
        const french = game.playerOf(Side.French)
        const transcript = [...game.deploy(Side.Allied), ...game.deploy(Side.French)]
        const [picket] = game.hydrated.corpsUnits('langeron')
        const [feinter] = game.hydrated.corpsUnits('st-hilaire')
        const play = (type: ActionType, playerId: string, payload?: Record<string, unknown>) =>
            transcript.push(...game.act(type, playerId, payload))

        play(ActionType.Move, allied, {
            order: { kind: CommandKind.Unit, unitIds: [picket.id] },
            to: { locale: BETWEEN }
        })
        play(ActionType.EndTurn, allied)
        play(ActionType.ThreatenAttack, french, {
            approach: AUSTERLITZ.approachBetween(ST_HILAIRE, BETWEEN).id
        })
        play(ActionType.DeclareDefense, allied, { unitIds: [picket.id], leaderIds: [] })
        play(ActionType.DeclareFeint, french, {
            orders: [{ kind: CommandKind.Unit, unitIds: [feinter.id] }],
            end: FeintEnd.Reserve
        })
        play(ActionType.EndTurn, french)
        return { game, transcript }
    }

    it('reaches the same state through the same actions, the automatic ones included', () => {
        const first = opening(SEED)
        const second = opening(SEED)
        expect(first.game.state.machineState).toBe(MachineState.Commanding)
        expect(first.game.hydrated.round).toBe(1)
        expect(
            first.transcript
                .filter((action) => action.source === ActionSource.System)
                .map((action) => action.type)
        ).toEqual([ActionType.Advance])
        expect(withoutTimestamps(second.transcript)).toEqual(withoutTimestamps(first.transcript))
        expect(withoutInstanceId(second.game.canonical)).toEqual(
            withoutInstanceId(first.game.canonical)
        )
        expect(second.game.state.actionChecksum).toBe(first.game.state.actionChecksum)
    })

    it('plays the same game on other blocks from another seed', () => {
        const first = opening(SEED)
        const second = opening(OTHER_SEED)
        expect(second.transcript.map((action) => action.type)).toEqual(
            first.transcript.map((action) => action.type)
        )
        expect(facesById(second.game)).not.toEqual(facesById(first.game))
    })
})

describe('the shuffle of blocks at the end of a turn (rule 7)', () => {
    const corps: PiecePlacement[] = [
        ...[1, 2, 3].map((strength) => ({ type: UnitType.Infantry, strength })),
        ...[1, 2, 3].map((strength) => ({ type: UnitType.Cavalry, strength })),
        { type: UnitType.Artillery, strength: 1 },
        { type: UnitType.Infantry, strength: 3, guard: true as const }
    ].map((face, index) => ({
        id: `A-${index}`,
        side: Side.Allied,
        face,
        locale: BAGRATION,
        commanderId: 'bagration'
    }))

    function shuffled(seed: string): (Face | undefined)[] {
        const game = new TestGame({}, seed)
        game.deployBoth()
        arrangeBattlefield(game, corps)
        game.act(ActionType.EndTurn, game.playerOf(Side.Allied))
        return game.canonical.units.map((unit) => unit.face)
    }

    it('comes out the same for the same seed and differently for another', () => {
        const dealt = corps.map((unit) => unit.face)
        const first = shuffled(SEED)
        expect(shuffled(SEED)).toEqual(first)
        expect(shuffled(OTHER_SEED)).not.toEqual(first)
        expect(first).not.toEqual(dealt)
        expect(ordered(first)).toEqual(ordered(dealt))
    })
})
