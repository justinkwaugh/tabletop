import { defineAction, type ActionDefinition } from '../actions/actionDefinition.js'
import type { EndingRules } from './gameEnding.js'
import { ScheduleGameEnd, HydratedScheduleGameEnd, isScheduleGameEnd } from './scheduleGameEnd.js'
import { EndGame, HydratedEndGame, isEndGame } from './endGame.js'

export function endingActions(rules: EndingRules): ActionDefinition[] {
    return [
        defineAction(
            ScheduleGameEnd,
            isScheduleGameEnd,
            (action) => new HydratedScheduleGameEnd(action, rules)
        ),
        defineAction(EndGame, isEndGame, (action) => new HydratedEndGame(action, rules))
    ]
}
