import { assert, assertExists } from '../../../util/assertions.js'
import { BranchUndoError, type UnmergedBranch } from '../branch.js'
import type { GameAction } from '../gameAction.js'
import { combineCascades, type ActionCascadeResult } from '../gameEngine.js'
import { settleSpan, siteActivePlayerIds } from '../hostedSpan.js'
import { actsInBranch, isRestingInSpan } from '../parallelSpan.js'
import { createSpanGame, type SpanGameOptions, type SpanGameState } from './spanGame.js'

export interface SpanHostSubmission {
    readonly mainLine?: ActionCascadeResult<SpanGameState>
    readonly unmergedBranch?: UnmergedBranch
}

export class SpanHost {
    readonly engine: ReturnType<typeof createSpanGame>['engine']
    readonly runtime: ReturnType<typeof createSpanGame>['runtime']
    game: ReturnType<typeof createSpanGame>['game']
    state: SpanGameState
    actions: GameAction[] = []
    private readonly branches = new Map<string, UnmergedBranch>()

    constructor(options: SpanGameOptions = {}) {
        const spanGame = createSpanGame(options)
        this.engine = spanGame.engine
        this.runtime = spanGame.runtime
        this.game = spanGame.game
        this.state = spanGame.state
    }

    unmergedBranch(playerId: string): UnmergedBranch | undefined {
        return structuredClone(this.branches.get(playerId))
    }

    submit(action: GameAction): SpanHostSubmission {
        if (isRestingInSpan(this.state)) return this.submitToBranch(action)
        const mainLine = this.advanceMainLine(this.executeOnMainLine(action))
        const created =
            action.playerId === undefined ? undefined : this.unmergedBranch(action.playerId)
        return { mainLine, ...(created === undefined ? {} : { unmergedBranch: created }) }
    }

    undoInBranch(playerId: string, actionId: string): UnmergedBranch {
        const record = this.branches.get(playerId)
        assertExists(record, `Player ${playerId} has no Branch`)
        if (record.branch.closed) throw new BranchUndoError(playerId, 'the Branch is closed')
        const undone = this.engine.undoBranchAction({ state: this.state, ...record, actionId })
        const kept = record.actions.slice(0, record.actions.length - undone.undoneActions.length)
        this.branches.set(playerId, { branch: undone.branch, actions: kept })
        return { branch: undone.branch, actions: [] }
    }

    private executeOnMainLine(action: GameAction): ActionCascadeResult<SpanGameState> {
        return this.engine.executeCanonicalAction({ game: this.game, state: this.state, action })
    }

    private submitToBranch(action: GameAction): SpanHostSubmission {
        const playerId = action.playerId
        assertExists(playerId, 'A Branch Action requires its Player')
        const record = this.branches.get(playerId)
        assert(
            record !== undefined && actsInBranch(this.state, playerId),
            `Player ${playerId} has no open Branch`
        )
        const execution = this.engine.executeBranchAction({
            state: this.state,
            branch: record.branch,
            action,
            game: this.game
        })
        this.branches.set(playerId, {
            branch: execution.branch,
            actions: [...record.actions, ...execution.processedActions]
        })
        const sent = { branch: execution.branch, actions: execution.processedActions }
        if (!execution.branch.closed) return { unmergedBranch: sent }

        const settled = this.advanceMainLine(combineCascades(this.state, []))
        const mine = this.branches.get(playerId)
        return {
            ...(settled.processedActions.length > 0 ? { mainLine: settled } : {}),
            ...(mine === undefined
                ? {}
                : { unmergedBranch: mine.branch.closed ? sent : structuredClone(mine) })
        }
    }

    private advanceMainLine(
        executed: ActionCascadeResult<SpanGameState>
    ): ActionCascadeResult<SpanGameState> {
        const settlement = settleSpan({
            engine: this.engine,
            game: this.game,
            state: executed.updatedState,
            unmergedBranches: [...this.branches.values()]
        })
        assert(settlement.refusal === undefined, settlement.refusal?.reason ?? '')
        const advanced = combineCascades(this.state, [executed, settlement])
        this.state = advanced.updatedState
        this.actions.push(...advanced.processedActions)
        for (const playerId of settlement.mergedPlayerIds) this.branches.delete(playerId)
        if (!isRestingInSpan(this.state)) this.branches.clear()
        for (const created of settlement.createdBranches) {
            this.branches.set(created.branch.playerId, created)
        }
        this.game.activePlayerIds = siteActivePlayerIds(
            this.state,
            [...this.branches.values()].map(({ branch }) => branch)
        )
        return advanced
    }
}
