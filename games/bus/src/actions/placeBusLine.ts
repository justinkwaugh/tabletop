import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedBusGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import {
    applyBusLineSegment,
    isBusNodeId,
    isValidBusLineSegmentPlacement,
    type BusLineSegment
} from '../utils/busLineRules.js'
import type { BusNodeId } from '../utils/busGraph.js'

export type PlaceBusLineMetadata = Type.Static<typeof PlaceBusLineMetadata>
export const PlaceBusLineMetadata = Type.Object({})

export type PlaceBusLine = Type.Static<typeof PlaceBusLine>
export const PlaceBusLine = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']), // Omit playerId to redefine it
        Type.Object({
            type: Type.Literal(ActionType.PlaceBusLine), // This action is always this type
            playerId: Type.String(), // Required now
            metadata: Type.Optional(PlaceBusLineMetadata), // Always optional, because it is an output
            segment: Type.Tuple([Type.String(), Type.String()]) // The two nodes to connect with a bus segment
        })
    ])
)

export const PlaceBusLineValidator = Compile(PlaceBusLine)

export function isPlaceBusLine(action?: GameAction): action is PlaceBusLine {
    return action?.type === ActionType.PlaceBusLine
}

function asBusLineSegment(segment: [string, string]): BusLineSegment | undefined {
    const [fromNodeId, toNodeId] = segment
    if (!isBusNodeId(fromNodeId) || !isBusNodeId(toNodeId)) {
        return undefined
    }
    return [fromNodeId, toNodeId]
}

function asBusLine(nodeIds: string[]): BusNodeId[] | undefined {
    if (!nodeIds.every(isBusNodeId)) {
        return undefined
    }
    return [...nodeIds]
}

function otherPlayerBusLines(state: HydratedBusGameState, playerId: string): BusNodeId[][] {
    const otherLines: BusNodeId[][] = []
    for (const playerState of state.players) {
        if (playerState.playerId === playerId) {
            continue
        }

        const line = asBusLine(playerState.busLine)
        if (line) {
            otherLines.push(line)
        }
    }
    return otherLines
}

export class HydratedPlaceBusLine
    extends HydratableAction<typeof PlaceBusLine>
    implements PlaceBusLine
{
    declare type: ActionType.PlaceBusLine
    declare playerId: string
    declare metadata?: PlaceBusLineMetadata
    declare segment: [string, string]

    constructor(data: PlaceBusLine) {
        super(data, PlaceBusLineValidator)
    }

    apply(state: HydratedBusGameState, context?: MachineContext) {
        if (!this.isValidPlaceBusLine(state)) {
            throw Error('Invalid PlaceBusLine action')
        }

        const playerState = state.getPlayerState(this.playerId)
        const currentBusLine = asBusLine(playerState.busLine)
        const segment = asBusLineSegment(this.segment)
        if (!currentBusLine || !segment) {
            throw Error('Invalid PlaceBusLine action')
        }

        const nextBusLine = applyBusLineSegment(currentBusLine, segment)
        if (!nextBusLine) {
            throw Error('Invalid PlaceBusLine action')
        }

        playerState.busLine = nextBusLine
        playerState.sticks -= 1
        this.metadata = {}
    }

    isValidPlaceBusLine(state: HydratedBusGameState): boolean {
        const playerState = state.getPlayerState(this.playerId)
        const currentBusLine = asBusLine(playerState.busLine)
        const segment = asBusLineSegment(this.segment)
        if (!currentBusLine || !segment) {
            return false
        }

        return isValidBusLineSegmentPlacement(
            currentBusLine,
            segment,
            otherPlayerBusLines(state, this.playerId)
        )
    }

    static canPlaceBusLine(state: HydratedBusGameState, playerId: string): boolean {
        const playerState = state.getPlayerState(playerId)
        return playerState.sticks > 0
    }
}
