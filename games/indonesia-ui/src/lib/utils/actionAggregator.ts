import type { GameAction } from '@tabletop/common'
import {
    ActionType,
    CompanyType,
    PassReason,
    isChooseOperatingCompany,
    isDeliverGood,
    isExpand,
    isMergeCompanies,
    isPass,
    isPassMergerBid,
    isPlaceTurnOrderBid,
    isPlaceMergerBid,
    isProposeMerger,
    isRemoveSiapSajiArea
} from '@tabletop/indonesia'
import { nanoid } from 'nanoid'

export type AggregatedIndonesiaActionType =
    | ActionType.ChooseOperatingCompany
    | ActionType.Expand
    | ActionType.Pass
    | ActionType.PassMergerBid
    | ActionType.PlaceMergerBid
    | ActionType.PlaceTurnOrderBid
    | ActionType.RemoveSiapSajiArea

export type AggregatedIndonesiaAction = GameAction & {
    type: 'AggregatedIndonesiaAction'
    playerId: string
    playerIds?: string[]
    aggregatedType: AggregatedIndonesiaActionType
    count: number
}

export function isAggregatedIndonesiaAction(
    action?: GameAction
): action is AggregatedIndonesiaAction {
    return action?.type === 'AggregatedIndonesiaAction'
}

function aggregatedTypeForAction(action: GameAction): AggregatedIndonesiaActionType | null {
    if (isChooseOperatingCompany(action)) {
        return ActionType.ChooseOperatingCompany
    }
    if (isExpand(action)) {
        return ActionType.Expand
    }
    if (isDeclineMergerAnnouncementPassAction(action)) {
        return ActionType.Pass
    }
    if (isPassMergerBid(action)) {
        return ActionType.PassMergerBid
    }
    if (isPlaceMergerBid(action)) {
        return ActionType.PlaceMergerBid
    }
    if (isPlaceTurnOrderBid(action)) {
        return ActionType.PlaceTurnOrderBid
    }
    if (isRemoveSiapSajiArea(action)) {
        return ActionType.RemoveSiapSajiArea
    }
    return null
}

function aggregateIndonesiaActions(actions: GameAction[]): AggregatedIndonesiaAction | GameAction {
    if (actions.length === 0) {
        throw Error('No actions to aggregate')
    }

    const first = actions[0]
    const last = actions[actions.length - 1]
    const aggregatedType = aggregatedTypeForAction(first)
    if (!first.playerId) {
        return first
    }
    if (!aggregatedType) {
        return first
    }

    let aggregatedCount = actions.length
    if (aggregatedType === ActionType.ChooseOperatingCompany) {
        const chooseAction = actions.find((action) => isChooseOperatingCompany(action))
        if (chooseAction?.metadata?.companyType === CompanyType.Production) {
            aggregatedCount = actions.filter((action) => isDeliverGood(action)).length
        } else if (chooseAction?.metadata?.companyType === CompanyType.Shipping) {
            aggregatedCount = actions.filter((action) => isExpand(action)).length
        } else {
            aggregatedCount = actions.filter((action) => !isChooseOperatingCompany(action)).length
        }
    }

    return {
        id: nanoid(),
        gameId: first.gameId,
        source: first.source,
        type: 'AggregatedIndonesiaAction',
        playerId: first.playerId,
        ...(aggregatedType === ActionType.PassMergerBid ||
        aggregatedType === ActionType.Pass ||
        aggregatedType === ActionType.PlaceMergerBid ||
        aggregatedType === ActionType.PlaceTurnOrderBid
            ? {
                  playerIds: actions
                      .map((action) => action.playerId)
                      .filter((playerId): playerId is string => typeof playerId === 'string')
              }
            : {}),
        index: last?.index,
        aggregatedType,
        count: aggregatedCount,
        createdAt: first.createdAt
    }
}

function isOperationPassAction(action: GameAction): boolean {
    return (
        isPass(action) &&
        (action.reason === PassReason.FinishOptionalShippingExpansion ||
            action.reason === PassReason.SkipShippingExpansion ||
            action.reason === PassReason.FinishOptionalProductionExpansion ||
            action.reason === PassReason.SkipProductionExpansion)
    )
}

function isDeclineMergerAnnouncementPassAction(action: GameAction): boolean {
    return isPass(action) && action.reason === PassReason.DeclineMergerAnnouncement
}

export function* aggregateActions(actions: GameAction[]) {
    let currentPlayerId: string | undefined
    let currentAggregatedType: AggregatedIndonesiaActionType | null = null
    let aggregatedGroup: GameAction[] = []

    for (const action of actions) {
        if (
            aggregatedGroup.length > 0 &&
            currentAggregatedType === ActionType.ChooseOperatingCompany &&
            currentPlayerId &&
            (isDeliverGood(action) || isExpand(action) || isOperationPassAction(action)) &&
            action.playerId === currentPlayerId
        ) {
            aggregatedGroup.push(action)
            continue
        }

        if (
            aggregatedGroup.length > 0 &&
            currentAggregatedType === ActionType.PlaceMergerBid &&
            (isPlaceMergerBid(action) || isPassMergerBid(action) || isMergeCompanies(action))
        ) {
            aggregatedGroup.push(action)
            continue
        }

        const aggregatedType = aggregatedTypeForAction(action)
        if (aggregatedType && action.playerId) {
            if (aggregatedGroup.length === 0) {
                aggregatedGroup = [action]
                currentPlayerId = action.playerId
                currentAggregatedType = aggregatedType
            } else if (
                currentAggregatedType !== ActionType.ChooseOperatingCompany &&
                aggregatedType === currentAggregatedType &&
                ((aggregatedType === ActionType.PassMergerBid ||
                    aggregatedType === ActionType.Pass ||
                    aggregatedType === ActionType.PlaceMergerBid ||
                    aggregatedType === ActionType.PlaceTurnOrderBid) ||
                    action.playerId === currentPlayerId)
            ) {
                aggregatedGroup.push(action)
            } else {
                yield aggregateIndonesiaActions(aggregatedGroup)
                aggregatedGroup = [action]
                currentPlayerId = action.playerId
                currentAggregatedType = aggregatedType
            }
            continue
        }

        if (aggregatedGroup.length > 0) {
            yield aggregateIndonesiaActions(aggregatedGroup)
            aggregatedGroup = []
            currentPlayerId = undefined
            currentAggregatedType = null
        }
        yield action
    }

    if (aggregatedGroup.length > 0) {
        yield aggregateIndonesiaActions(aggregatedGroup)
    }
}
