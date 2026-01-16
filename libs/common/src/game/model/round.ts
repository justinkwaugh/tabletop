import * as Type from 'typebox'
import { ActionGroup } from './actionGroup.js'

export type Round = Type.Static<typeof Round>
export const Round = Type.Object({
    ...ActionGroup.properties,
    number: Type.Number()
})
