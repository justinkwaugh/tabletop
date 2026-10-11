import { TechField } from '../components/techFields.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'

export const TECH_MARKER_VALUES: readonly number[] = [1, 2, 3, 4, 5]
export const TECH_MARKERS_PER_VALUE = 13

export function fullTechPool(): number[] {
    return TECH_MARKER_VALUES.map(() => TECH_MARKERS_PER_VALUE)
}

export function drawTechMarkers(
    state: HydratedStellarHorizonsGameState,
    field: TechField,
    count: number
): number[] {
    const pool = state.techPools[field]
    const random = state.getProtectedPrng()
    const drawn: number[] = []
    for (let draw = 0; draw < count; draw++) {
        const remaining = pool.reduce((total, markers) => total + markers, 0)
        if (remaining === 0) {
            break
        }
        let pick = random.randInt(remaining)
        const index = pool.findIndex((markers) => {
            if (pick < markers) {
                return true
            }
            pick -= markers
            return false
        })
        pool[index] -= 1
        drawn.push(TECH_MARKER_VALUES[index])
    }
    return drawn
}

export const EMPTY_POOL_CASH = 1

export interface TechMarkerAward {
    markers: number[]
    cash: number
}

// A marker that cannot be drawn because its pool is empty is paid as cash instead.
export function awardTechMarkers(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    field: TechField,
    count: number
): TechMarkerAward {
    const player = state.getPlayerState(playerId)
    const markers = drawTechMarkers(state, field, count)
    const cash = (count - markers.length) * EMPTY_POOL_CASH
    player.techMarkers[field].push(...markers)
    player.cash += cash
    return { markers, cash }
}

export function returnTechMarkers(
    state: HydratedStellarHorizonsGameState,
    field: TechField,
    values: readonly number[]
) {
    for (const value of values) {
        state.techPools[field][TECH_MARKER_VALUES.indexOf(value)] += 1
    }
}

export function drawWorldTile(
    state: HydratedStellarHorizonsGameState,
    accepts: (tileId: string) => boolean
): string | undefined {
    const candidates = state.worldPool.filter(accepts)
    if (candidates.length === 0) {
        return undefined
    }
    const tileId = candidates[state.getProtectedPrng().randInt(candidates.length)]
    state.worldPool.splice(state.worldPool.indexOf(tileId), 1)
    return tileId
}

export function returnWorldTile(state: HydratedStellarHorizonsGameState, tileId: string) {
    state.worldPool.push(tileId)
}
