import type { GameAction } from '@tabletop/common'
import {
    HutType,
    isBuild,
    isCelebrate,
    isDeliver,
    isFish,
    isMoveGod,
    isPass,
    isPlaceBid,
    isLoseValue,
    isIncrease,
    isSacrifice,
    isChooseScoringIsland,
    isScoreHuts,
    isScoreIsland
} from '@tabletop/kaivai'

export function getHistoryDescriptionForAction(action?: GameAction) {
    if (!action) {
        return ''
    }
    switch (true) {
        case isPlaceBid(action): {
            return `placed a bid of ${action.amount}`
        }
        case isDeliver(action): {
            const numFish = action.deliveries.reduce((acc, delivery) => acc + delivery.amount, 0)
            return `delivered ${numFish} fish` // Earning X shells
        }
        case isBuild(action): {
            switch (action.hutType) {
                case HutType.BoatBuilding: {
                    return 'built a boat building hut'
                }
                case HutType.Fishing: {
                    return 'built a fishing hut'
                }
                case HutType.Meeting: {
                    return 'built a meeting hut'
                }
            }
            break
        }
        case isCelebrate(action): {
            return 'celebrated' // earning X points
        }
        case isFish(action): {
            return `went fishing and caught ${action.metadata?.numFish ?? 'some'} fish`
        }
        case isIncrease(action): {
            return 'increased their movement bonus'
        }
        case isPass(action): {
            return 'passed'
        }
        case isLoseValue(action): {
            return `Everyone's shells and fish lost value`
        }
        case isMoveGod(action): {
            return 'moved the Fisherman God'
        }
        case isSacrifice(action): {
            return 'sacrificed all of their actions to gain 2 influence'
        }
        case isChooseScoringIsland(action): {
            if (action.playerId) {
                return 'chose an island to score'
            } else {
                return 'The last island is being scored'
            }
        }
        case isScoreHuts(action): {
            return 'Huts were scored'
        }
        case isScoreIsland(action): {
            return 'An island was scored'
        }
        default:
            return action.type
    }
}
