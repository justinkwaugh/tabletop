import { Color } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { PhaseName } from '../definition/phases.js'
import { RegionTiles } from '../data/regionTiles.js'
import { canonicalState, initialState } from '../testing/state.js'
import { FeudumGameStateValidator, HydratedFeudumGameState } from './gameState.js'
import { FeudumPlayerState, FeudumPlayerStateValidator } from './playerState.js'

function dehydrated(numPlayers = 4) {
    return initialState(numPlayers).dehydrate()
}

describe('initialization', () => {
    it('R-X.3 sets the revision to 1', () => {
        expect(initialState().feudumRevision).toBe(1)
    })

    it('R-2.1 starts at epoch 1 and holds epochs 1 to 5 and no others (R-4.11)', () => {
        expect(initialState().epoch).toBe(1)
        const state = dehydrated()
        for (const epoch of [1, 2, 3, 4, 5]) {
            expect(FeudumGameStateValidator.Check({ ...state, epoch })).toBe(true)
        }
        for (const epoch of [0, 6, 1.5]) {
            expect(FeudumGameStateValidator.Check({ ...state, epoch })).toBe(false)
        }
    })

    it('R-1.4 opens the Setup phase and no round yet (R-2.2)', () => {
        const state = initialState()
        expect(state.phaseManager.currentPhase?.name).toBe(PhaseName.Setup)
        expect(state.roundManager.series).toEqual([])
        expect(state.roundManager.startRound(1).number).toBe(1)
    })

    it('R-2.2 names the phases of a round', () => {
        expect(Object.values(PhaseName)).toEqual([
            'Setup',
            'HandSelection',
            'Cards',
            'Nourish',
            'Progress',
            'Dawn',
            'FinalScoring'
        ])
    })

    it('R-1.1 round-trips through dehydrate and hydrate at 2 to 5 players', () => {
        for (const numPlayers of [2, 3, 4, 5]) {
            const state = dehydrated(numPlayers)
            const rehydrated = new HydratedFeudumGameState(JSON.parse(JSON.stringify(state)))
            expect(rehydrated.dehydrate()).toEqual(state)
            expect(rehydrated.numPlayers).toBe(numPlayers)
        }
    })

    it('R-1.4 is reproducible from the same seed', () => {
        expect(dehydrated()).toEqual(dehydrated())
    })
})

describe('the turn manager', () => {
    it('R-2.2.5 the starting player leads the turn order and passes clockwise', () => {
        const state = initialState()
        const seats = [...state.turnManager.turnOrder]
        expect(state.startingPlayerId).toBe(seats[0])
        expect(state.players.map((player) => player.playerId)).toEqual(seats)

        expect(state.passStartingPlayer()).toBe(seats[1])
        expect(state.turnManager.turnOrder).toEqual([seats[1], seats[2], seats[3], seats[0]])
        state.passStartingPlayer()
        state.passStartingPlayer()
        expect(state.passStartingPlayer()).toBe(seats[0])
        expect(state.turnManager.turnOrder).toEqual(seats)
    })
})

