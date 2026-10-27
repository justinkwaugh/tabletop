import type { Step } from '../rules.js'
import type { ResourceAmounts } from '../resources.js'

export enum MapId {
    Germany = 'germany'
}

export type Region = { id: string; name: string }

export type City = { id: string; name: string; region: string }

export type Connection = { a: string; b: string; cost: number }

/** Resources added in Phase 5, by player count and step, as printed on the map's refill cards. */
export type ResupplyTable = Record<number, Record<Step, ResourceAmounts>>

export type MapRules = {
    resupply: ResupplyTable
    /** Once a player buys this plant at auction, uranium is no longer resupplied. */
    nuclearPhaseOutPlant?: number
}

export type GameMap = {
    id: MapId
    name: string
    regions: readonly Region[]
    cities: readonly City[]
    connections: readonly Connection[]
    rules: MapRules
}
