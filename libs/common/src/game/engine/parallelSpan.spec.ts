import { describe, expect, it, vi } from 'vitest'
import { ActionSource, type GameAction } from './gameAction.js'
import { branchView, branchViewDuringMerge } from './branch.js'
import { BranchCloseActionType } from './parallelSpan.js'
import { Visibility } from '../../index.js'
import {
    createSpanGame,
    spanAction,
    SPAN_GAME_ID,
    SPAN_MERGE_ORDER,
    type SpanGameState
} from './tests/spanGame.js'
import {
    beginSpan,
    playLocally,
    playPrivately,
    playerOf,
    restAfterEveryBranch,
    summary,
    type SpanGame
} from './tests/spanPlay.js'

function execute(spanGame: SpanGame, state: SpanGameState, action: GameAction) {
    return spanGame.engine.executeCanonicalAction({ game: spanGame.game, state, action })
}

function inFirstBranch(spanGame: SpanGame): SpanGameState {
    return playLocally(spanGame, beginSpan(spanGame), []).state
}

describe('Parallel Span on the Main Line', () => {
    it('records the span when the Main Line enters the Branching Machine State', () => {
        const spanGame = createSpanGame()
        const state = beginSpan(spanGame)
        expect(state.machineState).toBe('branching')
        expect(state.parallelSpan).toMatchObject({
            machineState: 'branching',
            branchPoint: { actionCount: 1, actionChecksum: state.actionChecksum },
            playerIds: SPAN_MERGE_ORDER,
            mergedPlayerIds: []
        })
        expect(Object.keys(state.parallelSpan?.branchStartIds ?? {})).toEqual(SPAN_MERGE_ORDER)
        expect(state.parallelSpan?.branchPlayerId).toBeUndefined()
        expect(state.activePlayerIds).toEqual(SPAN_MERGE_ORDER)
    })

    it('records the span for a Game that starts in a Branching Machine State', () => {
        const { state } = createSpanGame({ startsInSpan: true })
        expect(state.parallelSpan?.branchPoint).toEqual({ actionCount: 0, actionChecksum: 0 })
        expect(state.activePlayerIds).toEqual(SPAN_MERGE_ORDER)
    })

    it('takes as its Players the Active Players the Branching Machine State’s entry sets', () => {
        const spanGame = createSpanGame({ sitsOut: ['p2'] })
        const state = beginSpan(spanGame)
        expect(state.parallelSpan?.playerIds).toEqual(['p3', 'p1'])
        expect(state.activePlayerIds).toEqual(['p3', 'p1'])
        expect(Object.keys(state.parallelSpan?.branchStartIds ?? {})).toEqual(['p3', 'p1'])
        expect(() => playPrivately(spanGame, state, 'p2', [])).toThrow(
            'Player p2 takes no part in this span'
        )
        const played = playLocally(spanGame, state, [
            spanAction('f3', 'finish', 'p3'),
            spanAction('f1', 'finish', 'p1')
        ])
        expect(summary(played.processedActions)).toEqual([
            'openBranch:p3',
            'finish:p3',
            'closeBranch:p3',
            'openBranch:p1',
            'finish:p1',
            'closeBranch:p1',
            'complete:'
        ])
    })

    it('refuses a Merge Order that does not place every Active Player', () => {
        const spanGame = createSpanGame({ mergeOrderOmits: ['p2'] })
        expect(() => beginSpan(spanGame)).toThrow('Merge Order must place every Active Player')
    })

    it('accepts no User Action while the span rests in the Branching Machine State', () => {
        const spanGame = createSpanGame()
        expect(() =>
            execute(spanGame, beginSpan(spanGame), spanAction('w1', 'work', 'p3'))
        ).toThrow('No User Action is valid in a Branching Machine State')
    })

    it('opens the first Branch in Merge Order with Branch Start', () => {
        const spanGame = createSpanGame()
        const resting = beginSpan(spanGame)
        const opened = playLocally(spanGame, resting, [])
        expect(summary(opened.processedActions)).toEqual(['openBranch:p3'])
        expect(opened.processedActions[0].source).toBe(ActionSource.System)
        expect(opened.processedActions[0].id).toBe(resting.parallelSpan?.branchStartIds.p3)
        expect(opened.state.machineState).toBe('working')
        expect(opened.state.activePlayerIds).toEqual(['p3'])
        expect(opened.state.parallelSpan?.branchPlayerId).toBe('p3')
    })

    it('opens the Branch again when a recorded Branch Start is replayed on its own', () => {
        const spanGame = createSpanGame()
        const resting = beginSpan(spanGame)
        const started = spanGame.engine.startBranch({
            game: spanGame.game,
            state: resting,
            playerId: 'p3'
        })
        const replayed = spanGame.engine.executeSingleAction({
            game: spanGame.game,
            state: resting,
            action: started.processedActions[0]
        })
        expect(replayed.updatedState).toEqual(started.updatedState)
    })

    it('lets only the Player whose Branch is being played act', () => {
        const spanGame = createSpanGame()
        expect(() =>
            execute(spanGame, inFirstBranch(spanGame), spanAction('w1', 'work', 'p2'))
        ).toThrow('not an active player')
    })

    it('closes a Branch when it returns to the Branching Machine State', () => {
        const spanGame = createSpanGame()
        const closed = playLocally(spanGame, beginSpan(spanGame), [
            spanAction('w1', 'work', 'p3'),
            spanAction('f1', 'finish', 'p3')
        ])
        expect(summary(closed.processedActions)).toEqual([
            'openBranch:p3',
            'work:p3',
            'finish:p3',
            'closeBranch:p3',
            'openBranch:p2'
        ])
        expect(closed.state.parallelSpan?.closedPlayerIds).toEqual(['p3'])
        expect(closed.state.parallelSpan?.mergedPlayerIds).toEqual(['p3'])
        expect(closed.state.parallelSpan?.branchPlayerId).toBe('p2')
        expect(playerOf(closed.state, 'p3').work).toBe(1)
    })

    it('runs the Branching Machine State’s entry every time it is entered, as for any Machine State', () => {
        const spanGame = createSpanGame()
        const entry = vi.spyOn(spanGame.runtime.stateHandlers.branching, 'enter')
        const state = beginSpan(spanGame)
        expect(entry).toHaveBeenCalledTimes(1)
        playLocally(spanGame, state, [spanAction('f3', 'finish', 'p3')])
        expect(entry).toHaveBeenCalledTimes(2)
    })

    it('requires a Branch to end its cascade when it closes', () => {
        const spanGame = createSpanGame({ branchingEntry: 'queuesWhenBranchReturns' })
        expect(() =>
            execute(spanGame, inFirstBranch(spanGame), spanAction('f3', 'finish', 'p3'))
        ).toThrow('A Branch must end its cascade when it closes')
    })

    it('rests with the Players yet to play as Active Players between Branches', () => {
        const spanGame = createSpanGame()
        const rested = execute(
            spanGame,
            inFirstBranch(spanGame),
            spanAction('f1', 'finish', 'p3')
        ).updatedState
        expect(rested.machineState).toBe('branching')
        expect(rested.parallelSpan?.branchPlayerId).toBeUndefined()
        expect(rested.activePlayerIds).toEqual(['p2', 'p1'])
    })

    it('carries a Player with nothing to do straight through their Branch', () => {
        const spanGame = createSpanGame({ idle: ['p2'] })
        const played = playLocally(spanGame, beginSpan(spanGame), [
            spanAction('f1', 'finish', 'p3')
        ])
        expect(summary(played.processedActions)).toEqual([
            'openBranch:p3',
            'finish:p3',
            'closeBranch:p3',
            'openBranch:p2',
            'idleSkip:p2',
            'closeBranch:p2',
            'openBranch:p1'
        ])
        expect(played.state.parallelSpan?.mergedPlayerIds).toEqual(['p3', 'p2'])
        expect(played.state.activePlayerIds).toEqual(['p1'])
    })

    it('completes the span once every Branch is on the Main Line', () => {
        const spanGame = createSpanGame()
        const resting = beginSpan(spanGame)
        const played = playLocally(spanGame, resting, [
            spanAction('q3', 'queue', 'p3', { amount: 3 }),
            spanAction('f3', 'finish', 'p3'),
            spanAction('q2', 'queue', 'p2', { amount: 2 }),
            spanAction('f2', 'finish', 'p2'),
            spanAction('f1', 'finish', 'p1')
        ])
        const completion = played.processedActions.at(-1)
        expect(completion?.type).toBe('complete')
        expect(completion?.id).toBe(resting.parallelSpan?.completionId)
        expect(played.state.machineState).toBe('scoring')
        expect(played.state.parallelSpan).toBeUndefined()
        expect(played.state.pot).toBe(5)
    })

    it('marks Span Completion as an Information-Revealing Action', () => {
        const spanGame = createSpanGame({ idle: ['p1', 'p2', 'p3'] })
        const played = playLocally(spanGame, beginSpan(spanGame), [])
        expect(played.processedActions.at(-1)?.revealsInfo).toBe(true)
        expect(played.processedActions.slice(0, -1).some((action) => action.revealsInfo)).toBe(
            false
        )
    })

    it('completes at once when no Player has anything to do', () => {
        const spanGame = createSpanGame({ idle: ['p1', 'p2', 'p3'] })
        const played = playLocally(spanGame, beginSpan(spanGame), [])
        expect(summary(played.processedActions)).toEqual([
            'openBranch:p3',
            'idleSkip:p3',
            'closeBranch:p3',
            'openBranch:p2',
            'idleSkip:p2',
            'closeBranch:p2',
            'openBranch:p1',
            'idleSkip:p1',
            'closeBranch:p1',
            'complete:'
        ])
        expect(played.state.machineState).toBe('scoring')
    })

    it('refuses Span Completion while a Branch is not yet on the Main Line', () => {
        const spanGame = createSpanGame()
        expect(() =>
            spanGame.engine.completeSpan({ game: spanGame.game, state: beginSpan(spanGame) })
        ).toThrow('Span Completion needs every Branch on the Main Line')
    })

    it('lets nothing but Span Completion leave the span', () => {
        const spanGame = createSpanGame()
        const forged: GameAction = {
            id: 'forged',
            gameId: SPAN_GAME_ID,
            type: 'complete',
            source: ActionSource.System
        }
        expect(() => execute(spanGame, restAfterEveryBranch(spanGame), forged)).toThrow(
            'Only Span Completion may leave a Branching Machine State'
        )
    })

    it('rejects an Out-of-Turn Action during a span', () => {
        const spanGame = createSpanGame()
        expect(() =>
            execute(spanGame, inFirstBranch(spanGame), spanAction('s1', 'shout', 'p1'))
        ).toThrow('Out-of-Turn Actions are rejected during a Parallel Span')
    })

    it('does nothing when asked to advance a Game that is not resting in a span', () => {
        const spanGame = createSpanGame()
        expect(
            spanGame.engine.advanceSpan({ game: spanGame.game, state: spanGame.state })
        ).toBeUndefined()
    })
})

