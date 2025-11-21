import { Type, type Static } from 'typebox'
import { ActionGroup } from './actionGroup.js'

export type Round = Static<typeof Round>
export const Round = Type.Object({
    ...ActionGroup.properties,
    number: Type.Number()
})
