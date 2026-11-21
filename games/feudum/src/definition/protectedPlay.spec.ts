import {
    ActionSource,
    GameEngine,
    latestPlayerUndoTarget,
    playerUndoRestriction,
    PlayerUndoRestriction,
    Visibility,
    type GameAction
} from '@tabletop/common'
import { Value } from 'typebox/value'
import { describe, expect, it } from 'vitest'
import type { FeudumProjectedState, HydratedFeudumGameState } from '../model/gameState.js'
import { placeMarker } from '../model/locationControl.js'
import { moveConcealedSeal } from '../model/seals.js'
import type { FeudumVault } from '../model/vault.js'
import { giveTile, tableInWindow } from '../testing/atWill.js'
import { Battlefield, buildFeudum } from '../testing/combat.js'
import { setPawns } from '../testing/guilds.js'
import {
    asStored,
    canonical,
    concealedSeals,
    needsHost,
    perspectivesOf,
    processedOf,
    realGames,
    recordFor,
    runGuarded,
    sealsNamedIn,
    Spectator,
    started,
    transitionsOf,
    viewOf,
    writsNamedIn,
    type Transition
} from '../testing/protected.js'
import type { Table } from '../testing/table.js'
import type { GameWalk, WalkStep } from '../testing/walk.js'
import { ActionType } from './actions.js'
import { FeudumRuntime } from './runtime.js'
import { MachineState } from './states.js'

const engine = new GameEngine(FeudumRuntime)

const AlwaysBarriers: readonly string[] = [
    ActionType.FinaliseHand,
    ActionType.RevealPouches,
    ActionType.Explore,
    ActionType.Harvest,
    ActionType.AnswerAttack,
    ActionType.AnswerStarve,
    ActionType.ReplenishMap,
    ActionType.ReplenishGuilds,
    ActionType.ScoreGame
]

function sealLeftVault(before: FeudumVault, after: FeudumVault): boolean {
    const remaining = new Set(concealedSeals(after))
    return concealedSeals(before).some((sealId) => !remaining.has(sealId))
}