describe('Branch Close', () => {
    it('records on the Main Line that a Player’s Branch has returned, and nothing else', () => {
        const spanGame = createSpanGame()
        const state = beginSpan(spanGame)
        const closed = spanGame.engine.closeBranch({ state, playerId: 'p2' })
        expect(closed.processedActions).toMatchObject([
            {
                id: state.parallelSpan?.branchCloseIds.p2,
                type: BranchCloseActionType,
                source: ActionSource.System,
                playerId: 'p2',
                index: 1
            }
        ])
        expect(closed.processedActions[0].revealsInfo).toBeUndefined()
        expect(closed.updatedState).toEqual({
            ...state,
            parallelSpan: { ...state.parallelSpan, closedPlayerIds: ['p2'] },
            activePlayerIds: ['p3', 'p1'],
            actionCount: 2,
            actionChecksum: closed.updatedState.actionChecksum
        })
        expect(closed.updatedState.actionChecksum).not.toBe(state.actionChecksum)
        expect(
            spanGame.engine.undoProcessedAction({
                action: closed.processedActions[0],
                state: closed.updatedState
            })
        ).toEqual(state)
    })

    it('fixes its identity when the span begins, apart from every Branch Start', () => {
        const spanGame = createSpanGame()
        const span = beginSpan(spanGame).parallelSpan
        const ids = [
            ...Object.values(span?.branchCloseIds ?? {}),
            ...Object.values(span?.branchStartIds ?? {}),
            span?.completionId
        ]
        expect(Object.keys(span?.branchCloseIds ?? {})).toEqual(SPAN_MERGE_ORDER)
        expect(new Set(ids).size).toBe(7)
    })

    it('refuses a second close for a Player, and one for a Player outside the span', () => {
        const spanGame = createSpanGame({ sitsOut: ['p2'] })
        const state = beginSpan(spanGame)
        const closed = spanGame.engine.closeBranch({ state, playerId: 'p3' }).updatedState
        expect(() => spanGame.engine.closeBranch({ state: closed, playerId: 'p3' })).toThrow(
            'The Branch of p3 is already closed'
        )
        expect(() => spanGame.engine.closeBranch({ state, playerId: 'p2' })).toThrow(
            'Player p2 takes no part in this span'
        )
    })

    it('is applied again from its record alone', () => {
        const spanGame = createSpanGame()
        const state = beginSpan(spanGame)
        const closed = spanGame.engine.closeBranch({ state, playerId: 'p2' })
        const { undoPatch: _undoPatch, ...recorded } = closed.processedActions[0]
        expect(
            spanGame.engine.applyProcessedAction({ action: recorded, state, game: spanGame.game })
        ).toEqual(closed.updatedState)
    })

    it('is shown to every Player and to spectators as it is', () => {
        const spanGame = createSpanGame()
        const state = beginSpan(spanGame)
        const closed = spanGame.engine.closeBranch({ state, playerId: 'p2' })
        const visibility = spanGame.runtime.visibility
        if (visibility === undefined) throw Error('The span fixture defines visibility')
        for (const perspective of [
            { kind: 'player', playerId: 'p3' },
            { kind: 'spectator' }
        ] as const) {
            const shown = Visibility.projectActionCascade(closed.actionCascade, {
                visibility,
                perspective,
                game: spanGame.game
            })
            expect(shown.actions).toMatchObject([
                { id: closed.processedActions[0].id, type: BranchCloseActionType, playerId: 'p2' }
            ])
        }
    })

    it('leaves a Player who has closed out of the Active Players, in their own view too', () => {
        const spanGame = createSpanGame()
        const state = beginSpan(spanGame)
        const mine = playPrivately(spanGame, state, 'p2', [spanAction('f2', 'finish', 'p2')])
        const closed = spanGame.engine.closeBranch({ state, playerId: 'p2' }).updatedState
        expect(closed.activePlayerIds).toEqual(['p3', 'p1'])
        expect(branchView(closed, mine.branch).activePlayerIds).toEqual(['p3', 'p1'])

        const theirs = playPrivately(spanGame, state, 'p3', [])
        const seen = branchView(closed, theirs.branch)
        expect(seen.activePlayerIds).toEqual(['p3'])
        expect(seen.parallelSpan?.closedPlayerIds).toEqual(['p2'])
    })
})

