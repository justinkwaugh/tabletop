import * as Type from 'typebox'
export type Boat = Type.Static<typeof Boat>
export const Boat = Type.Object({
    id: Type.String(),
    owner: Type.String()
})
