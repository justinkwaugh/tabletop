import { RecruitStudents } from '../actions/recruitStudents.js'
import { PlaceMaster } from '../actions/placeMaster.js'
import { ActionType } from './actions.js'
import { BeginJourney } from '../actions/beginJourney.js'
import { Pass } from '../actions/pass.js'

export const BridgesApiActions = {
    [ActionType.PlaceMaster]: PlaceMaster,
    [ActionType.RecruitStudents]: RecruitStudents,
    [ActionType.BeginJourney]: BeginJourney,
    [ActionType.Pass]: Pass
}
