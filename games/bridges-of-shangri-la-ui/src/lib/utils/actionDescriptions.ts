import { gameCallDescription, gameCallOf, type GameAction } from '@tabletop/common'
import {
    isPlaceMaster,
    isRecruitStudents,
    isBeginJourney,
    isPass
} from '@tabletop/bridges-of-shangri-la'
import { nameForMasterType } from './masterNames.js'

export function getDescriptionForAction(action: GameAction, nameOf: (playerId: string) => string) {
    const call = gameCallOf(action)
    if (call) {
        return gameCallDescription(call, nameOf)
    }
    switch (true) {
        case isPlaceMaster(action):
            return `placed ${nameForMasterType(action.placement.masterType, true)} master`
        case isRecruitStudents(action): {
            const skipInfo = action.metadata?.forceSkip ? ' but was unable to recruit another' : ''
            return `placed ${nameForMasterType(action.placement.masterType, true)} student${skipInfo}`
        }
        case isBeginJourney(action):
            return 'journied from one village to another'
        case isPass(action):
            if (action.metadata?.recruiting) {
                return 'declined to recruit a second student'
            }
            return 'passed'
        default:
            return action.type
    }
}
