import { Type, type Static } from 'typebox'

export type Boat = Static<typeof Boat>
export const Boat = Type.Object({
    id: Type.String(),
    owner: Type.String()
})
