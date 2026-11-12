import { describe, expect, it } from 'vitest'
import { ActionSource } from '@tabletop/common'
import {
    ActionBox,
    ActionType,
    AuctionKind,
    MapId,
    RailroadId,
    sarMap,
    type BuildConnection,
    type BuildTrack,
    type FoundSpecialConnection,
    type LeaveTown,
    type OfferShare
} from '@tabletop/south-african-railroads'
import {
    boxRules,
    boxTerms,
    describeAction,
    saleDescription,
    winVerb,
    type BoxContext
} from './describeAction.js'

describe('player sentences', () => {
    it('describes a sale in the past tense, so it reads for any buyer', () => {
        expect(
            saleDescription({
                railroadId: RailroadId.NRC,
                kind: AuctionKind.OfferStock,
                buyerId: 'p1',
                price: 4
            })
        ).toEqual([
            { playerId: 'p1' },
            ' bought the ',
            { railroadId: RailroadId.NRC },
            ' share for $4'
        ])
        expect(
            saleDescription({
                railroadId: RailroadId.CdFM,
                kind: AuctionKind.InitialOffering,
                buyerId: 'p1',
                price: 0
            })
        ).toEqual([
            { playerId: 'p1' },
            ' took the ',
            { railroadId: RailroadId.CdFM },
            ' share free'
        ])
    })

    it('describes reselling a share without a pronoun', () => {
        const resale: OfferShare = {
            id: 'a1',
            gameId: 'g',
            source: ActionSource.User,
            playerId: 'p1',
            type: ActionType.OfferShare,
            railroadId: RailroadId.NRC,
            ownShare: true
        }
        expect(describeAction(sarMap(MapId.SouthAfrica), resale)).toEqual([
            'offered a ',
            { railroadId: RailroadId.NRC },
            ' share for resale'
        ])
    })

    it('names the railroad a build opens and the home it reached', () => {
        const build: BuildTrack = {
            id: 'a2',
            gameId: 'g',
            source: ActionSource.User,
            playerId: 'p1',
            type: ActionType.BuildTrack,
            railroadId: RailroadId.CdFM,
            linkIds: ['johannesburg~witbank'],
            metadata: { cost: 5, income: 9, opensRailroad: RailroadId.ZASM }
        }
        expect(describeAction(sarMap(MapId.SouthAfrica), build)).toEqual([
            'built Johannesburg–Witbank for the ',
            { railroadId: RailroadId.CdFM },
            ' for $5',
            ' · Johannesburg reached: the ',
            { railroadId: RailroadId.ZASM },
            ' opens'
        ])
    })

    it('describes leaving town and the metro area it develops', () => {
        const leave: LeaveTown = {
            id: 'a3',
            gameId: 'g',
            source: ActionSource.User,
            playerId: 'p1',
            type: ActionType.LeaveTown,
            settlementId: 'topeka',
            metadata: { income: 2, automatic: { settlementId: 'dallas', income: 4 } }
        }
        expect(describeAction(sarMap(MapId.TexasSpecial), leave)).toEqual([
            'left Topeka, taking a cube that pays $3 a dividend · Dallas developed (now $4)'
        ])
    })

    it('describes founding the Texas Special with its special dividends', () => {
        const founding: FoundSpecialConnection = {
            id: 'a4',
            gameId: 'g',
            source: ActionSource.User,
            playerId: 'p1',
            type: ActionType.FoundSpecialConnection,
            railroadId: RailroadId.MKT,
            partnerId: RailroadId.SP,
            metadata: {
                cost: 30,
                rates: [
                    { railroadId: RailroadId.MKT, perShare: 2 },
                    { railroadId: RailroadId.SP, perShare: 1 }
                ],
                payouts: []
            }
        }
        expect(describeAction(sarMap(MapId.TexasSpecial), founding)).toEqual([
            'founded the Texas Special joining the ',
            { railroadId: RailroadId.MKT },
            ' and the ',
            { railroadId: RailroadId.SP },
            ' · special dividend per share: Katy $2, SoPac $1'
        ])
    })

    it('records the cost a connection was built for, doubled for an isolated metro railroad', () => {
        const build: BuildConnection = {
            id: 'a5',
            gameId: 'g',
            source: ActionSource.User,
            playerId: 'p1',
            type: ActionType.BuildConnection,
            railroadId: RailroadId.ZASM,
            connectionId: 'bechuanaland',
            metadata: { cost: 60, perShare: 2, payouts: [] }
        }
        expect(describeAction(sarMap(MapId.Veld), build)).toEqual([
            'connected the ',
            { railroadId: RailroadId.ZASM },
            ' to Bechuanaland for $60 · special dividend $2 a share'
        ])
    })

    it('agrees the win with the winners', () => {
        expect(winVerb(['p2'], 'p1')).toBe('wins')
        expect(winVerb(['p1'], 'p1')).toBe('win')
        expect(winVerb(['p1'], undefined)).toBe('wins')
        expect(winVerb(['p1', 'p2'], 'p1')).toBe('share the win')
    })
})

