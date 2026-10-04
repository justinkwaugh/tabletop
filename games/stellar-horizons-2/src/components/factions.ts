import { Color } from '@tabletop/common'

export enum Faction {
    Consortium = 'Consortium',
    Givers = 'Givers',
    Praetorians = 'Praetorians',
    Starfarers = 'Starfarers',
    Syndicate = 'Syndicate',
    Transhumanists = 'Transhumanists',
    TruePath = 'TruePath'
}

export interface FactionDefinition {
    faction: Faction
    name: string
    color: Color
}

export const FACTIONS: readonly FactionDefinition[] = [
    { faction: Faction.Consortium, name: 'The Consortium', color: Color.Brown },
    { faction: Faction.Givers, name: 'The Givers', color: Color.Green },
    { faction: Faction.Praetorians, name: 'The Praetorians', color: Color.Purple },
    { faction: Faction.Starfarers, name: 'The Starfarers', color: Color.Blue },
    { faction: Faction.Syndicate, name: 'The Syndicate', color: Color.Red },
    { faction: Faction.Transhumanists, name: 'The Transhumanists', color: Color.Black },
    { faction: Faction.TruePath, name: 'The True Path', color: Color.Yellow }
]

export const FACTION_COLORS: Color[] = FACTIONS.map((definition) => definition.color)

export function factionDefinition(faction: Faction): FactionDefinition {
    const definition = FACTIONS.find((candidate) => candidate.faction === faction)
    if (!definition) {
        throw new Error(`Unknown faction ${faction}`)
    }
    return definition
}
