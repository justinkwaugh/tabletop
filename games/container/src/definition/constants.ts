import { ContainerColor } from '../model/container.js'
import { type ContainerValueCard } from '../model/valueCard.js'

export const CONTAINER_COLORS: ContainerColor[] = [
    ContainerColor.Purple,
    ContainerColor.Brown,
    ContainerColor.Blue,
    ContainerColor.Red,
    ContainerColor.Green
]

export const SUPPLY_BY_PLAYER_COUNT: Record<3 | 4 | 5, {
    containersPerColor: number
    machinesPerColor: number
    warehouses: number
}> = {
    3: { containersPerColor: 10, machinesPerColor: 2, warehouses: 12 },
    4: { containersPerColor: 13, machinesPerColor: 3, warehouses: 16 },
    5: { containersPerColor: 16, machinesPerColor: 4, warehouses: 20 }
}

export const DEFAULT_MACHINE_COSTS = [6, 9, 12]
export const DEFAULT_WAREHOUSE_COSTS = [4, 5, 6, 7]

export const LOAN_AMOUNT = 10
export const INTEREST_AMOUNT = 1
export const MAX_LOANS = 2
export const STARTING_MONEY = 20
export const SHIP_CAPACITY = 5

// Container Value Cards are not fully specified in the rules text; update if actual values differ.
export const DEFAULT_VALUE_CARDS: ContainerValueCard[] = [
    {
        specialColor: ContainerColor.Purple,
        values: {
            [ContainerColor.Purple]: 5,
            [ContainerColor.Brown]: 4,
            [ContainerColor.Blue]: 3,
            [ContainerColor.Red]: 2,
            [ContainerColor.Green]: 1
        },
        specialValueIfComplete: 10,
        specialValueIfIncomplete: 5
    },
    {
        specialColor: ContainerColor.Brown,
        values: {
            [ContainerColor.Purple]: 1,
            [ContainerColor.Brown]: 5,
            [ContainerColor.Blue]: 4,
            [ContainerColor.Red]: 3,
            [ContainerColor.Green]: 2
        },
        specialValueIfComplete: 10,
        specialValueIfIncomplete: 5
    },
    {
        specialColor: ContainerColor.Blue,
        values: {
            [ContainerColor.Purple]: 2,
            [ContainerColor.Brown]: 1,
            [ContainerColor.Blue]: 5,
            [ContainerColor.Red]: 4,
            [ContainerColor.Green]: 3
        },
        specialValueIfComplete: 10,
        specialValueIfIncomplete: 5
    },
    {
        specialColor: ContainerColor.Red,
        values: {
            [ContainerColor.Purple]: 3,
            [ContainerColor.Brown]: 2,
            [ContainerColor.Blue]: 1,
            [ContainerColor.Red]: 5,
            [ContainerColor.Green]: 4
        },
        specialValueIfComplete: 10,
        specialValueIfIncomplete: 5
    },
    {
        specialColor: ContainerColor.Green,
        values: {
            [ContainerColor.Purple]: 4,
            [ContainerColor.Brown]: 3,
            [ContainerColor.Blue]: 2,
            [ContainerColor.Red]: 1,
            [ContainerColor.Green]: 5
        },
        specialValueIfComplete: 10,
        specialValueIfIncomplete: 5
    }
]
