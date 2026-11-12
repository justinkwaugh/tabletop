import { ActionSource, type GameAction } from '@tabletop/common'
import {
    ActionType,
    Bonus,
    Contract,
    contractDefinition,
    MachineState,
    newAuction,
    Side,
    Suit,
    type Auction
} from '@tabletop/koenigrufen'
import { describe, expect, it } from 'vitest'
import { panelFacts, type PanelTable } from './panelFacts.js'

const names = { name: (playerId: string) => playerId.toUpperCase() }
const base = { id: 'x', gameId: 'g', source: ActionSource.User }
const deal = { ...base, type: ActionType.DealHand }

function announce(playerId: string, side: Side, extra: object = {}) {
    return {
        ...base,
        playerId,
        type: ActionType.Announce,
        bonuses: [Bonus.Pagat],
        doubles: [],
        metadata: { side, doubleLevels: [] },
        ...extra
    }
}

// a deals, b is Forehand; c declares unless the auction is still on.
function table({
    machineState = MachineState.Playing,
    auction = newAuction(),
    contract = Contract.Rufer,
    declared = true,
    calledKingPlayedBy,
    kingInTalon = false,
    mySide = Side.Defenders
}: {
    machineState?: MachineState
    auction?: Auction
    contract?: Contract
    declared?: boolean
    calledKingPlayedBy?: string
    kingInTalon?: boolean
    mySide?: Side
}): PanelTable {
    return {
        dealerId: 'a',
        machineState,
        auction,
        contract: declared ? { contract, declarerId: 'c', calledKing: Suit.Hearts } : undefined,
        calledKingPlayedBy,
        forehandId: () => 'b',
        contractDefinition: () => contractDefinition(contract),
        isCalledKingInTalon: () => kingInTalon,
        sideOf: () => mySide
    }
}

function standings(panel: PanelTable, actions: GameAction[] = [], myId = 'd') {
    return ['a', 'b', 'c', 'd'].map(
        (playerId) => panelFacts(panel, [deal, ...actions], playerId, myId, names).standing
    )
}

describe('player panel facts', () => {
    it('names the dealer and Forehand', () => {
        const facts = (playerId: string) =>
            panelFacts(table({}), [], playerId, 'd', names).seatRoles
        expect(facts('a')).toEqual(['Dealer'])
        expect(facts('b')).toEqual(['Forehand'])
        expect(facts('c')).toEqual([])
    })

    it('shows the auction: the bid held, passes, and Mein Spiel', () => {
        const bidding = table({
            machineState: MachineState.Bidding,
            declared: false,
            auction: {
                meinSpiel: false,
                bid: { playerId: 'c', contract: Contract.Dreier },
                passed: ['d']
            }
        })
        expect(standings(bidding)).toEqual([undefined, undefined, 'Bids Dreier', 'Passed'])
        const reserved = table({
            machineState: MachineState.Bidding,
            declared: false,
            auction: { meinSpiel: true, passed: [] }
        })
        expect(standings(reserved)[1]).toBe('Mein Spiel')
    })

    it('names everyone’s side when declarer plays alone', () => {
        expect(standings(table({ contract: Contract.Dreier }))).toEqual([
            'Defender',
            'Defender',
            'Declarer · Dreier',
            'Defender'
        ])
    })

    it('keeps sides hidden while the partner is secret, except my own', () => {
        expect(standings(table({}))).toEqual([undefined, undefined, 'Declarer · Rufer', 'Defender'])
        expect(standings(table({ mySide: Side.Declarer }))[3]).toBe('Secret partner')
    })

    it('shows a side once an announcement or the called King gives it away', () => {
        expect(standings(table({}), [announce('a', Side.Defenders)])[0]).toBe('Defender')
        expect(standings(table({}), [announce('b', Side.Declarer)])[1]).toBe('Partner')
        expect(standings(table({ calledKingPlayedBy: 'b' }))).toEqual([
            'Defender',
            'Partner',
            'Declarer · Rufer',
            'Defender'
        ])
    })

    it('forgets the last hand’s announcements', () => {
        const facts = panelFacts(table({}), [announce('a', Side.Defenders), deal], 'a', 'd', names)
        expect(facts.standing).toBeUndefined()
        expect(facts.said).toEqual([])
    })

    it('lists what a player announced this hand', () => {
        const kontra = announce('a', Side.Defenders, {
            bonuses: [],
            doubles: [{ kind: 'game' }],
            metadata: { side: Side.Defenders, doubleLevels: [1] }
        })
        const facts = panelFacts(
            table({}),
            [deal, announce('a', Side.Defenders), kontra],
            'a',
            'd',
            names
        )
        expect(facts.said).toEqual(['Pagat', 'Kontra on the game'])
    })

    it('gives no sides in Trischaken', () => {
        expect(standings(table({ contract: Contract.Trischaken }))).toEqual([
            undefined,
            undefined,
            'Declarer · Trischaken',
            undefined
        ])
    })
})