describe('Branch Scope', () => {
    function rejected(action: GameAction, playerId: string, field: string) {
        const spanGame = createSpanGame()
        expect(() => execute(spanGame, inFirstBranch(spanGame), action)).toThrow(
            new RegExp(`The Branch of ${playerId} may not change /${field}`)
        )
    }

    it('rejects a change to shared Game State', () => {
        rejected(spanAction('g1', 'grab', 'p3'), 'p3', 'pot')
    })

    it('rejects a change inside another Player’s state', () => {
        rejected(spanAction('k1', 'poke', 'p3', { otherPlayerId: 'p2' }), 'p3', 'players')
    })

    it('rejects adding to a shared collection that is addressed by position', () => {
        rejected(spanAction('l1', 'logIt', 'p3'), 'p3', 'log')
    })

    it('rejects inserting an owned entry ahead of others in a positional collection', () => {
        rejected(spanAction('c1', 'cutIn', 'p3'), 'p3', 'line')
    })

    it('rejects claiming shared Game State by writing the Player’s identity onto it', () => {
        rejected(spanAction('c1', 'claim', 'p3'), 'p3', 'flag')
    })

    it('allows adding an owned entry to a shared collection keyed by identity, and removing it', () => {
        const spanGame = createSpanGame()
        const stashed = execute(
            spanGame,
            inFirstBranch(spanGame),
            spanAction('item-1', 'stash', 'p3', { label: 'mine' })
        ).updatedState
        expect(stashed.items).toEqual({ 'item-1': { playerId: 'p3', label: 'mine' } })
        const dropped = execute(
            spanGame,
            stashed,
            spanAction('d1', 'drop', 'p3', { itemId: 'item-1' })
        ).updatedState
        expect(dropped.items).toEqual({})
    })

    it('rejects removing another Player’s entry', () => {
        const spanGame = createSpanGame()
        const secondBranch = playLocally(spanGame, beginSpan(spanGame), [
            spanAction('item-1', 'stash', 'p3', { label: 'mine' }),
            spanAction('f3', 'finish', 'p3')
        ]).state
        expect(() =>
            execute(spanGame, secondBranch, spanAction('d1', 'drop', 'p2', { itemId: 'item-1' }))
        ).toThrow(/The Branch of p2 may not change \/items/)
    })

    it('applies to the Branching Machine State’s entry when a Branch returns', () => {
        const spanGame = createSpanGame({ branchingEntry: 'writesSharedState' })
        const opened = inFirstBranch(spanGame)
        expect(opened.log).toEqual(['span', 'entered'])
        expect(() => execute(spanGame, opened, spanAction('f3', 'finish', 'p3'))).toThrow(
            /The Branch of p3 may not change \/log/
        )
    })

    it('applies to private play', () => {
        const spanGame = createSpanGame()
        expect(() =>
            playPrivately(spanGame, beginSpan(spanGame), 'p2', [spanAction('g1', 'grab', 'p2')])
        ).toThrow(/The Branch of p2 may not change \/pot/)
    })

    it('does not apply to Span Completion, which settles shared Game State', () => {
        const spanGame = createSpanGame({ idle: ['p1', 'p2'] })
        const played = playLocally(spanGame, beginSpan(spanGame), [
            spanAction('q3', 'queue', 'p3', { amount: 4 }),
            spanAction('f3', 'finish', 'p3')
        ])
        expect(played.state.machineState).toBe('scoring')
        expect(played.state.pot).toBe(4)
    })
})

