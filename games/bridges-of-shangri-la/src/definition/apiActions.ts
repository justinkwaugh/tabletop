import { RecruitStudents } from '../actions/recruitStudents'
import { PlaceMaster } from '../actions/placeMaster'
import { ActionType } from './actions'
import { BeginJourney } from '../actions/beginJourney'

export const BridgesApiActions = {
    [ActionType.PlaceMaster]: PlaceMaster,
    [ActionType.RecruitStudents]: RecruitStudents,
    [ActionType.BeginJourney]: BeginJourney
}
