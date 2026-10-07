import * as Type from 'typebox'
import type { TitlePreferenceDefinition } from '@tabletop/common'

export enum BuildingStyle {
    TowerRoofs = 'towerRoofs',
    PointPips = 'pointPips'
}

export const UrbinoPreferences = Type.Object(
    {
        buildingStyle: Type.Enum(BuildingStyle)
    },
    { additionalProperties: false }
)

export const UrbinoPreferenceDefinition = {
    title: {
        schema: UrbinoPreferences,
        defaults: {
            buildingStyle: BuildingStyle.TowerRoofs
        },
        version: 1
    }
} satisfies TitlePreferenceDefinition<typeof UrbinoPreferences>
