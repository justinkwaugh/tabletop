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
          worldSlots: 0
          earthlikeRestricted: false
      }
    | {
          id: string
          name: string
          sector: Sector
          coords: AxialCoordinates
          worldSlots: number
          earthlikeRestricted: boolean
          habitability: number
          exploration: SystemExploration
          lightYears: number
      }

export type StarSystemDefinition = Extract<SystemDefinition, { habitability: number }>
