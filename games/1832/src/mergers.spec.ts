import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import { cashOwnedBy, getCompany, sharesOwned } from '@tabletop/18xx'
import { playExample, type ExamplePlay } from '@tabletop/18xx/scenarios'
import {
    EighteenThirtyTwoTileSet,
    mergerDecision,
    mergerOptions,
    mergerPhaseDue,
    takeoverPayments,
    type EighteenThirtyTwoState
} from './index.js'
import { EighteenThirtyTwoScenarios } from './scenarios/index.js'

type Play = ExamplePlay<EighteenThirtyTwoState>
const player = (playerId: string) => ({ kind: 'player' as const, playerId })

// Charleston and Savannah, ACL's and CG's homes, joined by two straight cities.
const JoiningTrack = [
    { locationId: 'T29', definitionId: '18xx:57', rotation: 0 },
    { locationId: 'U28', definitionId: '18xx:57', rotation: 0 }
] as const

function setCash(state: EighteenThirtyTwoState, playerId: string, amount: number) {
    const cash = state.cash.find(
        (entry) => entry.owner.kind === 'player' && entry.owner.playerId === playerId
    )
    assertExists(cash, 'The player has cash')
    cash.amount = amount
}

/** A phase 4 stock round whose players all pass, opening the merger phase. */
function mergerPhase(prepare: (state: EighteenThirtyTwoState) => void = () => {}): Play {
    const play = playExample(EighteenThirtyTwoScenarios, 'trading', 3, (state) => {
        state.phaseId = '4'
        state.tileInventory = EighteenThirtyTwoTileSet.createInventory(JoiningTrack)
        prepare(state)
    })
    for (let turn = 0; turn < 3; turn++) play.act('FinishStockTurn')
    return play
}

function proposer(play: Play) {
    const decision = mergerDecision(play.state)
    assertExists(decision, 'A merger decision is open')
    expect(decision.kind).toBe('propose')
    return decision.playerId
}

