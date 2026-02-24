import { Good } from '../definition/goods.js'
import * as Type from 'typebox'

const Demand = Type.Partial(
    Type.Object({
        [Good.Rice]: Type.Number(),
        [Good.Spice]: Type.Number(),
        [Good.Rubber]: Type.Number(),
        [Good.Oil]: Type.Number(),
        [Good.SiapSaji]: Type.Number()
    })
)

export type City = Type.Static<typeof City>
export const City = Type.Object({
    id: Type.String(),
    area: Type.String(),
    size: Type.Number(),
    demand: Demand
})
