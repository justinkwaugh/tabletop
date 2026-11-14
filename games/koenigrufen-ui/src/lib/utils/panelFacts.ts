import type { GameAction } from '@tabletop/common'
import {
    isAnnounce,
    isDealHand,
    MachineState,
    Partnership,
    Side,
    type Auction,
    type ContractDefinition,
    type DeclaredContract
} from '@tabletop/koenigrufen'
import type { Names } from './actionDescription.js'
import { announcedItems } from './announcementText.js'
import { bidName } from './contractText.js'

// What a player panel reads from the table.
export type PanelTable = {
    readonly dealerId: string
    readonly machineState: MachineState
    readonly auction: Auction
    readonly contract?: DeclaredContract
    readonly calledKingPlayedBy?: string
    forehandId(): string
    contractDefinition(): ContractDefinition
    isCalledKingInTalon(): boolean
    sideOf(playerId: string): Side
}

export type PanelFacts = {
    // Seat roles for the whole hand: Dealer, Forehand.
    seatRoles: string[]
    // Where the player stands now: their bid in the auction, then their side once it is known.
    standing?: string
    // The bonuses and doubles they announced this hand, in order.
    said: string[]
}

export function panelFacts(
    table: PanelTable,
    actions: readonly GameAction[],
    playerId: string,
    myId: string | undefined,
    names: Names
): PanelFacts {
    const handActions = actions.slice(actions.findLastIndex((action) => isDealHand(action)) + 1)
    return {
        seatRoles: seatRoles(table, playerId),
        standing: table.contract
            ? sideStanding(table, handActions, playerId, myId)
            : auctionStanding(table, playerId),
        said: said(handActions, playerId, myId, names)
    }
}

function seatRoles(table: PanelTable, playerId: string): string[] {
    return [
        ...(table.dealerId === playerId ? ['Dealer'] : []),
        ...(table.forehandId() === playerId ? ['Forehand'] : [])
    ]
}

function auctionStanding(table: PanelTable, playerId: string): string | undefined {
    if (table.machineState !== MachineState.Bidding) {
        return undefined
    }
    const { bid, meinSpiel, passed } = table.auction
    if (passed.includes(playerId)) {
        return 'Passed'
    }
    if (bid?.playerId === playerId) {
        return `Bids ${bidName(bid)}`
    }
    if (meinSpiel && table.forehandId() === playerId && bid === undefined) {
        return 'Mein Spiel'
    }
    return undefined
}

function sideStanding(
    table: PanelTable,
    handActions: readonly GameAction[],
    playerId: string,
    myId: string | undefined
): string | undefined {
    const contract = table.contract
    if (!contract) {
        return undefined
    }
    if (contract.declarerId === playerId) {
        return `Declarer · ${bidName(contract)}`
    }
    const side = publicSide(table, handActions, playerId)
    if (side !== undefined) {
        return side === Side.Declarer ? 'Partner' : 'Defender'
    }
    if (playerId === myId && table.contractDefinition().partnership === Partnership.CallKing) {
        return table.sideOf(playerId) === Side.Declarer ? 'Secret partner' : 'Defender'
    }
    return undefined
}

// A player's side as the whole table knows it: from the contract, the called King played, or an
// announcement made for a side.
function publicSide(
    table: PanelTable,
    handActions: readonly GameAction[],
    playerId: string
): Side | undefined {
    const partnership = table.contractDefinition().partnership
    if (partnership === Partnership.Individual) {
        return undefined
    }
    if (partnership === Partnership.Alone || table.isCalledKingInTalon()) {
        return Side.Defenders
    }
    const partnerId = table.calledKingPlayedBy
    if (partnerId !== undefined && partnerId !== table.contract?.declarerId) {
        return partnerId === playerId ? Side.Declarer : Side.Defenders
    }
    return handActions
        .filter(isAnnounce)
        .findLast((action) => action.playerId === playerId && action.metadata)?.metadata?.side
}

function said(
    handActions: readonly GameAction[],
    playerId: string,
    myId: string | undefined,
    names: Names
): string[] {
    return handActions
        .filter(isAnnounce)
        .filter((action) => action.playerId === playerId)
        .flatMap((action) => announcedItems(action, names, myId))
}
