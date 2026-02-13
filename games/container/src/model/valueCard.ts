import { Type, type Static } from 'typebox'
import { ContainerColor } from './container.js'

export type ContainerValueCard = Static<typeof ContainerValueCard>
export const ContainerValueCard = Type.Object({
    specialColor: Type.Enum(ContainerColor),
    values: Type.Record(Type.Enum(ContainerColor), Type.Number()),
    specialValueIfComplete: Type.Number(),
    specialValueIfIncomplete: Type.Number()
})