describe('Starting Position Randomness', () => {
    it('creates two streams for each Player in the order fixed at Game Initialization', () => {
        const { state } = createSpanGame()
        const streams = state.startingPositionRandom ?? []
        expect(streams.map((stream) => stream.playerId)).toEqual(['p1', 'p2', 'p3'])
        expect(new Set(streams.map((stream) => stream.identity.seed)).size).toBe(3)
        expect(new Set(streams.map((stream) => stream.rules.seed)).size).toBe(3)
    })

    it('derives the streams from the master seed', () => {
        expect(createSpanGame().state.startingPositionRandom).toEqual(
            createSpanGame().state.startingPositionRandom
        )
    })

    it('gives a Player the same rolls whatever the Players before them rolled', () => {
        const withRolls = createSpanGame()
        const afterRolls = playLocally(withRolls, beginSpan(withRolls), [
            spanAction('r1', 'roll', 'p3'),
            spanAction('r2', 'roll', 'p3'),
            spanAction('f3', 'finish', 'p3'),
            spanAction('r3', 'roll', 'p2'),
            spanAction('r4', 'roll', 'p2')
        ]).state
        const withoutRolls = createSpanGame()
        const afterNone = playLocally(withoutRolls, beginSpan(withoutRolls), [
            spanAction('f3', 'finish', 'p3'),
            spanAction('r3', 'roll', 'p2'),
            spanAction('r4', 'roll', 'p2')
        ]).state
        expect(playerOf(afterRolls, 'p2').rolls).toEqual(playerOf(afterNone, 'p2').rolls)
        expect(playerOf(afterRolls, 'p2').rolls).toHaveLength(2)
    })

    it('draws System Action Identity inside a Branch from that Player’s stream', () => {
        const identityOfSkip = (idle: readonly string[], actions: readonly GameAction[]) => {
            const spanGame = createSpanGame({ idle })
            return playLocally(spanGame, beginSpan(spanGame), actions).processedActions.find(
                (action) => action.type === 'idleSkip' && action.playerId === 'p2'
            )?.id
        }
        const afterIdlePlayer = identityOfSkip(['p3', 'p2'], [])
        const afterBusyPlayer = identityOfSkip(['p2'], [spanAction('f3', 'finish', 'p3')])
        expect(afterIdlePlayer).toBeDefined()
        expect(afterIdlePlayer).toBe(afterBusyPlayer)
    })
})

