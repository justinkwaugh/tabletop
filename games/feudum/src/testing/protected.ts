import { assert, Visibility, type GameAction } from '@tabletop/common'
import { FeudumRuntime } from '../definition/runtime.js'
import {
    FeudumGameStateValidator,
    type FeudumGameState,
    type FeudumProjectedState
} from '../model/gameState.js'
import type { FeudumVault } from '../model/vault.js'
import { corpusGames } from './corpusWalk.js'
import type { GameWalk, WalkStep } from './walk.js'

export const Spectator: Visibility.Perspective = { kind: 'spectator' }

export function seedOf(n: number): string {
    return n.toString(16).padStart(32, '0')
}

/**
 * Real games at 2 to 5 players whose seats go after what they haven't fired yet: between them they
 * draw writs by every source, flip and return seals, take tiles, starve, attack and score.
 */
const RealGames = [
    { seed: seedOf(12), numPlayers: 2 },
    { seed: seedOf(8), numPlayers: 3 },
    { seed: seedOf(2), numPlayers: 4 },
    { seed: seedOf(12), numPlayers: 5 }
]

export function realGames(): GameWalk[] {
    return RealGames.map((game) => corpusGames([game]).walks[0])
}

/** A walk or a scripted table: anything with a game. */
type Tabled = Pick<GameWalk, 'game'>

/** Every seat and a spectator. */
export function perspectivesOf({ game }: Tabled): Visibility.Perspective[] {
    return [
        Spectator,
        ...game.players.map(({ id }): Visibility.Perspective => ({ kind: 'player', playerId: id }))
    ]
}

/** The host's state: a walk's states are complete, which is what projection starts from. */
export function canonical(state: FeudumProjectedState): FeudumGameState {
    assert(FeudumGameStateValidator.Check(state), 'A host state is canonical')
    return state
}

export function viewOf(
    state: FeudumProjectedState,
    perspective: Visibility.Perspective,
    { game }: Tabled
): FeudumProjectedState {
    return FeudumRuntime.visibility.state.project(canonical(state), perspective, {
        config: game.config
    })
}

export function recordFor(
    action: GameAction,
    perspective: Visibility.Perspective,
    { game }: Tabled
): GameAction {
    return FeudumRuntime.visibility.actions.project(action, perspective, { config: game.config })
}

/** One processed Action with the states either side of it. */
export interface Transition {
    readonly action: GameAction
    readonly before: FeudumGameState
    readonly after: FeudumGameState
    readonly step: WalkStep
}

/** A step's Actions, each between the host states it went from and to. */
export function transitionsOfStep(step: WalkStep): Transition[] {
    let before = canonical(step.before)
    return step.processed.map((action, index) => {
        const after = canonical(step.after[index])
        const transition = { action, before, after, step }
        before = after
        return transition
    })
}

export function transitionsOf({ steps }: GameWalk): Transition[] {
    return steps.flatMap(transitionsOfStep)
}

export function processedOf({ steps }: GameWalk): GameAction[] {
    return steps.flatMap(({ processed }) => [...processed])
}

/** R-5-H1 Every seal red side up, wherever the vault keeps it. */
export function concealedSeals(vault: FeudumVault): string[] {
    return [
        ...vault.sealPile,
        ...Object.values(vault.scrollSeals),
        ...Object.values(vault.heldSeals).flat(),
        ...Object.values(vault.charterSeals).flat(),
        ...Object.values(vault.immunitySeals)
    ]
}

const SealId = /seal\.\d+/g
const TileId = /tile\.[a-z]+\.[iv]+/g

/** Every seal a value's text names. */
export function sealsNamedIn(value: unknown): string[] {
    return JSON.stringify(value).match(SealId) ?? []
}

/** Every tile position a value's text names. */
export function tilesNamedIn(value: unknown): string[] {
    return JSON.stringify(value).match(TileId) ?? []
}

const WritId = /writ\.(?:mandate|charter)\.[a-z0-9-]+/g

/** Every writ a value's text names. */
export function writsNamedIn(value: unknown): string[] {
    return JSON.stringify(value).match(WritId) ?? []
}

const OwnerKnown = ['hand', 'writs', 'sealedCharters', 'deckKnowledge']

/** The canonical table with exactly what `perspective` may not see taken away. */
export function withoutConcealed(
    state: FeudumGameState,
    perspective: Visibility.Perspective
): FeudumProjectedState {
    const seen = perspective.kind === 'player' ? perspective.playerId : undefined
    const expected: FeudumProjectedState = structuredClone(state)
    Reflect.deleteProperty(expected, 'vault')
    Reflect.deleteProperty(expected, 'masterSeed')
    expected.protectedPrng = { seed: 0, invocations: 0 }
    for (const player of expected.players) {
        if (player.playerId !== seen) {
            for (const field of OwnerKnown) {
                Reflect.deleteProperty(player, field)
            }
        }
    }
    if (seen !== expected.flow.writDraw?.playerId && expected.flow.writDraw) {
        Reflect.deleteProperty(expected.flow.writDraw, 'drawn')
    }
    return expected
}
