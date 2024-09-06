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
    isIncrease
} from '@tabletop/kaivai'

export function getHistoryDescriptionForAction(action?: GameAction) {
    if (!action) {
        return ''
    }
    switch (true) {
        case isPlaceBid(action): {
            return `bid ${action.amount}`
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
            return 'went fishing'
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
        default:
            return action.type
    }
}