describe('Unmerged Branch', () => {
    it('begins with Branch Start and leaves the Main Line untouched', () => {
        const spanGame = createSpanGame()
        const state = beginSpan(spanGame)
        const before = structuredClone(state)
        const created = playPrivately(spanGame, state, 'p2', [])
        expect(summary(created.actions)).toEqual(['openBranch:p2'])
        expect(created.actions[0].index).toBe(0)
        expect(created.actions[0].id).toBe(state.parallelSpan?.branchStartIds.p2)
        expect(created.branch).toMatchObject({
            playerId: 'p2',
            branchPoint: state.parallelSpan?.branchPoint,
            machineState: 'working',
            actionCount: 1,
            closed: false
        })
        expect(created.view.activePlayerIds).toEqual(['p2'])
        expect(state).toEqual(before)
    })

    it('runs a Player’s Actions in their Branch View', () => {
        const spanGame = createSpanGame()
        const state = beginSpan(spanGame)
        const play = playPrivately(spanGame, state, 'p2', [
            spanAction('w1', 'work', 'p2'),
            spanAction('w2', 'work', 'p2')
        ])
        expect(playerOf(play.view, 'p2').work).toBe(2)
        expect(play.branch.actionCount).toBe(3)
        expect(play.actions.map((action) => action.index)).toEqual([0, 1, 2])
        expect(playerOf(state, 'p2').work).toBe(0)
        expect(branchView(state, play.branch)).toEqual(play.view)
    })

    it('keeps each Player’s Branch apart from the others', () => {
        const spanGame = createSpanGame()
        const state = beginSpan(spanGame)
        const second = playPrivately(spanGame, state, 'p2', [spanAction('w2', 'work', 'p2')])
        const first = playPrivately(spanGame, state, 'p1', [spanAction('w1', 'work', 'p1')])
        expect(playerOf(second.view, 'p1').work).toBe(0)
        expect(playerOf(first.view, 'p2').work).toBe(0)
        expect(playerOf(first.view, 'p1').work).toBe(1)
    })

    it('gives the same results privately as the same Actions give on the Main Line', () => {
        const actions = [
            spanAction('r1', 'roll', 'p3'),
            spanAction('item-1', 'stash', 'p3', { label: 'mine' })
        ]
        const spanGame = createSpanGame()
        const state = beginSpan(spanGame)
        const onMainLine = playLocally(spanGame, state, actions).state
        const privately = playPrivately(spanGame, state, 'p3', actions).view
        expect(playerOf(privately, 'p3')).toEqual(playerOf(onMainLine, 'p3'))
        expect(privately.items).toEqual(onMainLine.items)
        expect(privately.startingPositionRandom).toEqual(onMainLine.startingPositionRandom)
    })

    it('is closed once it returns to the Branching Machine State', () => {
        const spanGame = createSpanGame()
        const state = beginSpan(spanGame)
        const closed = playPrivately(spanGame, state, 'p2', [spanAction('f2', 'finish', 'p2')])
        expect(closed.branch.closed).toBe(true)
        expect(closed.branch.machineState).toBe('branching')
        expect(() =>
            spanGame.engine.executeBranchAction({
                game: spanGame.game,
                state,
                branch: closed.branch,
                action: spanAction('w2', 'work', 'p2')
            })
        ).toThrow('The Branch of p2 is closed')
    })

    it('can close on Branch Start alone', () => {
        const spanGame = createSpanGame({ idle: ['p2'] })
        const created = playPrivately(spanGame, beginSpan(spanGame), 'p2', [])
        expect(summary(created.actions)).toEqual(['openBranch:p2', 'idleSkip:p2'])
        expect(created.branch.closed).toBe(true)
    })

    it('never has to catch up when the Main Line moves', () => {
        const spanGame = createSpanGame()
        const state = beginSpan(spanGame)
        const mine = playPrivately(spanGame, state, 'p2', [spanAction('w2', 'work', 'p2')])
        const moved = execute(
            spanGame,
            playLocally(spanGame, state, [spanAction('w3', 'work', 'p3')]).state,
            spanAction('f3', 'finish', 'p3')
        ).updatedState
        const view = branchView(moved, mine.branch)
        expect(playerOf(view, 'p3').work).toBe(1)
        expect(playerOf(view, 'p2').work).toBe(1)
        expect(view.parallelSpan?.mergedPlayerIds).toEqual(['p3'])
        expect(view.parallelSpan?.branchPlayerId).toBe('p2')
        const next = spanGame.engine.executeBranchAction({
            game: spanGame.game,
            state: moved,
            branch: mine.branch,
            action: spanAction('w4', 'work', 'p2')
        })
        expect(playerOf(next.view, 'p2').work).toBe(2)
    })

    it('can be viewed while another Player’s Branch is part-way onto the Main Line', () => {
        const spanGame = createSpanGame()
        const state = beginSpan(spanGame)
        const mine = playPrivately(spanGame, state, 'p2', [spanAction('w2', 'work', 'p2')])
        const theirs = playPrivately(spanGame, state, 'p3', [])
        const midway = playLocally(spanGame, state, [spanAction('w3', 'work', 'p3')]).state
        expect(midway.parallelSpan?.branchPlayerId).toBe('p3')
        expect(() => branchView(midway, mine.branch)).toThrow()

        const view = branchViewDuringMerge(midway, mine.branch)
        expect(playerOf(view, 'p3').work).toBe(1)
        expect(playerOf(view, 'p2').work).toBe(1)
        expect(view.actionCount).toBe(mine.branch.actionCount)
        expect(view.parallelSpan?.branchPlayerId).toBe('p2')
        expect(() => branchViewDuringMerge(midway, theirs.branch)).toThrow()
    })

    it('when closed, still shows who the Main Line waits on while another Player’s Branch is part-way onto it', () => {
        const spanGame = createSpanGame()
        const state = beginSpan(spanGame)
        const mine = playPrivately(spanGame, state, 'p2', [spanAction('f2', 'finish', 'p2')])
        const bothClosed = ['p2', 'p3'].reduce(
            (current, playerId) =>
                spanGame.engine.closeBranch({ state: current, playerId }).updatedState,
            state
        )
        const midway = playLocally(spanGame, bothClosed, [spanAction('w3', 'work', 'p3')]).state
        expect(midway.parallelSpan?.branchPlayerId).toBe('p3')
        expect(midway.activePlayerIds).toEqual(['p3'])

        const view = branchViewDuringMerge(midway, mine.branch)
        expect(view.parallelSpan?.branchPlayerId).toBeUndefined()
        expect(view.activePlayerIds).toEqual(['p1'])
        expect(playerOf(view, 'p3').work).toBe(1)
    })

    it('refuses a Branch for a Player whose Branch is already on the Main Line', () => {
        const spanGame = createSpanGame()
        const moved = execute(
            spanGame,
            inFirstBranch(spanGame),
            spanAction('f3', 'finish', 'p3')
        ).updatedState
        expect(() => playPrivately(spanGame, moved, 'p3', [])).toThrow(
            'The Branch of p3 is already on the Main Line'
        )
    })
})
