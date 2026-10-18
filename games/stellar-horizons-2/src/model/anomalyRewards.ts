import * as Type from 'typebox'
import { AnomalyBackKind, anomalyDefinition, type AnomalyReward } from '../components/anomalies.js'
import { STAR_MAP } from '../components/starMap.js'
import { SOL_SYSTEM_ID, starSystemDefinition } from '../components/systems.js'
import { WorldSide } from '../components/worlds.js'
import { gainInfluence } from './campaign.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import { awardTechMarkers, drawWorldTile } from './pools.js'
import { canStartInSystem } from './surveys.js'

export type GrantedReward = Type.Static<typeof GrantedReward>
export const GrantedReward = Type.Object({
    playerId: Type.String(),
    influence: Type.Number(),
    cash: Type.Number(),
    markers: Type.Array(Type.Number()),
    emptyPoolCash: Type.Number(),
    settlements: Type.Number(),
    notYet: Type.Array(Type.String())
})

export type TurnedOver = Type.Static<typeof TurnedOver>
export const TurnedOver = Type.Object({
    back: Type.Enum(AnomalyBackKind),
    worlds: Type.Array(Type.Object({ systemId: Type.String(), tileId: Type.String() }))
})

// Rulebook 1.16: the front's reward goes to whoever resolves the anomaly. Trade goods and cards
// wait for slices 3 and 4 of the campaign plan; settlements are placed by the Player afterwards.
export function grantReward(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    reward: AnomalyReward
): GrantedReward {
    const player = state.getPlayerState(playerId)
    const influence = reward.influence ?? 0
    const cash = reward.cash ?? 0
    gainInfluence(state, playerId, influence)
    player.cash += cash
    const award = reward.markers
        ? awardTechMarkers(state, playerId, reward.markers.field, reward.markers.count)
        : { markers: [], cash: 0 }
    const notYet = [
        ...(reward.goods ? [`${reward.goods.count} ${reward.goods.good}`] : []),
        ...(reward.card ? [`a level I ${reward.card} card`] : [])
    ]
    return {
        playerId,
        influence,
        cash,
        markers: award.markers,
        emptyPoolCash: award.cash,
        settlements: reward.settlements ?? 0,
        notYet
    }
}

// The resolved tile is turned over: its back either stays in the system, removes it from the
// game, or (Stellar Chart) draws a world for this and each adjacent system with an empty slot,
// as if surveyed, and then leaves.
export function turnOver(state: HydratedStellarHorizonsGameState, systemId: string): TurnedOver {
    const system = state.systemState(systemId)
    const anomalyId = system.anomaly
    if (anomalyId === undefined) {
        return { back: AnomalyBackKind.Remove, worlds: [] }
    }
    const back = anomalyDefinition(anomalyId).back
    if (back.kind === AnomalyBackKind.Bases) {
        system.anomalyResolved = true
        return { back: back.kind, worlds: [] }
    }
    system.anomaly = undefined
    const worlds =
        back.kind === AnomalyBackKind.StellarChart
            ? [systemId, ...STAR_MAP.adjacentSystemIds(systemId)].flatMap((candidate) => {
                  const tileId = drawIntoEmptySlot(state, candidate)
                  return tileId === undefined ? [] : [{ systemId: candidate, tileId }]
              })
            : []
    return { back: back.kind, worlds }
}

function drawIntoEmptySlot(
    state: HydratedStellarHorizonsGameState,
    systemId: string
): string | undefined {
    if (!state.isSystemInPlay(systemId) || systemId === SOL_SYSTEM_ID) {
        return undefined
    }
    const system = state.systemState(systemId)
    if (system.worlds.length >= starSystemDefinition(systemId).worldSlots) {
        return undefined
    }
    const tileId = drawWorldTile(state, (candidate) => canStartInSystem(systemId, candidate))
    if (tileId !== undefined) {
        system.worlds.push({ tileId, side: WorldSide.I })
    }
    return tileId
}
