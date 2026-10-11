import * as Type from 'typebox'
import {
    BaseConfigurator,
    ConfigOptionType,
    type GameConfig,
    type GameConfigOptions
} from '@tabletop/common'
import { Scenario } from '../components/timeTrack.js'

export enum SideSelection {
    Random = 'Random',
    Auction = 'Auction'
}

export type NapoleonsTriumphGameConfig = Type.Static<typeof NapoleonsTriumphGameConfig>
export const NapoleonsTriumphGameConfig = Type.Object({
    scenario: Type.Optional(Type.Enum(Scenario)),
    sideSelection: Type.Optional(Type.Enum(SideSelection)),
    santon: Type.Optional(Type.Boolean())
})

export const NapoleonsTriumphGameConfigOptions: GameConfigOptions = [
    {
        id: 'scenario',
        type: ConfigOptionType.List,
        name: 'Scenario',
        description:
            'The day of battle, or the day before it with the Allied army still marching onto the field',
        default: Scenario.December2,
        options: [
            { name: '2 December', value: Scenario.December2 },
            { name: '1 December', value: Scenario.December1 }
        ],
        alwaysShow: true
    },
    {
        id: 'sideSelection',
        type: ConfigOptionType.List,
        name: 'Sides',
        description: 'Deal the armies at random, or bid starting morale for the choice of army',
        default: SideSelection.Random,
        options: [
            { name: 'Random', value: SideSelection.Random },
            { name: 'Morale auction', value: SideSelection.Auction }
        ],
        alwaysShow: true
    },
    {
        id: 'santon',
        type: ConfigOptionType.Boolean,
        name: 'The Santon',
        description: 'The steep hill on the French left gets its own rules for artillery',
        default: false
    }
]

export class NapoleonsTriumphConfigurator extends BaseConfigurator {
    schema = NapoleonsTriumphGameConfig
    options = NapoleonsTriumphGameConfigOptions
}

export function scenarioOf(config: GameConfig): Scenario {
    return Object.values(Scenario).find((value) => value === config.scenario) ?? Scenario.December2
}

export function sideSelectionOf(config: GameConfig): SideSelection {
    return (
        Object.values(SideSelection).find((value) => value === config.sideSelection) ??
        SideSelection.Random
    )
}

export function santonOf(config: GameConfig): boolean {
    return config.santon === true
}
