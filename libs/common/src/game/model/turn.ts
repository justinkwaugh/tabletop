import * as Type from 'typebox'
import { ActionGroup } from './actionGroup.js'

export type Turn = Type.Static<typeof Turn>
export const Turn = Type.Object({
    ...ActionGroup.properties,
    playerId: Type.String()
})
