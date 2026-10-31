import type { GameAction } from '@tabletop/common'
import {
    MachineState,
    RAILROADS,
    tradesLeft,
    turnPlayerId,
    type HydratedPromontoryPointGameState,
    type RailroadId
} from '@tabletop/promontory-point'
import {
    describeAction,
    player,
    railroad,
    text,
    type DescriptionPart
} from '$lib/utils/actionDescription.js'
import { sharesLabel } from './turnPanel.js'

export type LastAction = { playerId: string; parts: DescriptionPart[] }

export type WaitingView = {
    // The step being decided, e.g. "Repairs on Southern Pacific."
    lead?: string
    // Who decides and what, with seats and railroads as parts.
    parts: DescriptionPart[]
    last?: LastAction
}

// Contract, "Watching": who decides and what, then what the last action did, read from the
// displayed state and the actions behind it. A seat's staged choices never reach it.
export function waitingView(
    state: HydratedPromontoryPointGameState,
    actions: readonly GameAction[],
    viewerId: string | undefined
): WaitingView | undefined {
    const deciding = deciderParts(state, viewerId)
    if (deciding === undefined) {
        return undefined
    }
    const last = lastAction(actions, viewerId)
    return last === undefined ? deciding : { ...deciding, last }
}

// A seat as the subject of a sentence: the viewer reads "You" and the second-person verb.
type Subject = { part: DescriptionPart; you: boolean }

function subject(playerId: string, viewerId: string | undefined): Subject {
    return playerId === viewerId
        ? { part: text('You'), you: true }
        : { part: player(playerId), you: false }
}

function verb(who: Subject, thirdPerson: string, secondPerson: string): string {
    return who.you ? secondPerson : thirdPerson
}

function deciderParts(
    state: HydratedPromontoryPointGameState,
    viewerId: string | undefined
): Omit<WaitingView, 'last'> | undefined {
    switch (state.machineState) {
        case MachineState.PayingRepairs:
            return repairsDecision(state, viewerId)
        case MachineState.TradingBeforePlacing:
        case MachineState.Placing:
        case MachineState.TradingAfterPlacing:
            return turnDecision(state, subject(turnPlayerId(state), viewerId))
        default:
            return undefined
    }
}

// R-4.3, R-4.3-H2, R-4.3-H4: the first short seat sells while the turn waits.
function repairsDecision(
    state: HydratedPromontoryPointGameState,
    viewerId: string | undefined
): Omit<WaitingView, 'last'> | undefined {
    const pending = state.pendingRepairs
    const debtor = pending?.debtors[0]
    if (pending === undefined || debtor === undefined) {
        return undefined
    }
    const money = state.getPlayerState(debtor.playerId).money
    const bills = pending.debtors.length > 1 ? 'the bills are paid' : 'the bill is paid'
    const deciding = subject(debtor.playerId, viewerId)
    const turnPlayer = turnPlayerId(state)
    const whoseTurn = turnPlayer === viewerId ? [text('Your')] : [player(turnPlayer), text("'s")]
    return {
        lead: `Repairs on ${RAILROADS[pending.railroadId].name}.`,
        parts: [
            deciding.part,
            text(
                ` ${verb(deciding, 'owes', 'owe')} $${debtor.owed} and ${verb(deciding, 'has', 'have')} $${money}, and ${verb(deciding, 'is', 'are')} choosing shares to sell at half price. `
            ),
            ...whoseTurn,
            text(` turn continues once ${bills}.`)
        ]
    }
}

// R-2.2, R-2.2-H1, R-3.3: the turn player trades, places or ends its turn.
function turnDecision(
    state: HydratedPromontoryPointGameState,
    who: Subject
): Omit<WaitingView, 'last'> {
    const turn = state.turn
    const is = verb(who, 'is', 'are')
    if (turn === undefined) {
        return { parts: [who.part, text(` ${is} taking a turn.`)] }
    }
    const sharesLeft = tradesLeft(turn)
    const trades = sharesLabel(sharesLeft)
    const placements = turn.placementsMade + turn.placementsLeft
    const has = verb(who, 'has', 'have')
    switch (state.machineState) {
        case MachineState.Placing:
            return {
                parts: [
                    who.part,
                    text(` ${is} placing piece ${turn.placementsMade + 1} of ${placements}`),
                    ...pieceList(turn.pieces, ' left'),
                    text('.')
                ]
            }
        case MachineState.TradingAfterPlacing:
            return {
                parts: [
                    who.part,
                    text(
                        sharesLeft > 0
                            ? ` ${has} placed every piece and may buy or sell up to ${trades} before ending the turn.`
                            : ` ${has} placed every piece and ${is} ending the turn.`
                    )
                ]
            }
        default:
            return {
                parts: [
                    who.part,
                    text(
                        sharesLeft > 0
                            ? ` may buy or sell up to ${trades}, then place ${placements} pieces`
                            : ` ${is} placing ${placements} pieces`
                    ),
                    ...pieceList(turn.pieces, ''),
                    text('.')
                ]
            }
    }
}

// R-2.2 step 1: the turn pieces are face up for every seat.
function pieceList(pieces: readonly RailroadId[], suffix: string): DescriptionPart[] {
    if (pieces.length === 0) {
        return []
    }
    const tags = pieces.flatMap((railroadId, index) =>
        index === 0 ? [railroad(railroadId)] : [text(', '), railroad(railroadId)]
    )
    return [text(' ('), ...tags, text(`${suffix})`)]
}

// The latest action a seat can read, as the history line describes it.
function lastAction(
    actions: readonly GameAction[],
    viewerId: string | undefined
): LastAction | undefined {
    for (const action of actions.toReversed()) {
        const parts = describeAction(action, viewerId)
        if (parts !== undefined && action.playerId !== undefined) {
            return { playerId: action.playerId, parts }
        }
    }
    return undefined
}
