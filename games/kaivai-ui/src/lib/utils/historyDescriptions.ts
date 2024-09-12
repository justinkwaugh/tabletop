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
    isScoreIsland,
    isMove
} from '@tabletop/kaivai'

export function getHistoryDescriptionForAction(action?: GameAction, self?: boolean) {
    if (!action) {
        return ''
    }
    switch (true) {
        case isPlaceBid(action): {
            return `placed a bid of ${action.amount}`
        }
        case isDeliver(action): {
            const numFish = action.deliveries.reduce((acc, delivery) => acc + delivery.amount, 0)
            return `delivered ${numFish} fish`
        }
        case isBuild(action): {
            let message = ''
            switch (action.hutType) {
                case HutType.BoatBuilding: {
                    message = 'built a boat building hut'
                    break
                }
                case HutType.Fishing: {
                    message = 'built a fishing hut'
                    break
                }
                case HutType.Meeting: {
                    message = 'built a meeting hut'
                    break
                }
            }
            if (action.metadata?.cost) {
                message += ` at a cost of ${action.metadata.cost}`
            }
            return message
        }
        case isCelebrate(action): {
            return 'celebrated' // earning X points
        }
        case isFish(action): {
            return `went fishing and caught ${action.metadata?.numFish ?? 'some'} fish`
        }
        case isIncrease(action): {
            return `increased ${self ? 'your' : 'their'} movement bonus`
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
            return `sacrificed all of ${self ? 'your' : 'their'} actions to gain 2 influence`
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
        case isMove(action): {
            return action.metadata?.playerSunk ? '' : 'moved a boat'
        }
        default:
            return action.type
    }
}