/** R-X.2, DM §6 What the table learned from this Action, read from what happened to hidden state. */
function revealed({ action, before, after }: Transition): boolean {
    if (AlwaysBarriers.includes(action.type)) {
        return true
    }
    if (
        (action.type === ActionType.Conquer &&
            after.machineState === MachineState.AwaitingDefence) ||
        (action.type === ActionType.StarveThePeople &&
            after.machineState === MachineState.AwaitingImmunity)
    ) {
        return true
    }
    const cursor = ({ protectedPrng }: Transition['before']) => protectedPrng?.invocations ?? 0
    return (
        // A draw that reshuffled the discards can leave the deck no shorter: its record says it drew.
        /"drawnWritIds":\["/.test(JSON.stringify(action)) ||
        after.vault.writDeck.length < before.vault.writDeck.length ||
        sealLeftVault(before.vault, after.vault) ||
        Object.keys(after.vault.tileLandscapes).length <
            Object.keys(before.vault.tileLandscapes).length ||
        (cursor(after) > cursor(before) &&
            after.vault.sealPile.length <= before.vault.sealPile.length)
    )
}

const games = realGames()

interface Findings {
    guardedRan: string[]
    guardedDeferredNeedlessly: string[]
    guardedDiffers: string[]
    deferred: Set<string>
    ranOptimistically: Set<string>
    offersDiffer: string[]
    spectatorOffered: string[]
    barrierWrong: string[]
    barriers: number
    undoCrossed: string[]
    undoReason: string[]
    undoRefusedNeedlessly: string[]
    undoable: number
    historyRedacted: string[]
    historyForward: string[]
    historyBack: string[]
    patchesNaming: string[]
    replayed: Map<number, Set<string>>
}

const findings: Findings = {
    guardedRan: [],
    guardedDeferredNeedlessly: [],
    guardedDiffers: [],
    deferred: new Set(),
    ranOptimistically: new Set(),
    offersDiffer: [],
    spectatorOffered: [],
    barrierWrong: [],
    barriers: 0,
    undoCrossed: [],
    undoReason: [],
    undoRefusedNeedlessly: [],
    undoable: 0,
    historyRedacted: [],
    historyForward: [],
    historyBack: [],
    patchesNaming: [],
    replayed: new Map()
}

/** What a record tells a table, apart from when it was made. */
function told(action: GameAction): unknown {
    const { type, playerId, revealsInfo } = action
    return asStored({ type, playerId, revealsInfo, metadata: Reflect.get(action, 'metadata') })
}

function scanGuarded(walk: GameWalk, step: WalkStep, where: string): void {
    const hostOnly = needsHost(step)
    const result = runGuarded(walk, step)
    const { input } = step
    if (result === undefined) {
        findings.deferred.add(input.type)
        if (!hostOnly) {
            findings.guardedDeferredNeedlessly.push(where)
        }
        return
    }
    findings.ranOptimistically.add(input.type)
    if (hostOnly) {
        findings.guardedRan.push(where)
    }
    const expected = viewOf(
        step.after[step.after.length - 1],
        { kind: 'player', playerId: input.playerId },
        walk
    )
    if (
        !Value.Equal(asStored(result.updatedState), asStored(expected)) ||
        !Value.Equal(result.processedActions.map(told), step.processed.map(told))
    ) {
        findings.guardedDiffers.push(where)
    }
}

function scanOffers(walk: GameWalk, step: WalkStep, where: string): void {
    const game = started(walk)
    const state = step.before
    for (const { id: seat } of game.players) {
        const perspective: Visibility.Perspective = { kind: 'player', playerId: seat }
        const seen = engine.getValidActionTypesForPlayer(
            game,
            viewOf(state, perspective, walk),
            seat,
            {
                perspective
            }
        )
        const held = engine.getValidActionTypesForPlayer(game, state, seat)
        if (!Value.Equal([...seen].sort(), [...held].sort())) {
            findings.offersDiffer.push(`${where} ${seat}: ${held.join()} / ${seen.join()}`)
        }
        const watched = engine.getValidActionTypesForPlayer(
            game,
            viewOf(state, Spectator, walk),
            seat,
            {
                perspective: Spectator
            }
        )
        if (watched.length > 0) {
            findings.spectatorOffered.push(`${where} ${seat}`)
        }
    }
}

function scanBarriers(walk: GameWalk): void {
    for (const transition of transitionsOf(walk)) {
        const { action } = transition
        const set = action.revealsInfo === true
        findings.barriers += set ? 1 : 0
        if (set !== revealed(transition)) {
            findings.barrierWrong.push(`${action.type}#${action.index ?? '?'} set ${String(set)}`)
        }
    }
}

function scanUndo(walk: GameWalk): void {
    const seats = walk.game.players.map(({ id }) => id)
    const prefix: GameAction[] = []
    for (const step of walk.steps) {
        prefix.push(...step.processed)
        const barrier = step.processed.some(({ revealsInfo }) => revealsInfo === true)
        const [first] = step.processed
        const where = `${first.type}#${first.index ?? '?'}`
        if (barrier) {
            for (const seat of seats) {
                if (latestPlayerUndoTarget(prefix, seat) !== undefined) {
                    findings.undoCrossed.push(`${where} ${seat}`)
                }
            }
            if (
                playerUndoRestriction(step.processed, first, step.input.playerId) !==
                PlayerUndoRestriction.RevealsInformation
            ) {
                findings.undoReason.push(where)
            }
        } else if (first.source === ActionSource.User) {
            if (latestPlayerUndoTarget(prefix, step.input.playerId)?.index === first.index) {
                findings.undoable += 1
            } else {
                findings.undoRefusedNeedlessly.push(where)
            }
        }
    }
}

function scanHistory(walk: GameWalk): void {
    const transitions = transitionsOf(walk)
    const actions = processedOf(walk)
    const currentState = canonical(walk.final)
    const seen = findings.replayed.get(walk.game.players.length) ?? new Set<string>()
    findings.replayed.set(walk.game.players.length, seen)
    for (const perspective of perspectivesOf(walk)) {
        const seat = perspective.kind === 'player' ? perspective.playerId : 'spectator'
        const history = Visibility.projectActionHistory({
            visibility: FeudumRuntime.visibility,
            currentState,
            actions,
            perspective,
            game: walk.game
        })
        const start = viewOf(walk.initial, perspective, walk)
        let view = start
        for (const [index, record] of history.actions.entries()) {
            const where = `${record.type}#${index} ${seat}`
            if (Visibility.isRedactedAction(record)) {
                findings.historyRedacted.push(where)
            }
            const { before, after } = transitions[index]
            const stayedHidden = new Set(concealedSeals(after.vault))
            const hidden = new Set(
                concealedSeals(before.vault).filter((id) => stayedHidden.has(id))
            )
            const expected = viewOf(after, perspective, walk)
            const shown = [...writsNamedIn(view), ...writsNamedIn(expected)]
            const patches = [record.forwardPatch, record.undoPatch]
            if (
                sealsNamedIn(patches).some((sealId) => hidden.has(sealId)) ||
                writsNamedIn(patches).some((writId) => !shown.includes(writId))
            ) {
                findings.patchesNaming.push(where)
            }
            view = engine.applyProcessedAction({ game: walk.game, state: view, action: record })
            if (!Value.Equal(asStored(view), asStored(expected))) {
                findings.historyForward.push(where)
            }
            seen.add(record.type)
        }
        for (const record of history.actions.toReversed()) {
            view = engine.undoProcessedAction({ state: view, action: record })
        }
        if (!Value.Equal(asStored(view), asStored(start))) {
            findings.historyBack.push(seat)
        }
    }
}

for (const walk of games) {
    for (const step of walk.steps) {
        const [first] = step.processed
        const where = `${first.type}#${first.index ?? '?'} p${walk.game.players.length}`
        scanGuarded(walk, step, where)
        scanOffers(walk, step, where)
    }
    scanBarriers(walk)
    scanUndo(walk)
    scanHistory(walk)
}

const OptimisticCardPlays = [
    ActionType.Move,
    ActionType.Migrate,
    ActionType.Influence,
    ActionType.Tax,
    ActionType.TendLandscape,
    ActionType.ForfeitCard,
    ActionType.PlayDefend
]

/** R-5.1 Every Action type that reveals or conceals something, which a projected history must carry. */
const HiddenInformationActions = [
    ActionType.FinaliseHand,
    ActionType.Explore,
    ActionType.KeepWrits,
    ActionType.Harvest,
    ActionType.ChooseFavours,
    ActionType.PlaceDisc,
    ActionType.GuildAction,
    ActionType.Improve,
    ActionType.RollProgressDie,
    ActionType.PlayMandate,
    ActionType.DiscardWrit,
    ActionType.StarveThePeople,
    ActionType.AnswerStarve,
    ActionType.ReplenishMap,
    ActionType.ReplenishGuilds,
    ActionType.ScoreGame
]

/** R-5.1 What a game draws at any player count. */
const CommonHiddenActions = [
    ActionType.FinaliseHand,
    ActionType.Explore,
    ActionType.KeepWrits,
    ActionType.Harvest,
    ActionType.ReplenishMap,
    ActionType.ReplenishGuilds,
    ActionType.ScoreGame
]

describe('R-5.1, R-X.2 protected play over whole games at 2 to 5 players', () => {
    it('R-5.1, R-5-H1 no step that reads the vault or the protected stream runs from a view', () => {
        expect(findings.guardedRan).toEqual([])
        expect(findings.deferred).toContain(ActionType.Explore)
        expect(findings.deferred).toContain(ActionType.Harvest)
    })

    it('R-5.1 a step that needs nothing hidden runs from its seat’s own view', () => {
        expect(findings.guardedDeferredNeedlessly).toEqual([])
    })

    it('R-5.1 every card play from the owner-known hand runs optimistically', () => {
        expect([...findings.ranOptimistically]).toEqual(expect.arrayContaining(OptimisticCardPlays))
    })

    it('R-5.1 what ran from a view is what the host reaches, record and state', () => {
        expect(findings.guardedDiffers).toEqual([])
    })

    it('R-5.1 a projection offers its own seat what canonical state offers, a spectator nothing', () => {
        expect(findings.offersDiffer).toEqual([])
        expect(findings.spectatorOffered).toEqual([])
    })

    it('R-X.2, DM §6 revealsInfo is set exactly on what revealed something', () => {
        expect(findings.barrierWrong).toEqual([])
        expect(findings.barriers).toBeGreaterThan(0)
    })

    it('R-X.2 Undo is refused across a barrier, for every seat', () => {
        expect(findings.undoCrossed).toEqual([])
        expect(findings.undoReason).toEqual([])
    })

    it('R-X.2 a step that revealed nothing stays undoable by its seat', () => {
        expect(findings.undoRefusedNeedlessly).toEqual([])
        expect(findings.undoable).toBeGreaterThan(0)
    })

    it('R-5.1 a projected history replays forward to every state, every seat and a spectator', () => {
        expect(findings.historyRedacted).toEqual([])
        expect(findings.historyForward).toEqual([])
    })

    it('R-5.1 a projected history undoes back to the start', () => {
        expect(findings.historyBack).toEqual([])
    })

    it('R-5.1, R-5-H1 no patch names what its view may not see', () => {
        expect(findings.patchesNaming).toEqual([])
    })

    it.each([2, 3, 4, 5])(
        'R-5.1 a %i-player history carries the hidden-information Actions',
        (n) => {
            const replayed = [...(findings.replayed.get(n) ?? [])]
            expect(replayed).toEqual(expect.arrayContaining(CommonHiddenActions))
        }
    )

    it('R-5.1 between them the histories carry every hidden-information Action', () => {
        const replayed = [...findings.replayed.values()].flatMap((types) => [...types])
        expect(replayed).toEqual(expect.arrayContaining(HiddenInformationActions))
    })
})

type AtWill = Record<string, unknown> & { type: ActionType }

/** The at-will Actions no walk's seats pick: each from the window before a card, one seat's move. */
const AtWillPlays: {
    readonly name: string
    readonly edit: (state: HydratedFeudumGameState, playerId: string) => void
    readonly move: (table: Table, playerId: string) => AtWill
    readonly guarded: 'defers' | 'runs'
}[] = [
    {
        name: ActionType.ReclaimImmunitySeal,
        edit: (state, playerId) => {
            const ruler = state.turnManager.turnOrder.find((seat) => seat !== playerId) ?? ''
            setPawns(state, playerId, ['knight'])
            buildFeudum(state, ruler)
            placeMarker(state, playerId, Battlefield)
            moveConcealedSeal(
                state,
                { kind: 'pile' },
                { kind: 'immunity', spaceId: Battlefield, role: 'serf' }
            )
        },
        move: () => ({
            type: ActionType.ReclaimImmunitySeal,
            spaceId: Battlefield,
            role: 'serf'
        }),
        guarded: 'defers'
    },
    {
        name: ActionType.SpendRegionTile,
        edit: (state, playerId) => {
            giveTile(state, playerId)
        },
        move: (table, playerId) => ({
            type: ActionType.SpendRegionTile,
            tileId: table.seat(playerId).regionTiles[0],
            good: 'iron'
        }),
        guarded: 'runs'
    },
    {
        name: ActionType.PlaceVessel,
        edit: (state, playerId) => {
            state.supply.vessels.ship -= 1
            state.getPlayerState(playerId).vessels.ship += 1
            setPawns(state, playerId, ['knight', 'farmer'])
        },
        move: () => ({ type: ActionType.PlaceVessel, vesselType: 'ship', pawn: 2 }),
        guarded: 'runs'
    }
]

describe.each(AtWillPlays)('R-4.4-H1, R-5.1 $name in a whole table', ({ edit, move, guarded }) => {
    const play = () => {
        const { table, playerId } = tableInWindow('before a card', edit)
        const before = canonical(table.state)
        const input = move(table, playerId)
        const [action, ...rest] = table.send(playerId, input)
        return { table, playerId, before, input, action, rest, after: canonical(table.state) }
    }

    it('R-X.2 is not a barrier', () => {
        expect(play().action.revealsInfo).toBeFalsy()
    })

    it('R-5-H1 names no seal drawn unseen in any view', () => {
        const { table, before, after, action } = play()
        const hidden = new Set(concealedSeals(before.vault).concat(concealedSeals(after.vault)))
        for (const perspective of perspectivesOf(table)) {
            const seen = [recordFor(action, perspective, table), viewOf(after, perspective, table)]
            expect(sealsNamedIn(seen).filter((sealId) => hidden.has(sealId))).toEqual([])
        }
    })

    it(`R-5.1 from its seat's own view it ${guarded}`, () => {
        const { table, playerId, before, input, action } = play()
        const perspective: Visibility.Perspective = { kind: 'player', playerId }
        const run = () =>
            engine.executeAction({
                game: started(table),
                state: viewOf(before, perspective, table),
                action: {
                    id: action.id,
                    gameId: table.game.id,
                    source: ActionSource.User,
                    playerId,
                    ...input
                },
                perspective
            })
        if (guarded === 'defers') {
            expect(run).toThrow(Visibility.UnavailableProjectedValueError)
        } else {
            expect(asStored(run().updatedState)).toEqual(
                asStored(viewOf(table.state, perspective, table))
            )
        }
    })

    it('R-5.1 replays in a projected history, every seat and a spectator', () => {
        const { table, before, action, rest, after } = play()
        for (const perspective of perspectivesOf(table)) {
            const history = Visibility.projectActionHistory({
                visibility: FeudumRuntime.visibility,
                currentState: after,
                actions: [action, ...rest],
                startIndex: before.actionCount,
                perspective,
                game: table.game
            })
            const start = viewOf(before, perspective, table)
            const forward = history.actions.reduce<FeudumProjectedState>(
                (state, record) =>
                    engine.applyProcessedAction({ game: table.game, state, action: record }),
                start
            )
            expect(asStored(forward)).toEqual(asStored(viewOf(after, perspective, table)))
            const back = history.actions
                .toReversed()
                .reduce<FeudumProjectedState>(
                    (state, record) => engine.undoProcessedAction({ state, action: record }),
                    forward
                )
            expect(asStored(back)).toEqual(asStored(start))
        }
    })
})
