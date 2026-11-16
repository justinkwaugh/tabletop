import * as Type from 'typebox'
import { Game } from '../game/model/game.js'

/**
 * Publicly listed Hosted Games of one Game Title: every In Progress one, most recently moved
 * first, and the most recently Finished ones, newest first.
 */
export const TitleActivity = Type.Object({
    inProgress: Type.Array(Game),
    recentlyFinished: Type.Array(Game)
})
export type TitleActivity = Type.Static<typeof TitleActivity>

// Clients match on this name, so it stays as first named when only titles were listed.
export const ACTIVITY_UNAVAILABLE = 'TitleActivityUnavailable'
