import { TechField } from './techFields.js'

export enum WorldClass {
    M = 'M',
    O = 'O',
    L = 'L',
    H = 'H',
    P = 'P',
    K = 'K',
    A = 'A',
    J = 'J',
    D = 'D',
    E = 'E',
    None = 'None'
}

export enum WorldSide {
    I = 'I',
    II = 'II'
}

export interface WorldFace {
    maxPopulation: number
    techField: TechField
    techValue: number
    cash: number
}

export type WorldTileDefinition =
    | { id: string; worldClass: WorldClass.None }
    | {
          id: string
          worldClass: Exclude<WorldClass, WorldClass.None>
          sides: Record<WorldSide, WorldFace>
      }
