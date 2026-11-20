import { isStartOperatingTurn } from '@tabletop/18xx'
import {
    ActionSource,
    isStandingDeclaration,
    playerUndoRestriction,
    type GameAction
} from '@tabletop/common'

export type TurnRestart = {
    target: GameAction
    undoneCount: number
    companyId?: string
}

const turnOpenings: ReadonlySet<string> = new Set([
    'StartOperatingTurn',
    'StartStockRound',
    'FinishStockTurn',
    'InterruptOperatingTurn',
    'ResolveAuction',
    'ResolveSelectionAuction'
])

const turnBreaks: ReadonlySet<string> = new Set([
    'FinishOperatingTurn',
    'ResumeOperatingTurn',
    'CompleteStockRound',
    'StartOperatingRound',
    'StartOperatingSet',
    'StartMergerRound',
    'StartParliamentRound'
])

export function turnRestart(
    undoable: readonly GameAction[],
    undoCandidate: GameAction
): TurnRestart | undefined {
    const playerId = undoCandidate.playerId
    if (playerId === undefined) return undefined
    const isPlayerChoice = (position: number) =>
        undoable[position].source === ActionSource.User &&
        !isStandingDeclaration(undoable, position)

    let opening = undoable.findLastIndex((action) => action.id === undoCandidate.id) - 1
    for (; opening >= 0; opening--) {
        const action = undoable[opening]
        if (turnOpenings.has(action.type)) break
        if (turnBreaks.has(action.type)) return undefined
        if (isPlayerChoice(opening) && action.playerId !== playerId) return undefined
    }
    if (opening < 0) return undefined

    const choices: number[] = []
    for (let position = opening + 1; position < undoable.length; position++) {
        if (!isPlayerChoice(position)) continue
        if (undoable[position].playerId !== playerId) return undefined
        choices.push(position)
    }
    const target = undoable[choices[0]]
    if (
        target.id === undoCandidate.id ||
        playerUndoRestriction(undoable.slice(choices[0]), target, playerId)
    ) {
        return undefined
    }

    const openingAction = undoable[opening]
    return {
        target,
        undoneCount: choices.length,
        companyId: isStartOperatingTurn(openingAction) ? openingAction.companyId : undefined
    }
}
