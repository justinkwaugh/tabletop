import fnv from 'fnv-plus'
import { GameAction } from '../game/engine/gameAction'

export function calculateChecksum(checksum: number, actions: GameAction[]): number {
    for (const action of actions) {
        checksum ^= fnv.fast1a52(`${action.id}:${action.index}`)
    }
    return checksum
}
