import type { AxialCoordinates } from '@tabletop/common'
import { TechField } from './techFields.js'

export enum Sector {
    Sol = 'Sol',
    AlphaCentauri = 'AlphaCentauri',
    TauCeti = 'TauCeti',
    EpsilonEridani = 'EpsilonEridani',
    Altair = 'Altair',
    DeltaPavonis = 'DeltaPavonis',
    GammaSerpentis = 'GammaSerpentis',
    BetaAquilae = 'BetaAquilae'
}

export const SOL_SYSTEM_ID = 'sol'

export interface SystemExploration {
    field: TechField
    bonus: number
}

export type SystemDefinition =
    | {
          id: typeof SOL_SYSTEM_ID
          name: string
          sector: Sector.Sol
          coords: AxialCoordinates
          star: string
          worldSlots: 0
          earthlikeRestricted: false
      }
    | {
          id: string
          name: string
          sector: Sector
          coords: AxialCoordinates
          // The star type printed on the tile, e.g. "M4V Red Dwarf (3100K)".
          star: string
          worldSlots: number
          earthlikeRestricted: boolean
          habitability: number
          exploration: SystemExploration
          lightYears: number
      }

export type StarSystemDefinition = Extract<SystemDefinition, { habitability: number }>

// Infrared Vision (genetic manipulation II) counts systems whose printed star is a red or brown
// dwarf.
export function isDwarfStar(system: SystemDefinition): boolean {
    return /\b(Red|Brown) Dwarf\b/i.test(system.star)
}