describe('player rows', () => {
    const row: FeudumPlayerState = canonicalState().players[0]

    it('R-5.1, R-4.4.4 keep owner-known lists beside public counts', () => {
        const keys = Object.keys(FeudumPlayerState.properties)
        for (const key of [
            'hand',
            'handCount',
            'writs',
            'writCount',
            'sealedCharters',
            'sealedCharterCount',
            'deckKnowledge'
        ]) {
            expect(keys).toContain(key)
        }
        expect(row.hand).toEqual([])
        expect(row.handCount).toBe(0)
    })

    it('R-1.1 pawns are numbered 1 to 3 and start off the board', () => {
        expect(row.pawns).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }])
        expect(FeudumPlayerStateValidator.Check({ ...row, pawns: row.pawns.slice(1) })).toBe(false)
        expect(
            FeudumPlayerStateValidator.Check({
                ...row,
                pawns: [{ n: 1 }, { n: 2 }, { n: 4 }]
            })
        ).toBe(false)
    })

    it('R-3.2 a card is its kind on its player row; no card has an id of its own', () => {
        expect(
            FeudumPlayerStateValidator.Check({
                ...row,
                hand: ['move'],
                played: [{ kind: 'migrate', use: 'regular' }]
            })
        ).toBe(true)
        expect(FeudumPlayerStateValidator.Check({ ...row, hand: ['card.action.move'] })).toBe(false)
    })

    it('R-4.10.2 the wine barrel holds at most 3', () => {
        expect(FeudumPlayerStateValidator.Check({ ...row, barrel: 3 })).toBe(true)
        expect(FeudumPlayerStateValidator.Check({ ...row, barrel: 4 })).toBe(false)
    })

    it('R-1.1 a count of components is never negative', () => {
        expect(FeudumPlayerStateValidator.Check({ ...row, shillings: -1 })).toBe(false)
        expect(
            FeudumPlayerStateValidator.Check({ ...row, goods: { ...row.goods, food: -1 } })
        ).toBe(false)
    })
})

describe('Knight rows', () => {
    it('R-1.4-H1 a seat row names its playerId, a dummy row its colour alone, under a row id', () => {
        const state = dehydrated()
        state.guilds.knight.rows = {
            'knight-row-1': { owner: { playerId: 'p1' }, markers: 2 },
            'knight-row-2': { owner: { dummyColour: Color.Purple }, markers: 2 }
        }
        expect(FeudumGameStateValidator.Check(state)).toBe(true)
        state.guilds.knight.rows = {
            'knight-row-1': { owner: { dummyColour: Color.Red }, markers: 7 }
        }
        expect(FeudumGameStateValidator.Check(state)).toBe(false)
        state.guilds.knight.rows = {
            'knight-row-1': { owner: { colour: Color.Red } as never, markers: 2 }
        }
        expect(FeudumGameStateValidator.Check(state)).toBe(false)
        state.guilds.knight.rows = {
            'row-9': { owner: { playerId: 'p1' }, markers: 2 }
        } as never
        expect(FeudumGameStateValidator.Check(state)).toBe(false)
    })
})

describe('flow', () => {
    const turn = { secondCard: false, followUps: [] }
    const pending = {
        selection: { finalised: ['p1'] },
        turn,
        writDraw: {
            playerId: 'p1',
            drawnCount: 3,
            keep: 1,
            source: 'explore',
            shovelsOffered: false,
            drawn: ['writ.mandate.1']
        },
        harvest: {
            playerId: 'p1',
            spaceId: 'space.sea.1',
            drawn: { saltpeter: 0, sulfur: 0, iron: 0, wood: 0, food: 0 },
            favours: 0
        },
        combat: {
            attackerId: 'p1',
            defenderId: 'p2',
            spaceId: 'space.sea.1',
            target: { kind: 'feudum' },
            defendFlipped: false
        },
        starve: {
            actorId: 'p1',
            targetPlayerId: 'p2',
            spaceId: 'space.sea.1',
            role: 'serf'
        },
        nourish: { pending: ['p1'] },
        landscapes: { pending: ['p1'] }
    }

    function accepts(flow: unknown): boolean {
        return FeudumGameStateValidator.Check({ ...dehydrated(), flow })
    }

    it("R-X.1, R-1.4.8 starts with nothing pending but the starting player's turn", () => {
        const state = initialState()
        expect(state.flow).toEqual({})
        expect(state.turnManager.currentTurn()?.playerId).toBe(state.startingPlayerId)
    })

    it('R-X.1 holds every pending decision', () => {
        expect(accepts(pending)).toBe(true)
    })

    it.each([
        ['writDraw', 'playerId'],
        ['harvest', 'playerId'],
        ['combat', 'attackerId'],
        ['combat', 'defenderId'],
        ['starve', 'actorId'],
        ['starve', 'targetPlayerId'],
        ['nourish', 'pending'],
        ['landscapes', 'pending']
    ] as const)('R-X.1 %s names its deciding seat in %s', (entry, seat) => {
        const named: Record<string, unknown> = { ...pending[entry] }
        delete named[seat]
        expect(accepts({ [entry]: named })).toBe(false)
    })

    it('R-4.7, R-4.9.1 follow-ups keep their order and name no seat', () => {
        const followUps = [
            { kind: 'keep-writs' },
            { kind: 'voyage' },
            { kind: 'reeve', guildId: 'monk' },
            { kind: 'military' }
        ]
        expect(accepts({ turn: { ...turn, followUps } })).toBe(true)
        expect(
            accepts({ turn: { ...turn, followUps: [{ kind: 'voyage', playerId: 'p1' }] } })
        ).toBe(false)
        expect(accepts({ turn: { ...turn, followUps: [{ kind: 'other' }] } })).toBe(false)
    })

    it('R-4.8.1 a combat targets a pawn by (playerId, n), a monster by id, or a feudum', () => {
        const combat = pending.combat
        for (const target of [
            { kind: 'pawn', playerId: 'p2', n: 2 },
            { kind: 'monster', monsterId: 'behemoth' },
            { kind: 'feudum' }
        ]) {
            expect(accepts({ combat: { ...combat, target } })).toBe(true)
        }
        expect(accepts({ combat: { ...combat, target: { kind: 'pawn', n: 2 } } })).toBe(false)
    })
})

