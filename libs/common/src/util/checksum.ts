import fnv from 'fnv-plus'
import { GameAction } from '../game/engine/gameAction.js'

export function calculateActionChecksum(checksum: number, actions: GameAction[]): number {
    for (const action of actions) {
        checksum ^= fnv.fast1a52(`${action.id}:${action.index}`)
    }
    return checksum
}

export function addToChecksum(checksum: number, values: string[]): number {
    for (const value of values) {
        checksum ^= fnv.fast1a52(value)
    }
    return checksum
}
