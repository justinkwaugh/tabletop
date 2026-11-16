import * as Type from 'typebox'
import { Game } from '../game/model/game.js'
import { TitleActivity } from './titleActivity.js'

/** Title Activity across every Game Title of a Series, plus every listed game waiting for players. */
export const SeriesActivity = Type.Object({
    open: Type.Array(Game),
    ...TitleActivity.properties
})
export type SeriesActivity = Type.Static<typeof SeriesActivity>
