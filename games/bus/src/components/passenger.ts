import * as Type from 'typebox'


export type Passenger = Type.Static<typeof Passenger>
export const Passenger = Type.Object({
    id: Type.String(),
    nodeId: Type.Optional(Type.String()),
    siteId: Type.Optional(Type.String())
})

