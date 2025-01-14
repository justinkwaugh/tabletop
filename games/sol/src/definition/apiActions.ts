import { Fly } from '../actions/fly.js'
import { Launch } from '../actions/launch.js'
import { ActionType } from './actions.js'

export const SolApiActions = {
    [ActionType.Launch]: Launch,
    [ActionType.Fly]: Fly
}
