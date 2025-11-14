import { Type, type Static } from 'typebox'
import { ActionGroup } from './actionGroup.js'

export type Phase = Static<typeof Phase>
export const Phase = Type.Object({
    ...ActionGroup.properties,
    name: Type.String()
})
