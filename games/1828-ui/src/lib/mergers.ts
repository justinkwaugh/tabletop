import { ActionSource, type GameAction } from '@tabletop/common'
import { isFinishStockTurn } from '@tabletop/18xx'
import { isFormSystem } from '@tabletop/1828'

export type MergerOption = { survivorId: string; absorbedId: string }

export type MergerPair = {
    key: string
    companyIds: readonly [string, string]
    options: MergerOption[]
}

export function mergerPairs(choices: readonly MergerOption[]): MergerPair[] {
    const pairs = new Map<string, MergerPair>()
    for (const option of choices) {
        const companyIds = [option.survivorId, option.absorbedId].toSorted()
        const key = companyIds.join('+')
        const pair = pairs.get(key) ?? {
            key,
            companyIds: [companyIds[0], companyIds[1]] as const,
            options: []
        }
        pair.options.push(option)
        pairs.set(key, pair)
    }
    return [...pairs.values()]
}

export type FailedMerger = {
    playerId: string
    companyIds: readonly [string, string]
    failure: string
}

/**
 * The merger that has just failed, while the table should still be told: through the turn after
 * the acting player's pass, or until the first action of the operating round that pass began.
 */
export function failedMerger(
    actions: readonly GameAction[],
    actionCount: number,
    inStockRound: boolean
): FailedMerger | undefined {
    for (let index = Math.min(actionCount, actions.length) - 1; index >= 0; index--) {
        const action = actions[index]
        if (isFormSystem(action)) {
            const outcome = action.metadata
            if (!outcome?.failure) return undefined
            return {
                playerId: outcome.playerId,
                companyIds: [outcome.survivorId, outcome.absorbedId],
                failure: outcome.failure
            }
        }
        if (action.source === ActionSource.User && (isFinishStockTurn(action) || !inStockRound))
            return undefined
    }
    return undefined
}
