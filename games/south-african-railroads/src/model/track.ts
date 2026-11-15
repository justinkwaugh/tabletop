import type { SarMap } from '../maps/maps.js'
import type { ExternalConnectionDefinition, LinkDefinition, RailroadId } from '../maps/types.js'
import type { BuiltConnection, BuiltLink } from './railroadState.js'

export const LINK_COST = 5
export const DOUBLE_LINK_COST = 15
export const LINK_VALUE = 5

export type TrackState = {
    map: SarMap
    track: readonly BuiltLink[]
    connections: readonly BuiltConnection[]
    dividendsPaid: number
}

export type DoubleBuild = readonly [string, string]

export function railroadLinkIds(state: TrackState, railroadId: RailroadId): string[] {
    return state.track
        .filter((built) => built.railroadId === railroadId)
        .map((built) => built.linkId)
}

export function railroadConnectionIds(state: TrackState, railroadId: RailroadId): string[] {
    return state.connections
        .filter((built) => built.railroadId === railroadId)
        .map((built) => built.connectionId)
}

export function railroadSettlements(state: TrackState, railroadId: RailroadId): Set<string> {
    return new Set(
        railroadLinkIds(state, railroadId).flatMap((linkId) => state.map.link(linkId).ends)
    )
}

export function isLinkBuilt(state: TrackState, linkId: string): boolean {
    return state.track.some((built) => built.linkId === linkId)
}

export function isSettlementConnected(state: TrackState, settlementId: string): boolean {
    return state.track.some((built) => state.map.link(built.linkId).ends.includes(settlementId))
}

export function linkOwner(state: TrackState, linkId: string): RailroadId | undefined {
    return state.track.find((built) => built.linkId === linkId)?.railroadId
}

// Unbuilt, and not across a border that is still closed.
function isLinkAvailable(state: TrackState, trackLink: LinkDefinition): boolean {
    return (
        !isLinkBuilt(state, trackLink.id) &&
        state.dividendsPaid >= state.map.linkOpensAfterDividend(trackLink.id)
    )
}

export function singleBuilds(state: TrackState, railroadId: RailroadId): string[] {
    const network = railroadSettlements(state, railroadId)
    return state.map.links
        .filter(
            (candidate) =>
                isLinkAvailable(state, candidate) &&
                candidate.ends.some(
                    (end) => network.has(end) && state.map.isOneWayFrom(candidate, end)
                )
        )
        .map((candidate) => candidate.id)
}

// Two consecutive links into settlements the railroad has not reached, never passing through
// the map's barrier settlement.
export function doubleBuilds(state: TrackState, railroadId: RailroadId): DoubleBuild[] {
    const network = railroadSettlements(state, railroadId)
    const builds: DoubleBuild[] = []
    for (const firstId of singleBuilds(state, railroadId)) {
        const first = state.map.link(firstId)
        for (const middle of first.ends) {
            if (network.has(middle) || middle === state.map.definition.doubleBuildBarrierId) {
                continue
            }
            for (const second of state.map.links) {
                const end = second.ends.includes(middle)
                    ? state.map.otherEnd(second, middle)
                    : undefined
                if (
                    end !== undefined &&
                    second.id !== firstId &&
                    isLinkAvailable(state, second) &&
                    state.map.isOneWayFrom(second, middle) &&
                    !network.has(end)
                ) {
                    builds.push([firstId, second.id])
                }
            }
        }
    }
    return builds
}

export function isDoubleBuild(
    state: TrackState,
    railroadId: RailroadId,
    linkIds: readonly string[]
): boolean {
    return doubleBuilds(state, railroadId).some(
        ([first, second]) => first === linkIds[0] && second === linkIds[1]
    )
}

export function connectionBuilds(
    state: TrackState,
    railroadId: RailroadId
): ExternalConnectionDefinition[] {
    const network = railroadSettlements(state, railroadId)
    return state.map.externalConnections.filter(
        (connection) =>
            network.has(connection.settlementId) &&
            !state.connections.some((built) => built.connectionId === connection.id)
    )
}

export function homeLinks(state: TrackState, settlementId: string): string[] {
    return state.map.links
        .filter(
            (candidate) =>
                candidate.ends.includes(settlementId) &&
                isLinkAvailable(state, candidate) &&
                state.map.isOneWayFrom(candidate, settlementId)
        )
        .map((candidate) => candidate.id)
}

export function trackValue(state: TrackState, railroadId: RailroadId): number {
    return (
        railroadLinkIds(state, railroadId).length * LINK_VALUE +
        railroadConnectionIds(state, railroadId).reduce(
            (sum, connectionId) => sum + state.map.externalConnection(connectionId).value,
            0
        )
    )
}