describe('the Develop Settlements terms', () => {
    it('name the free metro area, Leave Town, or a free first development', () => {
        const develop = (mapId: MapId, freeMetroId?: string) =>
            boxTerms(sarMap(mapId), ActionBox.DevelopSettlements, {
                finalPayoffNext: false,
                freeMetroId
            })
        expect(develop(MapId.SouthAfrica, 'johannesburg')).toBe('2nd $3 · Johannesburg free')
        expect(develop(MapId.TexasSpecial)).toBe('2nd $3 · or Leave Town')
        expect(develop(MapId.Pennsylvania, 'pittsburgh')).toBe('2nd $3 · Pittsburgh free')
        expect(develop(MapId.Pennsylvania, 'cincinnati')).toBe('2nd $3 · Cincinnati free')
        expect(develop(MapId.Pennsylvania)).toBe('1st free · 2nd $3')
        expect(
            boxRules(sarMap(MapId.Pennsylvania), ActionBox.DevelopSettlements, {
                finalPayoffNext: false,
                freeMetroId: 'st-louis'
            })
        ).toBe('Raise a served settlement’s income; a second costs $3, St Louis is free')
    })
})

describe('the Veld Railroads rounds', () => {
    const map = sarMap(MapId.Veld)
    const war: BoxContext = {
        finalPayoffNext: false,
        freeMetroId: 'johannesburg',
        war: map.definition.war
    }

    it('limit the war to single $7 links and three developments', () => {
        expect(boxTerms(map, ActionBox.ConstructTrack, war)).toBe('$7 a link · one only')
        expect(boxTerms(map, ActionBox.DevelopSettlements, war)).toBe('3rd $3 · Johannesburg free')
        expect(boxRules(map, ActionBox.ConstructTrack, war)).toBe(
            'War: a railroad you control lays one link for $7; no double links or connections, and the ZASM builds nothing'
        )
    })

    it('pay a tenth of income in the recovery', () => {
        expect(
            boxTerms(map, ActionBox.PayDividends, { finalPayoffNext: false, recovery: true })
        ).toBe('Income ÷ 10 a share')
    })

    it('name the special dividends a build earns and an opening by income', () => {
        const build: BuildTrack = {
            id: 'a5',
            gameId: 'g',
            source: ActionSource.User,
            playerId: 'p1',
            type: ActionType.BuildTrack,
            railroadId: RailroadId.CdFM,
            linkIds: ['johannesburg~pretoria'],
            metadata: {
                cost: 5,
                income: 12,
                opensRailroad: RailroadId.ZASM,
                specialDividends: [{ railroadId: RailroadId.CdFM, perShare: 3, payouts: [] }]
            }
        }
        expect(describeAction(map, build)).toEqual([
            'built Johannesburg–Pretoria for the ',
            { railroadId: RailroadId.CdFM },
            ' for $5',
            ' · Johannesburg reached: the ',
            { railroadId: RailroadId.ZASM },
            ' opens',
            ' · special dividend for the ',
            { railroadId: RailroadId.CdFM },
            ' $3 a share'
        ])
    })
})