describe('derived, not stored', () => {
    it('R-1.1, R-4.5.1, R-4.9.2 the schema stores no free discs, vassal, stars or ruled counts', () => {
        const stored = JSON.stringify(dehydrated())
        for (const word of ['freeDiscs', 'vassal', 'statusStars', 'stars', 'ruled']) {
            expect(stored.toLowerCase()).not.toContain(word.toLowerCase())
        }
    })

    it('R-1.1 free discs are the three shared less reeves, voyage and military', () => {
        const state = initialState()
        expect(state.freeDiscs('p1')).toBe(3)
        state.guilds.tracks.monk.master = { playerId: 'p1', reeve: true }
        state.guilds.tracks.farmer.journeyman = { playerId: 'p1', reeve: false }
        state.guilds.tracks.noble.journeyman = { playerId: 'p2', reeve: true }
        expect(state.freeDiscs('p1')).toBe(2)
        state.voyageTrack.p1 = 'track.voyage.1'
        expect(state.freeDiscs('p1')).toBe(1)
        state.militaryService.p1 = 'track.military.1'
        expect(state.freeDiscs('p1')).toBe(0)
        expect(state.freeDiscs('p2')).toBe(2)
    })

    it('R-4.1.4, R-4.9.2 ruled spaces and vassals follow from the map', () => {
        const state = initialState()
        expect(state.ruledSpaceIds('p1')).toEqual([])
        expect(state.isVassal('p1')).toBe(false)
        state.spaces['space.sea.1'].ruler = { playerId: 'p1', subject: false }
        state.spaces['space.sea.2'].serf = { playerId: 'p1' }
        expect(state.ruledSpaceIds('p1')).toEqual(['space.sea.1'])
        expect(state.isVassal('p1')).toBe(false)
        state.spaces['space.sea.1'].location = { kind: 'feudum', discId: 'disc.feudum.monk-1' }
        expect(state.isVassal('p1')).toBe(true)
    })
})

describe('tiles', () => {
    it('R-1.4-H2 the state holds a hidden landscape for every tile in a stack', () => {
        const state = initialState()
        expect(Object.keys(state.requireVault().tileLandscapes).sort()).toEqual(
            RegionTiles.map((tile) => tile.id).sort()
        )
        expect(state.tileLandscapes).toEqual({})
    })

    it('R-4.3.1 each stack holds its region, epoch I on top', () => {
        const { regionStacks } = initialState()
        expect(regionStacks.sea).toEqual([
            'tile.sea.i',
            'tile.sea.ii',
            'tile.sea.iii',
            'tile.sea.iv'
        ])
    })
})
