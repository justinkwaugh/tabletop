import { Type, type Static } from '@sinclair/typebox'
import { ActionGroup } from './actionGroup.js'

export type Turn = Static<typeof Turn>
export const Turn = Type.Object({
    ...ActionGroup.properties,
    playerId: Type.String()
})
