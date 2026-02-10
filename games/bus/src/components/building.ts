import * as Type from 'typebox'

export enum BuildingType {
    House = 'House',
    Office = 'Office',
    Pub = 'Pub'
}

export type Building = Type.Static<typeof Building>
export const Building = Type.Object({
    id: Type.String(),
    type: Type.Enum(BuildingType),
    site: Type.String()
})
