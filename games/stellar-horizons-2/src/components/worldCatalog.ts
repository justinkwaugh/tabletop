import { TechField } from './techFields.js'
import { WorldClass, type WorldTileDefinition } from './worldTypes.js'

export const WORLD_TILES: readonly WorldTileDefinition[] = [
    {
        id: 'm-1',
        worldClass: WorldClass.M,
        sides: {
            I: { maxPopulation: 25, techField: TechField.Biology, techValue: 2, cash: 4 },
            II: { maxPopulation: 27, techField: TechField.Biology, techValue: 2, cash: 5 }
        }
    },
    {
        id: 'm-2',
        worldClass: WorldClass.M,
        sides: {
            I: { maxPopulation: 25, techField: TechField.Biology, techValue: 2, cash: 4 },
            II: { maxPopulation: 27, techField: TechField.Biology, techValue: 2, cash: 5 }
        }
    },
    {
        id: 'm-3',
        worldClass: WorldClass.M,
        sides: {
            I: { maxPopulation: 25, techField: TechField.Biology, techValue: 2, cash: 4 },
            II: { maxPopulation: 27, techField: TechField.Biology, techValue: 2, cash: 5 }
        }
    },
    {
        id: 'm-4',
        worldClass: WorldClass.M,
        sides: {
            I: { maxPopulation: 25, techField: TechField.Biology, techValue: 2, cash: 4 },
            II: { maxPopulation: 27, techField: TechField.Biology, techValue: 2, cash: 6 }
        }
    },
    {
        id: 'm-5',
        worldClass: WorldClass.M,
        sides: {
            I: { maxPopulation: 25, techField: TechField.Biology, techValue: 2, cash: 4 },
            II: { maxPopulation: 27, techField: TechField.Biology, techValue: 2, cash: 6 }
        }
    },
    {
        id: 'm-6',
        worldClass: WorldClass.M,
        sides: {
            I: { maxPopulation: 25, techField: TechField.Biology, techValue: 2, cash: 4 },
            II: { maxPopulation: 27, techField: TechField.Biology, techValue: 2, cash: 6 }
        }
    },
    {
        id: 'm-7',
        worldClass: WorldClass.M,
        sides: {
            I: { maxPopulation: 25, techField: TechField.Biology, techValue: 3, cash: 5 },
            II: { maxPopulation: 30, techField: TechField.Biology, techValue: 3, cash: 8 }
        }
    },
    {
        id: 'm-8',
        worldClass: WorldClass.M,
        sides: {
            I: { maxPopulation: 25, techField: TechField.Biology, techValue: 3, cash: 5 },
            II: { maxPopulation: 27, techField: TechField.Biology, techValue: 3, cash: 6 }
        }
    },
    {
        id: 'm-9',
        worldClass: WorldClass.M,
        sides: {
            I: { maxPopulation: 26, techField: TechField.Biology, techValue: 2, cash: 4 },
            II: { maxPopulation: 29, techField: TechField.Biology, techValue: 2, cash: 5 }
        }
    },
    {
        id: 'm-10',
        worldClass: WorldClass.M,
        sides: {
            I: { maxPopulation: 26, techField: TechField.Biology, techValue: 2, cash: 6 },
            II: { maxPopulation: 29, techField: TechField.Biology, techValue: 2, cash: 7 }
        }
    },
    {
        id: 'm-11',
        worldClass: WorldClass.M,
        sides: {
            I: { maxPopulation: 26, techField: TechField.Biology, techValue: 3, cash: 4 },
            II: { maxPopulation: 27, techField: TechField.Biology, techValue: 3, cash: 5 }
        }
    },
    {
        id: 'm-12',
        worldClass: WorldClass.M,
        sides: {
            I: { maxPopulation: 26, techField: TechField.Biology, techValue: 3, cash: 5 },
            II: { maxPopulation: 30, techField: TechField.Biology, techValue: 3, cash: 8 }
        }
    },
    {
        id: 'm-13',
        worldClass: WorldClass.M,
        sides: {
            I: { maxPopulation: 26, techField: TechField.Biology, techValue: 3, cash: 6 },
            II: { maxPopulation: 30, techField: TechField.Biology, techValue: 3, cash: 7 }
        }
    },
    {
        id: 'm-14',
        worldClass: WorldClass.M,
        sides: {
            I: { maxPopulation: 26, techField: TechField.Biology, techValue: 3, cash: 6 },
            II: { maxPopulation: 27, techField: TechField.Biology, techValue: 3, cash: 7 }
        }
    },
    {
        id: 'm-15',
        worldClass: WorldClass.M,
        sides: {
            I: { maxPopulation: 27, techField: TechField.Biology, techValue: 2, cash: 4 },
            II: { maxPopulation: 29, techField: TechField.Biology, techValue: 2, cash: 5 }
        }
    },
    {
        id: 'm-16',
        worldClass: WorldClass.M,
        sides: {
            I: { maxPopulation: 27, techField: TechField.Biology, techValue: 2, cash: 6 },
            II: { maxPopulation: 29, techField: TechField.Biology, techValue: 2, cash: 7 }
        }
    },
    {
        id: 'm-17',
        worldClass: WorldClass.M,
        sides: {
            I: { maxPopulation: 27, techField: TechField.Biology, techValue: 3, cash: 5 },
            II: { maxPopulation: 29, techField: TechField.Biology, techValue: 3, cash: 7 }
        }
    },
    {
        id: 'm-18',
        worldClass: WorldClass.M,
        sides: {
            I: { maxPopulation: 27, techField: TechField.Biology, techValue: 3, cash: 5 },
            II: { maxPopulation: 29, techField: TechField.Biology, techValue: 3, cash: 7 }
        }
    },
    {
        id: 'o-1',
        worldClass: WorldClass.O,
        sides: {
            I: { maxPopulation: 17, techField: TechField.Biology, techValue: 3, cash: 4 },
            II: { maxPopulation: 22, techField: TechField.Biology, techValue: 3, cash: 4 }
        }
    },
    {
        id: 'o-2',
        worldClass: WorldClass.O,
        sides: {
            I: { maxPopulation: 18, techField: TechField.Biology, techValue: 2, cash: 2 },
            II: { maxPopulation: 20, techField: TechField.Biology, techValue: 2, cash: 2 }
        }
    },
    {
        id: 'o-3',
        worldClass: WorldClass.O,
        sides: {
            I: { maxPopulation: 19, techField: TechField.Biology, techValue: 3, cash: 3 },
            II: { maxPopulation: 22, techField: TechField.Biology, techValue: 4, cash: 3 }
        }
    },
    {
        id: 'o-4',
        worldClass: WorldClass.O,
        sides: {
            I: { maxPopulation: 19, techField: TechField.Biology, techValue: 4, cash: 4 },
            II: { maxPopulation: 23, techField: TechField.Biology, techValue: 4, cash: 5 }
        }
    },
    {
        id: 'o-5',
        worldClass: WorldClass.O,
        sides: {
            I: { maxPopulation: 20, techField: TechField.Biology, techValue: 1, cash: 2 },
            II: { maxPopulation: 22, techField: TechField.Biology, techValue: 2, cash: 4 }
        }
    },
    {
        id: 'o-6',
        worldClass: WorldClass.O,
        sides: {
            I: { maxPopulation: 20, techField: TechField.Biology, techValue: 1, cash: 3 },
            II: { maxPopulation: 22, techField: TechField.Biology, techValue: 2, cash: 4 }
        }
    },
    {
        id: 'o-7',
        worldClass: WorldClass.O,
        sides: {
            I: { maxPopulation: 20, techField: TechField.Biology, techValue: 2, cash: 2 },
            II: { maxPopulation: 22, techField: TechField.Biology, techValue: 3, cash: 4 }
        }
    },
    {
        id: 'o-8',
        worldClass: WorldClass.O,
        sides: {
            I: { maxPopulation: 20, techField: TechField.Biology, techValue: 3, cash: 3 },
            II: { maxPopulation: 21, techField: TechField.Biology, techValue: 3, cash: 4 }
        }
    },
    {
        id: 'o-9',
        worldClass: WorldClass.O,
        sides: {
            I: { maxPopulation: 21, techField: TechField.Biology, techValue: 2, cash: 3 },
            II: { maxPopulation: 23, techField: TechField.Biology, techValue: 3, cash: 5 }
        }
    },
    {
        id: 'o-10',
        worldClass: WorldClass.O,
        sides: {
            I: { maxPopulation: 21, techField: TechField.Biology, techValue: 2, cash: 3 },
            II: { maxPopulation: 23, techField: TechField.Biology, techValue: 3, cash: 5 }
        }
    },
    {
        id: 'o-11',
        worldClass: WorldClass.O,
        sides: {
            I: { maxPopulation: 21, techField: TechField.Biology, techValue: 3, cash: 3 },
            II: { maxPopulation: 23, techField: TechField.Biology, techValue: 4, cash: 4 }
        }
    },
    {
        id: 'o-12',
        worldClass: WorldClass.O,
        sides: {
            I: { maxPopulation: 22, techField: TechField.Biology, techValue: 2, cash: 3 },
            II: { maxPopulation: 23, techField: TechField.Biology, techValue: 3, cash: 5 }
        }
    },
    {
        id: 'l-1',
        worldClass: WorldClass.L,
        sides: {
            I: { maxPopulation: 16, techField: TechField.Engineering, techValue: 1, cash: 3 },
            II: { maxPopulation: 18, techField: TechField.Engineering, techValue: 2, cash: 4 }
        }
    },
    {
        id: 'l-2',
        worldClass: WorldClass.L,
        sides: {
            I: { maxPopulation: 16, techField: TechField.Engineering, techValue: 1, cash: 3 },
            II: { maxPopulation: 18, techField: TechField.Engineering, techValue: 2, cash: 4 }
        }
    },
    {
        id: 'l-3',
        worldClass: WorldClass.L,
        sides: {
            I: { maxPopulation: 16, techField: TechField.Engineering, techValue: 1, cash: 4 },
            II: { maxPopulation: 20, techField: TechField.Engineering, techValue: 3, cash: 5 }
        }
    },
    {
        id: 'l-4',
        worldClass: WorldClass.L,
        sides: {
            I: { maxPopulation: 16, techField: TechField.Engineering, techValue: 1, cash: 4 },
            II: { maxPopulation: 18, techField: TechField.Engineering, techValue: 2, cash: 5 }
        }
    },
    {
        id: 'l-5',
        worldClass: WorldClass.L,
        sides: {
            I: { maxPopulation: 16, techField: TechField.Engineering, techValue: 2, cash: 4 },
            II: { maxPopulation: 18, techField: TechField.Engineering, techValue: 2, cash: 5 }
        }
    },
    {
        id: 'l-6',
        worldClass: WorldClass.L,
        sides: {
            I: { maxPopulation: 16, techField: TechField.Engineering, techValue: 2, cash: 4 },
            II: { maxPopulation: 18, techField: TechField.Engineering, techValue: 2, cash: 5 }
        }
    },
    {
        id: 'l-7',
        worldClass: WorldClass.L,
        sides: {
            I: { maxPopulation: 16, techField: TechField.Engineering, techValue: 2, cash: 5 },
            II: { maxPopulation: 19, techField: TechField.Engineering, techValue: 3, cash: 6 }
        }
    },
    {
        id: 'l-8',
        worldClass: WorldClass.L,
        sides: {
            I: { maxPopulation: 17, techField: TechField.Engineering, techValue: 1, cash: 4 },
            II: { maxPopulation: 19, techField: TechField.Engineering, techValue: 2, cash: 5 }
        }
    },
    {
        id: 'l-9',
        worldClass: WorldClass.L,
        sides: {
            I: { maxPopulation: 17, techField: TechField.Engineering, techValue: 2, cash: 5 },
            II: { maxPopulation: 19, techField: TechField.Engineering, techValue: 3, cash: 6 }
        }
    },
    {
        id: 'l-10',
        worldClass: WorldClass.L,
        sides: {
            I: { maxPopulation: 17, techField: TechField.Engineering, techValue: 2, cash: 5 },
            II: { maxPopulation: 19, techField: TechField.Engineering, techValue: 3, cash: 6 }
        }
    },
    {
        id: 'l-11',
        worldClass: WorldClass.L,
        sides: {
            I: { maxPopulation: 17, techField: TechField.Engineering, techValue: 3, cash: 6 },
            II: { maxPopulation: 19, techField: TechField.Engineering, techValue: 4, cash: 7 }
        }
    },
    {
        id: 'l-12',
        worldClass: WorldClass.L,
        sides: {
            I: { maxPopulation: 17, techField: TechField.Engineering, techValue: 3, cash: 6 },
            II: { maxPopulation: 19, techField: TechField.Engineering, techValue: 4, cash: 7 }
        }
    },
    {
        id: 'l-13',
        worldClass: WorldClass.L,
        sides: {
            I: { maxPopulation: 18, techField: TechField.Engineering, techValue: 1, cash: 3 },
            II: { maxPopulation: 20, techField: TechField.Engineering, techValue: 2, cash: 4 }
        }
    },
    {
        id: 'l-14',
        worldClass: WorldClass.L,
        sides: {
            I: { maxPopulation: 18, techField: TechField.Engineering, techValue: 2, cash: 4 },
            II: { maxPopulation: 20, techField: TechField.Engineering, techValue: 3, cash: 5 }
        }
    },
    {
        id: 'l-15',
        worldClass: WorldClass.L,
        sides: {
            I: { maxPopulation: 18, techField: TechField.Engineering, techValue: 2, cash: 5 },
            II: { maxPopulation: 20, techField: TechField.Engineering, techValue: 3, cash: 6 }
        }
    },
    {
        id: 'l-16',
        worldClass: WorldClass.L,
        sides: {
            I: { maxPopulation: 18, techField: TechField.Engineering, techValue: 3, cash: 6 },
            II: { maxPopulation: 20, techField: TechField.Engineering, techValue: 4, cash: 7 }
        }
    },
    {
        id: 'h-1',
        worldClass: WorldClass.H,
        sides: {
            I: { maxPopulation: 13, techField: TechField.Engineering, techValue: 2, cash: 4 },
            II: { maxPopulation: 14, techField: TechField.Engineering, techValue: 2, cash: 5 }
        }
    },
    {
        id: 'h-2',
        worldClass: WorldClass.H,
        sides: {
            I: { maxPopulation: 13, techField: TechField.Engineering, techValue: 2, cash: 4 },
            II: { maxPopulation: 14, techField: TechField.Engineering, techValue: 2, cash: 5 }
        }
    },
    {
        id: 'h-3',
        worldClass: WorldClass.H,
        sides: {
            I: { maxPopulation: 13, techField: TechField.Engineering, techValue: 2, cash: 4 },
            II: { maxPopulation: 14, techField: TechField.Engineering, techValue: 2, cash: 5 }
        }
    },
    {
        id: 'h-4',
        worldClass: WorldClass.H,
        sides: {
            I: { maxPopulation: 13, techField: TechField.Engineering, techValue: 2, cash: 4 },
            II: { maxPopulation: 14, techField: TechField.Engineering, techValue: 2, cash: 5 }
        }
    },
    {
        id: 'h-5',
        worldClass: WorldClass.H,
        sides: {
            I: { maxPopulation: 13, techField: TechField.Engineering, techValue: 2, cash: 4 },
            II: { maxPopulation: 14, techField: TechField.Engineering, techValue: 2, cash: 5 }
        }
    },
    {
        id: 'h-6',
        worldClass: WorldClass.H,
        sides: {
            I: { maxPopulation: 13, techField: TechField.Engineering, techValue: 2, cash: 5 },
            II: { maxPopulation: 14, techField: TechField.Engineering, techValue: 2, cash: 6 }
        }
    },
    {
        id: 'h-7',
        worldClass: WorldClass.H,
        sides: {
            I: { maxPopulation: 13, techField: TechField.Engineering, techValue: 3, cash: 5 },
            II: { maxPopulation: 14, techField: TechField.Engineering, techValue: 3, cash: 6 }
        }
    },
    {
        id: 'h-8',
        worldClass: WorldClass.H,
        sides: {
            I: { maxPopulation: 14, techField: TechField.Engineering, techValue: 1, cash: 3 },
            II: { maxPopulation: 15, techField: TechField.Engineering, techValue: 1, cash: 4 }
        }
    },
    {
        id: 'h-9',
        worldClass: WorldClass.H,
        sides: {
            I: { maxPopulation: 14, techField: TechField.Engineering, techValue: 1, cash: 3 },
            II: { maxPopulation: 15, techField: TechField.Engineering, techValue: 1, cash: 4 }
        }
    },
    {
        id: 'h-10',
        worldClass: WorldClass.H,
        sides: {
            I: { maxPopulation: 14, techField: TechField.Engineering, techValue: 1, cash: 3 },
            II: { maxPopulation: 15, techField: TechField.Engineering, techValue: 1, cash: 4 }
        }
    },
    {
        id: 'h-11',
        worldClass: WorldClass.H,
        sides: {
            I: { maxPopulation: 14, techField: TechField.Engineering, techValue: 2, cash: 4 },
            II: { maxPopulation: 15, techField: TechField.Engineering, techValue: 2, cash: 5 }
        }
    },
    {
        id: 'h-12',
        worldClass: WorldClass.H,
        sides: {
            I: { maxPopulation: 14, techField: TechField.Engineering, techValue: 2, cash: 4 },
            II: { maxPopulation: 15, techField: TechField.Engineering, techValue: 2, cash: 5 }
        }
    },
    {
        id: 'h-13',
        worldClass: WorldClass.H,
        sides: {
            I: { maxPopulation: 14, techField: TechField.Engineering, techValue: 2, cash: 4 },
            II: { maxPopulation: 15, techField: TechField.Engineering, techValue: 2, cash: 5 }
        }
    },
    {
        id: 'h-14',
        worldClass: WorldClass.H,
        sides: {
            I: { maxPopulation: 14, techField: TechField.Engineering, techValue: 2, cash: 5 },
            II: { maxPopulation: 15, techField: TechField.Engineering, techValue: 2, cash: 6 }
        }
    },
    {
        id: 'h-15',
        worldClass: WorldClass.H,
        sides: {
            I: { maxPopulation: 14, techField: TechField.Engineering, techValue: 2, cash: 5 },
            II: { maxPopulation: 15, techField: TechField.Engineering, techValue: 2, cash: 6 }
        }
    },
    {
        id: 'h-16',
        worldClass: WorldClass.H,
        sides: {
            I: { maxPopulation: 14, techField: TechField.Engineering, techValue: 3, cash: 6 },
            II: { maxPopulation: 15, techField: TechField.Engineering, techValue: 3, cash: 7 }
        }
    },
    {
        id: 'p-1',
        worldClass: WorldClass.P,
        sides: {
            I: { maxPopulation: 10, techField: TechField.Physics, techValue: 2, cash: 1 },
            II: { maxPopulation: 11, techField: TechField.Physics, techValue: 2, cash: 3 }
        }
    },
    {
        id: 'p-2',
        worldClass: WorldClass.P,
        sides: {
            I: { maxPopulation: 11, techField: TechField.Physics, techValue: 2, cash: 2 },
            II: { maxPopulation: 13, techField: TechField.Physics, techValue: 2, cash: 4 }
        }
    },
    {
        id: 'p-3',
        worldClass: WorldClass.P,
        sides: {
            I: { maxPopulation: 11, techField: TechField.Physics, techValue: 2, cash: 2 },
            II: { maxPopulation: 13, techField: TechField.Physics, techValue: 2, cash: 4 }
        }
    },
    {
        id: 'p-4',
        worldClass: WorldClass.P,
        sides: {
            I: { maxPopulation: 11, techField: TechField.Physics, techValue: 3, cash: 2 },
            II: { maxPopulation: 12, techField: TechField.Physics, techValue: 4, cash: 4 }
        }
    },
    {
        id: 'p-5',
        worldClass: WorldClass.P,
        sides: {
            I: { maxPopulation: 11, techField: TechField.Physics, techValue: 3, cash: 3 },
            II: { maxPopulation: 13, techField: TechField.Physics, techValue: 3, cash: 4 }
        }
    },
    {
        id: 'p-6',
        worldClass: WorldClass.P,
        sides: {
            I: { maxPopulation: 11, techField: TechField.Physics, techValue: 3, cash: 3 },
            II: { maxPopulation: 13, techField: TechField.Physics, techValue: 3, cash: 4 }
        }
    },
    {
        id: 'p-7',
        worldClass: WorldClass.P,
        sides: {
            I: { maxPopulation: 11, techField: TechField.Physics, techValue: 3, cash: 4 },
            II: { maxPopulation: 13, techField: TechField.Physics, techValue: 3, cash: 5 }
        }
    },
    {
        id: 'p-8',
        worldClass: WorldClass.P,
        sides: {
            I: { maxPopulation: 12, techField: TechField.Physics, techValue: 1, cash: 1 },
            II: { maxPopulation: 13, techField: TechField.Physics, techValue: 2, cash: 2 }
        }
    },
    {
        id: 'p-9',
        worldClass: WorldClass.P,
        sides: {
            I: { maxPopulation: 12, techField: TechField.Physics, techValue: 2, cash: 2 },
            II: { maxPopulation: 14, techField: TechField.Physics, techValue: 2, cash: 4 }
        }
    },
    {
        id: 'p-10',
        worldClass: WorldClass.P,
        sides: {
            I: { maxPopulation: 12, techField: TechField.Physics, techValue: 2, cash: 2 },
            II: { maxPopulation: 14, techField: TechField.Physics, techValue: 2, cash: 4 }
        }
    },
    {
        id: 'p-11',
        worldClass: WorldClass.P,
        sides: {
            I: { maxPopulation: 12, techField: TechField.Physics, techValue: 3, cash: 2 },
            II: { maxPopulation: 14, techField: TechField.Physics, techValue: 3, cash: 4 }
        }
    },
    {
        id: 'p-12',
        worldClass: WorldClass.P,
        sides: {
            I: { maxPopulation: 12, techField: TechField.Physics, techValue: 3, cash: 3 },
            II: { maxPopulation: 14, techField: TechField.Physics, techValue: 3, cash: 4 }
        }
    },
    {
        id: 'p-13',
        worldClass: WorldClass.P,
        sides: {
            I: { maxPopulation: 12, techField: TechField.Physics, techValue: 3, cash: 3 },
            II: { maxPopulation: 14, techField: TechField.Physics, techValue: 3, cash: 4 }
        }
    },
    {
        id: 'p-14',
        worldClass: WorldClass.P,
        sides: {
            I: { maxPopulation: 9, techField: TechField.Physics, techValue: 1, cash: 1 },
            II: { maxPopulation: 10, techField: TechField.Physics, techValue: 2, cash: 2 }
        }
    },
    {
        id: 'k-1',
        worldClass: WorldClass.K,
        sides: {
            I: { maxPopulation: 5, techField: TechField.Engineering, techValue: 1, cash: 1 },
            II: { maxPopulation: 6, techField: TechField.Engineering, techValue: 1, cash: 3 }
        }
    },
    {
        id: 'k-2',
        worldClass: WorldClass.K,
        sides: {
            I: { maxPopulation: 5, techField: TechField.Engineering, techValue: 1, cash: 1 },
            II: { maxPopulation: 6, techField: TechField.Engineering, techValue: 1, cash: 3 }
        }
    },
    {
        id: 'k-3',
        worldClass: WorldClass.K,
        sides: {
            I: { maxPopulation: 6, techField: TechField.Engineering, techValue: 1, cash: 1 },
            II: { maxPopulation: 8, techField: TechField.Engineering, techValue: 1, cash: 3 }
        }
    },
    {
        id: 'k-4',
        worldClass: WorldClass.K,
        sides: {
            I: { maxPopulation: 6, techField: TechField.Engineering, techValue: 1, cash: 1 },
            II: { maxPopulation: 8, techField: TechField.Engineering, techValue: 1, cash: 3 }
        }
    },
    {
        id: 'k-5',
        worldClass: WorldClass.K,
        sides: {
            I: { maxPopulation: 6, techField: TechField.Engineering, techValue: 1, cash: 2 },
            II: { maxPopulation: 8, techField: TechField.Engineering, techValue: 1, cash: 3 }
        }
    },
    {
        id: 'k-6',
        worldClass: WorldClass.K,
        sides: {
            I: { maxPopulation: 6, techField: TechField.Engineering, techValue: 2, cash: 2 },
            II: { maxPopulation: 8, techField: TechField.Engineering, techValue: 1, cash: 3 }
        }
    },
    {
        id: 'k-7',
        worldClass: WorldClass.K,
        sides: {
            I: { maxPopulation: 6, techField: TechField.Engineering, techValue: 2, cash: 3 },
            II: { maxPopulation: 8, techField: TechField.Engineering, techValue: 2, cash: 4 }
        }
    },
    {
        id: 'k-8',
        worldClass: WorldClass.K,
        sides: {
            I: { maxPopulation: 7, techField: TechField.Engineering, techValue: 1, cash: 2 },
            II: { maxPopulation: 9, techField: TechField.Engineering, techValue: 1, cash: 3 }
        }
    },
    {
        id: 'k-9',
        worldClass: WorldClass.K,
        sides: {
            I: { maxPopulation: 7, techField: TechField.Engineering, techValue: 1, cash: 2 },
            II: { maxPopulation: 9, techField: TechField.Engineering, techValue: 1, cash: 3 }
        }
    },
    {
        id: 'k-10',
        worldClass: WorldClass.K,
        sides: {
            I: { maxPopulation: 7, techField: TechField.Engineering, techValue: 1, cash: 3 },
            II: { maxPopulation: 9, techField: TechField.Engineering, techValue: 1, cash: 4 }
        }
    },
    {
        id: 'k-11',
        worldClass: WorldClass.K,
        sides: {
            I: { maxPopulation: 7, techField: TechField.Engineering, techValue: 2, cash: 3 },
            II: { maxPopulation: 9, techField: TechField.Engineering, techValue: 2, cash: 4 }
        }
    },
    {
        id: 'k-12',
        worldClass: WorldClass.K,
        sides: {
            I: { maxPopulation: 7, techField: TechField.Engineering, techValue: 3, cash: 3 },
            II: { maxPopulation: 9, techField: TechField.Engineering, techValue: 3, cash: 4 }
        }
    },
    {
        id: 'k-13',
        worldClass: WorldClass.K,
        sides: {
            I: { maxPopulation: 7, techField: TechField.Engineering, techValue: 3, cash: 4 },
            II: { maxPopulation: 9, techField: TechField.Engineering, techValue: 3, cash: 5 }
        }
    },
    {
        id: 'k-14',
        worldClass: WorldClass.K,
        sides: {
            I: { maxPopulation: 7, techField: TechField.Engineering, techValue: 3, cash: 4 },
            II: { maxPopulation: 9, techField: TechField.Engineering, techValue: 3, cash: 5 }
        }
    },
    {
        id: 'k-15',
        worldClass: WorldClass.K,
        sides: {
            I: { maxPopulation: 7, techField: TechField.Engineering, techValue: 4, cash: 4 },
            II: { maxPopulation: 9, techField: TechField.Engineering, techValue: 4, cash: 5 }
        }
    },
    {
        id: 'k-16',
        worldClass: WorldClass.K,
        sides: {
            I: { maxPopulation: 8, techField: TechField.Engineering, techValue: 1, cash: 2 },
            II: { maxPopulation: 10, techField: TechField.Engineering, techValue: 1, cash: 4 }
        }
    },
    {
        id: 'k-17',
        worldClass: WorldClass.K,
        sides: {
            I: { maxPopulation: 8, techField: TechField.Engineering, techValue: 1, cash: 2 },
            II: { maxPopulation: 10, techField: TechField.Engineering, techValue: 1, cash: 4 }
        }
    },
    {
        id: 'k-18',
        worldClass: WorldClass.K,
        sides: {
            I: { maxPopulation: 8, techField: TechField.Engineering, techValue: 1, cash: 2 },
            II: { maxPopulation: 10, techField: TechField.Engineering, techValue: 1, cash: 4 }
        }
    },
    {
        id: 'k-19',
        worldClass: WorldClass.K,
        sides: {
            I: { maxPopulation: 8, techField: TechField.Engineering, techValue: 2, cash: 3 },
            II: { maxPopulation: 10, techField: TechField.Engineering, techValue: 2, cash: 5 }
        }
    },
    {
        id: 'k-20',
        worldClass: WorldClass.K,
        sides: {
            I: { maxPopulation: 8, techField: TechField.Engineering, techValue: 2, cash: 3 },
            II: { maxPopulation: 10, techField: TechField.Engineering, techValue: 2, cash: 5 }
        }
    },
    {
        id: 'k-21',
        worldClass: WorldClass.K,
        sides: {
            I: { maxPopulation: 8, techField: TechField.Engineering, techValue: 2, cash: 4 },
            II: { maxPopulation: 10, techField: TechField.Engineering, techValue: 2, cash: 5 }
        }
    },
    {
        id: 'k-22',
        worldClass: WorldClass.K,
        sides: {
            I: { maxPopulation: 8, techField: TechField.Engineering, techValue: 3, cash: 4 },
            II: { maxPopulation: 10, techField: TechField.Engineering, techValue: 3, cash: 5 }
        }
    },
    {
        id: 'k-23',
        worldClass: WorldClass.K,
        sides: {
            I: { maxPopulation: 9, techField: TechField.Engineering, techValue: 3, cash: 2 },
            II: { maxPopulation: 10, techField: TechField.Engineering, techValue: 3, cash: 4 }
        }
    },
    {
        id: 'a-1',
        worldClass: WorldClass.A,
        sides: {
            I: { maxPopulation: 4, techField: TechField.Physics, techValue: 2, cash: 5 },
            II: { maxPopulation: 5, techField: TechField.Physics, techValue: 2, cash: 6 }
        }
    },
    {
        id: 'a-2',
        worldClass: WorldClass.A,
        sides: {
            I: { maxPopulation: 5, techField: TechField.Physics, techValue: 3, cash: 5 },
            II: { maxPopulation: 6, techField: TechField.Physics, techValue: 3, cash: 6 }
        }
    },
    {
        id: 'a-3',
        worldClass: WorldClass.A,
        sides: {
            I: { maxPopulation: 5, techField: TechField.Physics, techValue: 3, cash: 7 },
            II: { maxPopulation: 6, techField: TechField.Physics, techValue: 3, cash: 9 }
        }
    },
    {
        id: 'a-4',
        worldClass: WorldClass.A,
        sides: {
            I: { maxPopulation: 5, techField: TechField.Physics, techValue: 3, cash: 7 },
            II: { maxPopulation: 6, techField: TechField.Physics, techValue: 3, cash: 9 }
        }
    },
    {
        id: 'a-5',
        worldClass: WorldClass.A,
        sides: {
            I: { maxPopulation: 5, techField: TechField.Physics, techValue: 4, cash: 6 },
            II: { maxPopulation: 6, techField: TechField.Physics, techValue: 4, cash: 9 }
        }
    },
    {
        id: 'a-6',
        worldClass: WorldClass.A,
        sides: {
            I: { maxPopulation: 5, techField: TechField.Physics, techValue: 4, cash: 6 },
            II: { maxPopulation: 6, techField: TechField.Physics, techValue: 4, cash: 9 }
        }
    },
    {
        id: 'a-7',
        worldClass: WorldClass.A,
        sides: {
            I: { maxPopulation: 6, techField: TechField.Physics, techValue: 2, cash: 6 },
            II: { maxPopulation: 7, techField: TechField.Physics, techValue: 2, cash: 9 }
        }
    },
    {
        id: 'a-8',
        worldClass: WorldClass.A,
        sides: {
            I: { maxPopulation: 6, techField: TechField.Physics, techValue: 3, cash: 7 },
            II: { maxPopulation: 7, techField: TechField.Physics, techValue: 3, cash: 9 }
        }
    },
    {
        id: 'a-9',
        worldClass: WorldClass.A,
        sides: {
            I: { maxPopulation: 6, techField: TechField.Physics, techValue: 3, cash: 7 },
            II: { maxPopulation: 7, techField: TechField.Physics, techValue: 3, cash: 9 }
        }
    },
    {
        id: 'a-10',
        worldClass: WorldClass.A,
        sides: {
            I: { maxPopulation: 6, techField: TechField.Physics, techValue: 4, cash: 7 },
            II: { maxPopulation: 7, techField: TechField.Physics, techValue: 4, cash: 9 }
        }
    },
    {
        id: 'a-11',
        worldClass: WorldClass.A,
        sides: {
            I: { maxPopulation: 6, techField: TechField.Physics, techValue: 4, cash: 8 },
            II: { maxPopulation: 7, techField: TechField.Physics, techValue: 4, cash: 9 }
        }
    },
    {
        id: 'j-1',
        worldClass: WorldClass.J,
        sides: {
            I: { maxPopulation: 4, techField: TechField.Physics, techValue: 3, cash: 4 },
            II: { maxPopulation: 8, techField: TechField.Physics, techValue: 3, cash: 8 }
        }
    },
    {
        id: 'j-2',
        worldClass: WorldClass.J,
        sides: {
            I: { maxPopulation: 4, techField: TechField.Physics, techValue: 3, cash: 4 },
            II: { maxPopulation: 8, techField: TechField.Physics, techValue: 4, cash: 8 }
        }
    },
    {
        id: 'j-3',
        worldClass: WorldClass.J,
        sides: {
            I: { maxPopulation: 4, techField: TechField.Physics, techValue: 3, cash: 4 },
            II: { maxPopulation: 8, techField: TechField.Physics, techValue: 4, cash: 8 }
        }
    },
    {
        id: 'j-4',
        worldClass: WorldClass.J,
        sides: {
            I: { maxPopulation: 4, techField: TechField.Physics, techValue: 3, cash: 4 },
            II: { maxPopulation: 8, techField: TechField.Physics, techValue: 4, cash: 8 }
        }
    },
    {
        id: 'j-5',
        worldClass: WorldClass.J,
        sides: {
            I: { maxPopulation: 1, techField: TechField.Physics, techValue: 1, cash: 1 },
            II: { maxPopulation: 3, techField: TechField.Physics, techValue: 2, cash: 3 }
        }
    },
    {
        id: 'j-6',
        worldClass: WorldClass.J,
        sides: {
            I: { maxPopulation: 1, techField: TechField.Physics, techValue: 1, cash: 1 },
            II: { maxPopulation: 3, techField: TechField.Physics, techValue: 2, cash: 3 }
        }
    },
    {
        id: 'j-7',
        worldClass: WorldClass.J,
        sides: {
            I: { maxPopulation: 1, techField: TechField.Physics, techValue: 1, cash: 2 },
            II: { maxPopulation: 3, techField: TechField.Physics, techValue: 2, cash: 5 }
        }
    },
    {
        id: 'j-8',
        worldClass: WorldClass.J,
        sides: {
            I: { maxPopulation: 1, techField: TechField.Physics, techValue: 1, cash: 2 },
            II: { maxPopulation: 3, techField: TechField.Physics, techValue: 2, cash: 5 }
        }
    },
    {
        id: 'j-9',
        worldClass: WorldClass.J,
        sides: {
            I: { maxPopulation: 10, techField: TechField.Physics, techValue: 3, cash: 8 },
            II: { maxPopulation: 12, techField: TechField.Physics, techValue: 3, cash: 9 }
        }
    },
    {
        id: 'j-10',
        worldClass: WorldClass.J,
        sides: {
            I: { maxPopulation: 2, techField: TechField.Physics, techValue: 2, cash: 2 },
            II: { maxPopulation: 4, techField: TechField.Physics, techValue: 2, cash: 4 }
        }
    },
    {
        id: 'j-11',
        worldClass: WorldClass.J,
        sides: {
            I: { maxPopulation: 2, techField: TechField.Physics, techValue: 2, cash: 2 },
            II: { maxPopulation: 4, techField: TechField.Physics, techValue: 2, cash: 4 }
        }
    },
    {
        id: 'j-12',
        worldClass: WorldClass.J,
        sides: {
            I: { maxPopulation: 2, techField: TechField.Physics, techValue: 2, cash: 2 },
            II: { maxPopulation: 4, techField: TechField.Physics, techValue: 3, cash: 4 }
        }
    },
    {
        id: 'j-13',
        worldClass: WorldClass.J,
        sides: {
            I: { maxPopulation: 2, techField: TechField.Physics, techValue: 2, cash: 2 },
            II: { maxPopulation: 4, techField: TechField.Physics, techValue: 2, cash: 4 }
        }
    },
    {
        id: 'j-14',
        worldClass: WorldClass.J,
        sides: {
            I: { maxPopulation: 3, techField: TechField.Physics, techValue: 2, cash: 2 },
            II: { maxPopulation: 6, techField: TechField.Physics, techValue: 3, cash: 4 }
        }
    },
    {
        id: 'j-15',
        worldClass: WorldClass.J,
        sides: {
            I: { maxPopulation: 3, techField: TechField.Physics, techValue: 2, cash: 2 },
            II: { maxPopulation: 6, techField: TechField.Physics, techValue: 3, cash: 4 }
        }
    },
    {
        id: 'j-16',
        worldClass: WorldClass.J,
        sides: {
            I: { maxPopulation: 3, techField: TechField.Physics, techValue: 2, cash: 3 },
            II: { maxPopulation: 6, techField: TechField.Physics, techValue: 3, cash: 6 }
        }
    },
    {
        id: 'j-17',
        worldClass: WorldClass.J,
        sides: {
            I: { maxPopulation: 3, techField: TechField.Physics, techValue: 2, cash: 3 },
            II: { maxPopulation: 6, techField: TechField.Physics, techValue: 3, cash: 6 }
        }
    },
    {
        id: 'j-18',
        worldClass: WorldClass.J,
        sides: {
            I: { maxPopulation: 4, techField: TechField.Physics, techValue: 3, cash: 3 },
            II: { maxPopulation: 6, techField: TechField.Physics, techValue: 3, cash: 6 }
        }
    },
    {
        id: 'j-19',
        worldClass: WorldClass.J,
        sides: {
            I: { maxPopulation: 4, techField: TechField.Physics, techValue: 3, cash: 3 },
            II: { maxPopulation: 6, techField: TechField.Physics, techValue: 3, cash: 6 }
        }
    },
    {
        id: 'j-20',
        worldClass: WorldClass.J,
        sides: {
            I: { maxPopulation: 8, techField: TechField.Physics, techValue: 2, cash: 7 },
            II: { maxPopulation: 10, techField: TechField.Physics, techValue: 2, cash: 8 }
        }
    },
    {
        id: 'd-1',
        worldClass: WorldClass.D,
        sides: {
            I: { maxPopulation: 1, techField: TechField.Engineering, techValue: 1, cash: 4 },
            II: { maxPopulation: 3, techField: TechField.Engineering, techValue: 1, cash: 5 }
        }
    },
    {
        id: 'd-2',
        worldClass: WorldClass.D,
        sides: {
            I: { maxPopulation: 1, techField: TechField.Engineering, techValue: 2, cash: 4 },
            II: { maxPopulation: 3, techField: TechField.Engineering, techValue: 2, cash: 5 }
        }
    },
    {
        id: 'd-3',
        worldClass: WorldClass.D,
        sides: {
            I: { maxPopulation: 2, techField: TechField.Engineering, techValue: 2, cash: 5 },
            II: { maxPopulation: 4, techField: TechField.Engineering, techValue: 2, cash: 6 }
        }
    },
    {
        id: 'd-4',
        worldClass: WorldClass.D,
        sides: {
            I: { maxPopulation: 2, techField: TechField.Engineering, techValue: 3, cash: 5 },
            II: { maxPopulation: 3, techField: TechField.Engineering, techValue: 3, cash: 6 }
        }
    },
    {
        id: 'd-5',
        worldClass: WorldClass.D,
        sides: {
            I: { maxPopulation: 2, techField: TechField.Engineering, techValue: 3, cash: 5 },
            II: { maxPopulation: 3, techField: TechField.Engineering, techValue: 3, cash: 6 }
        }
    },
    {
        id: 'd-6',
        worldClass: WorldClass.D,
        sides: {
            I: { maxPopulation: 2, techField: TechField.Engineering, techValue: 3, cash: 6 },
            II: { maxPopulation: 3, techField: TechField.Engineering, techValue: 3, cash: 7 }
        }
    },
    {
        id: 'd-7',
        worldClass: WorldClass.D,
        sides: {
            I: { maxPopulation: 2, techField: TechField.Engineering, techValue: 3, cash: 6 },
            II: { maxPopulation: 3, techField: TechField.Engineering, techValue: 3, cash: 7 }
        }
    },
    {
        id: 'd-8',
        worldClass: WorldClass.D,
        sides: {
            I: { maxPopulation: 2, techField: TechField.Engineering, techValue: 4, cash: 6 },
            II: { maxPopulation: 3, techField: TechField.Engineering, techValue: 4, cash: 7 }
        }
    },
    {
        id: 'd-9',
        worldClass: WorldClass.D,
        sides: {
            I: { maxPopulation: 3, techField: TechField.Engineering, techValue: 2, cash: 7 },
            II: { maxPopulation: 5, techField: TechField.Engineering, techValue: 2, cash: 8 }
        }
    },
    {
        id: 'd-10',
        worldClass: WorldClass.D,
        sides: {
            I: { maxPopulation: 3, techField: TechField.Engineering, techValue: 2, cash: 7 },
            II: { maxPopulation: 5, techField: TechField.Engineering, techValue: 2, cash: 8 }
        }
    },
    {
        id: 'd-11',
        worldClass: WorldClass.D,
        sides: {
            I: { maxPopulation: 3, techField: TechField.Engineering, techValue: 3, cash: 8 },
            II: { maxPopulation: 5, techField: TechField.Engineering, techValue: 3, cash: 9 }
        }
    },
    {
        id: 'd-12',
        worldClass: WorldClass.D,
        sides: {
            I: { maxPopulation: 3, techField: TechField.Engineering, techValue: 4, cash: 8 },
            II: { maxPopulation: 5, techField: TechField.Engineering, techValue: 4, cash: 9 }
        }
    },
    {
        id: 'e-1',
        worldClass: WorldClass.E,
        sides: {
            I: { maxPopulation: 10, techField: TechField.Biology, techValue: 2, cash: 4 },
            II: { maxPopulation: 15, techField: TechField.Biology, techValue: 2, cash: 5 }
        }
    },
    {
        id: 'e-2',
        worldClass: WorldClass.E,
        sides: {
            I: { maxPopulation: 10, techField: TechField.Biology, techValue: 2, cash: 4 },
            II: { maxPopulation: 15, techField: TechField.Biology, techValue: 2, cash: 5 }
        }
    },
    {
        id: 'e-3',
        worldClass: WorldClass.E,
        sides: {
            I: { maxPopulation: 12, techField: TechField.Biology, techValue: 3, cash: 5 },
            II: { maxPopulation: 20, techField: TechField.Biology, techValue: 4, cash: 6 }
        }
    },
    {
        id: 'e-4',
        worldClass: WorldClass.E,
        sides: {
            I: { maxPopulation: 12, techField: TechField.Biology, techValue: 3, cash: 5 },
            II: { maxPopulation: 20, techField: TechField.Biology, techValue: 4, cash: 6 }
        }
    },
    {
        id: 'e-5',
        worldClass: WorldClass.E,
        sides: {
            I: { maxPopulation: 14, techField: TechField.Biology, techValue: 2, cash: 5 },
            II: { maxPopulation: 21, techField: TechField.Biology, techValue: 3, cash: 6 }
        }
    },
    {
        id: 'e-6',
        worldClass: WorldClass.E,
        sides: {
            I: { maxPopulation: 16, techField: TechField.Biology, techValue: 3, cash: 6 },
            II: { maxPopulation: 25, techField: TechField.Biology, techValue: 3, cash: 7 }
        }
    },
    {
        id: 'e-7',
        worldClass: WorldClass.E,
        sides: {
            I: { maxPopulation: 8, techField: TechField.Biology, techValue: 2, cash: 4 },
            II: { maxPopulation: 12, techField: TechField.Biology, techValue: 3, cash: 4 }
        }
    },
    { id: 'none-1', worldClass: WorldClass.None },
    { id: 'none-2', worldClass: WorldClass.None },
    { id: 'none-3', worldClass: WorldClass.None },
    { id: 'none-4', worldClass: WorldClass.None },
    { id: 'none-5', worldClass: WorldClass.None },
    { id: 'none-6', worldClass: WorldClass.None },
    { id: 'none-7', worldClass: WorldClass.None },
    { id: 'none-8', worldClass: WorldClass.None },
    { id: 'none-9', worldClass: WorldClass.None },
    { id: 'none-10', worldClass: WorldClass.None },
    { id: 'none-11', worldClass: WorldClass.None }
]