describe('merger phase', () => {
    it('opens after a phase 4 stock round with the players in priority order', () => {
        const play = mergerPhase()
        expect(play.state.machineState).toBe('Merging')
        const playerId = proposer(play)
        expect(play.valid(playerId)).toEqual(['ProposeMerger', 'PassMerger'])
    })

    it('does not open before the first 4-train', () => {
        const play = playExample(EighteenThirtyTwoScenarios, 'trading', 3, (state) => {
            state.tileInventory = EighteenThirtyTwoTileSet.createInventory(JoiningTrack)
        })
        for (let turn = 0; turn < 3; turn++) play.act('FinishStockTurn')
        expect(play.state.machineState).not.toBe('Merging')
        expect(play.state.mergerPhase).toBeUndefined()
    })

    it('forms a System once the partner’s president agrees', () => {
        const play = mergerPhase()
        while (proposer(play) !== 'alex') play.act('PassMerger', {}, proposer(play))
        expect(mergerOptions(play.state, 'alex')).toContainEqual({
            companyId: 'ACL',
            partnerId: 'CG',
            kind: 'system',
            yielded: false
        })
        play.act(
            'ProposeMerger',
            { companyId: 'ACL', partnerId: 'CG', kind: 'system', yielded: false },
            'alex'
        )
        expect(play.state.activePlayerIds).toEqual(['blair'])
        expect(play.valid('blair')).toEqual(['AnswerMerger'])
        play.act('AnswerMerger', { accept: true }, 'blair')
        expect(play.state.systems).toEqual({ AMTK: ['ACL', 'CG'] })
        expect(getCompany(play.state, 'AMTK').president).toEqual(player('alex'))
        // Nothing remains to merge, so the phase ends and the operating set begins.
        expect(play.state.mergerPhase).toBeUndefined()
        expect(play.state.mergedAfterStockRound).toBe(play.state.stockRound.number)
        expect(play.state.operatingSet?.companyOrder).toContain('AMTK')
    })

    it('does not offer a refused pairing again that phase', () => {
        const play = mergerPhase()
        while (proposer(play) !== 'alex') play.act('PassMerger', {}, proposer(play))
        play.act(
            'ProposeMerger',
            { companyId: 'ACL', partnerId: 'CG', kind: 'takeover', yielded: false },
            'alex'
        )
        play.act('AnswerMerger', { accept: false }, 'blair')
        expect(play.state.mergerPhase?.refused).toEqual([{ companyId: 'ACL', partnerId: 'CG' }])
        expect(mergerOptions(play.state, 'alex')).toEqual([])
    })

    it('lets the buyer take over the partner, paying its holders', () => {
        const play = mergerPhase()
        while (proposer(play) !== 'alex') play.act('PassMerger', {}, proposer(play))
        expect(
            takeoverPayments(play.state, 'ACL', 'CG').reduce(
                (sum, payment) => sum + payment.amount,
                0
            )
        ).toBe(1000)
        play.act(
            'ProposeMerger',
            { companyId: 'ACL', partnerId: 'CG', kind: 'takeover', yielded: false },
            'alex'
        )
        play.act('AnswerMerger', { accept: true }, 'blair')
        expect(getCompany(play.state, 'CG').closed).toBe(true)
        expect(play.state.mergers).toEqual([
            { kind: 'takeover', companyIds: ['ACL', 'CG'], survivorId: 'ACL' }
        ])
        // ACL paid $1000 from its $600 and Alex's $400 and took CG's $600 treasury and the
        // coal fields private, whose $15 it collects as the operating set begins.
        expect(cashOwnedBy(play.state, { kind: 'company', companyId: 'ACL' })).toBe(615)
        expect(cashOwnedBy(play.state, player('alex'))).toBe(600 - 400 + 300)
        expect(cashOwnedBy(play.state, player('blair'))).toBe(450 + 300)
        expect(sharesOwned(play.state, 'CG', player('blair'))).toBe(0)
        expect(
            play.state.stations.filter(
                (station) => station.companyId === 'ACL' && station.status === 'placed'
            )
        ).toHaveLength(2)
    })

    it('has the buyer’s president sell shares to raise a takeover’s price', () => {
        const play = mergerPhase((state) => setCash(state, 'alex', 350))
        while (proposer(play) !== 'alex') play.act('PassMerger', {}, proposer(play))
        play.act(
            'ProposeMerger',
            { companyId: 'ACL', partnerId: 'CG', kind: 'takeover', yielded: false },
            'alex'
        )
        play.act('AnswerMerger', { accept: true }, 'blair')
        expect(play.state.mergerPhase?.funding).toEqual({
            buyerId: 'ACL',
            targetId: 'CG',
            playerId: 'alex'
        })
        expect(play.valid('alex')).toEqual(['SellTakeoverShares'])
        play.act('SellTakeoverShares', { companyId: 'ACL', shares: 1 }, 'alex')
        expect(getCompany(play.state, 'CG').closed).toBe(true)
        expect(play.state.mergerPhase).toBeUndefined()
    })

    it('holds a last phase after the first 6-train, for companies with one president', () => {
        const { state } = playExample(EighteenThirtyTwoScenarios, 'trading', 3, (draft) => {
            draft.tileInventory = EighteenThirtyTwoTileSet.createInventory(JoiningTrack)
        })
        const late = { ...state, phaseId: '6', machineState: 'OperatingSet' as const }
        expect(mergerPhaseDue(late)).toEqual({ final: true })
        expect(mergerPhaseDue({ ...late, mergersEnded: true })).toBeUndefined()
        const phase = { final: true, playerIds: ['alex', 'blair', 'casey'], index: 0, refused: [] }
        expect(mergerOptions({ ...late, mergerPhase: phase }, 'alex')).toEqual([])
        expect(
            mergerOptions({ ...late, mergerPhase: { ...phase, final: false } }, 'alex')
        ).not.toEqual([])
    })
})
