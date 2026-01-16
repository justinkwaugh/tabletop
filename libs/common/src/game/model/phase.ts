import * as Type from 'typebox'
import { ActionGroup } from './actionGroup.js'

export type Phase = Type.Static<typeof Phase>
export const Phase = Type.Object({
    ...ActionGroup.properties,
    name: Type.String()
})
