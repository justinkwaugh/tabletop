import { assertExists } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import type { SpaceId } from '../data/board.js'
import { GuildIds } from '../data/components.js'
import { ActionType } from '../definition/actions.js'
import { FeudumApiActions } from '../definition/apiActions.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { MachineState } from '../definition/states.js'
import { giveCardTurn, type Table, tableAtPlayingCards } from '../testing/table.js'
import { migrateOffers, migrateSpaceIds, reasonMigrateRefused } from './migrate.js'
import { StartingSpaceIds } from './placeStartingPawn.js'

/** Every seat's first pawn is a farmer on HOME (a starting space) from setup. */
const HOME: SpaceId = 'space.desert.3'
const AWAY: SpaceId = 'space.forest.1'
const OTHER_STARTING: SpaceId = 'space.forest.2'

function tableWith(edit?: (state: HydratedFeudumGameState, playerId: string) => void): {
    table: Table
    playerId: string
} {
    const table = tableAtPlayingCards(() => ({ cards: ['migrate', 'tax', 'guild'] }))
    const playerId = table.asked
    table.moveTo((state) => {
        edit?.(state, playerId)
        state.recomputeRanks()
        return MachineState.PlayingCards
    })
    return { table, playerId }
}

function offBoard(state: HydratedFeudumGameState, playerId: string): void {
    const [pawn] = state.getPlayerState(playerId).pawns
    pawn.spaceId = undefined
    pawn.character = undefined
}

/** R-1.1 Every pawn the seat has stands on the map. */
function allOnBoard(state: HydratedFeudumGameState, playerId: string): void {
    for (const pawn of state.getPlayerState(playerId).pawns) {
        pawn.spaceId ??= HOME
        pawn.character ??= 'farmer'
    }
}

function turnFoodIn(state: HydratedFeudumGameState, playerId: string): void {
    const { goods } = state.getPlayerState(playerId)
    state.supply.haversack.food += goods.food
    goods.food = 0
}

/** R-4.3.3 The sea stack's top tile, collected: its landscape is no longer hidden. */
function collectTile(state: HydratedFeudumGameState, playerId: string): void {
    const tileId = state.regionStacks.sea.shift()
    assertExists(tileId, 'R-4.3.1 The sea stack holds a tile')
    const hidden = state.requireVault().tileLandscapes
    state.tileLandscapes[tileId] = hidden[tileId]
    delete hidden[tileId]
    state.getPlayerState(playerId).regionTiles.push(tileId)
}

describe('Migrate onto the board: R-3.6.1 (S13)', () => {
    it('R-3.6.1 pays 1 food to the haversack and stands the pawn, status at once', () => {
        const { table, playerId } = tableWith()
        const { food } = table.seat(playerId).goods
        const haversack = table.state.supply.haversack.food
        const markers = table.seat(playerId).influenceSupply

        const [action] = table.send(playerId, {
            type: ActionType.Migrate,
            pawn: 2,
            onto: { character: 'monk', spaceId: HOME }
        })

        const seat = table.seat(playerId)
        expect(seat.goods.food).toBe(food - 1)
        expect(table.state.supply.haversack.food).toBe(haversack + 1)
        expect(seat.pawns[1]).toMatchObject({ n: 2, spaceId: HOME, character: 'monk' })
        expect(seat.played).toEqual([{ kind: 'migrate', use: 'regular' }])
        expect(seat.influenceSupply).toBe(markers - 1)
        expect(table.state.guilds.tracks.monk.master?.playerId).toBe(playerId)
        expect(action).toMatchObject({
            metadata: { rankChanges: [{ guildId: 'monk', playerId, to: 'master' }] }
        })
    })

    it('R-3.6.1, R-3.2 is no barrier and passes the turn', () => {
        const { table, playerId } = tableWith()
        const [action] = table.send(playerId, {
            type: ActionType.Migrate,
            pawn: 2,
            onto: { character: 'knight', spaceId: HOME }
        })
        expect(action.revealsInfo).toBeFalsy()
        expect(table.asked).toBe(table.order[1])
    })

    it('R-3.6.1 turns the pawn to any character', () => {
        for (const character of GuildIds) {
            const { table, playerId } = tableWith()
            table.send(playerId, {
                type: ActionType.Migrate,
                pawn: 2,
                onto: { character, spaceId: HOME }
            })
            expect(table.seat(playerId).pawns[1].character).toBe(character)
        }
    })

    it('R-3.6.1 a space with only the seat’s marker qualifies: ruler or serf', () => {
        const { table, playerId } = tableWith((state, id) => {
            state.getPlayerState(id).influenceSupply -= 2
            state.spaces[AWAY].ruler = { playerId: id, subject: false }
            state.spaces['space.forest.3'].ruler = { playerId: 'p9', subject: false }
            state.spaces['space.forest.3'].serf = { playerId: id }
        })
        expect(migrateSpaceIds(table.hydrated(), playerId)).toEqual(
            expect.arrayContaining([AWAY, 'space.forest.3', HOME])
        )
        table.send(playerId, {
            type: ActionType.Migrate,
            pawn: 2,
            onto: { character: 'farmer', spaceId: AWAY }
        })
        expect(table.seat(playerId).pawns[1].spaceId).toBe(AWAY)
    })

    it('R-3.6.1 refuses a space without the seat’s pawn or marker, with the reason', () => {
        const { table, playerId } = tableWith()
        expect(
            reasonMigrateRefused(table.hydrated(), playerId, {
                pawn: 2,
                onto: { character: 'farmer', spaceId: AWAY }
            })
        ).toBe('You have no pawn or marker on that space.')
        expect(() =>
            table.send(playerId, {
                type: ActionType.Migrate,
                pawn: 2,
                onto: { character: 'farmer', spaceId: AWAY }
            })
        ).toThrow('You have no pawn or marker on that space.')
    })

    it('R-3.6.1 a space with only the seat’s monster does not qualify', () => {
        const { table, playerId } = tableWith((state, id) => {
            state.monsters.behemoth = { playerId: id, spaceId: AWAY }
        })
        expect(
            reasonMigrateRefused(table.hydrated(), playerId, {
                pawn: 2,
                onto: { character: 'farmer', spaceId: AWAY }
            })
        ).toBe('You have no pawn or marker on that space.')
    })

    it('R-3.6.1 with a pawn or marker anywhere, a bare starting space is refused', () => {
        const { table, playerId } = tableWith()
        expect(
            reasonMigrateRefused(table.hydrated(), playerId, {
                pawn: 2,
                onto: { character: 'farmer', spaceId: OTHER_STARTING }
            })
        ).toBe('You have no pawn or marker on that space.')
    })

    it('R-3.6.1 with neither on the board, any starting space and no other', () => {
        const { table, playerId } = tableWith(offBoard)
        expect(migrateSpaceIds(table.hydrated(), playerId)).toEqual(StartingSpaceIds)
        expect(
            reasonMigrateRefused(table.hydrated(), playerId, {
                pawn: 1,
                onto: { character: 'farmer', spaceId: AWAY }
            })
        ).toBe('With no pawn or marker on the board, a pawn enters at a starting space.')
        table.send(playerId, {
            type: ActionType.Migrate,
            pawn: 1,
            onto: { character: 'farmer', spaceId: OTHER_STARTING }
        })
        expect(table.seat(playerId).pawns[0].spaceId).toBe(OTHER_STARTING)
    })

    it('R-3.6.1 a monster is neither: a seat with only a monster enters at a starting space', () => {
        const { table, playerId } = tableWith((state, id) => {
            offBoard(state, id)
            state.monsters.behemoth = { playerId: id, spaceId: AWAY }
        })
        expect(migrateSpaceIds(table.hydrated(), playerId)).toEqual(StartingSpaceIds)
    })

    it('R-3.6.1 refuses a pawn already on the board, with the reason', () => {
        const { table, playerId } = tableWith()
        expect(
            reasonMigrateRefused(table.hydrated(), playerId, {
                pawn: 1,
                onto: { character: 'monk', spaceId: HOME }
            })
        ).toBe('That pawn is already on the board.')
    })

    it('R-3.6.1 with every pawn on the map, refuses entering as no pawn in supply; one may go off', () => {
        const { table, playerId } = tableWith(allOnBoard)
        const state = table.hydrated()
        expect(migrateOffers(state, playerId).pawnsOff).toEqual([])
        expect(
            reasonMigrateRefused(state, playerId, {
                pawn: 2,
                onto: { character: 'monk', spaceId: HOME }
            })
        ).toBe('No pawn in supply.')
        expect(reasonMigrateRefused(state, playerId, { pawn: 2, onto: 'off' })).toBeUndefined()
    })

    it('R-3.6.1 refuses without food, with the reason', () => {
        const { table, playerId } = tableWith(turnFoodIn)
        expect(
            reasonMigrateRefused(table.hydrated(), playerId, {
                pawn: 2,
                onto: { character: 'monk', spaceId: HOME }
            })
        ).toBe('Migrating onto the board needs 1 food.')
    })

    it('R-4.4-H1 a wild tile covers the food in the same press', () => {
        const { table, playerId } = tableWith((state, id) => {
            turnFoodIn(state, id)
            collectTile(state, id)
        })
        const [tileId] = table.seat(playerId).regionTiles
        const haversack = table.state.supply.haversack.food

        table.send(playerId, {
            type: ActionType.Migrate,
            pawn: 2,
            onto: { character: 'monk', spaceId: HOME },
            wildTiles: [{ tileId, good: 'food' }]
        })

        const seat = table.seat(playerId)
        expect(seat.regionTiles).toEqual([])
        expect(table.state.tilesOutOfGame).toContain(tileId)
        expect(seat.goods.food).toBe(0)
        expect(table.state.supply.haversack.food).toBe(haversack)
    })

    it('R-4.3.3 refuses a tile the seat does not hold, with the reason', () => {
        const { table, playerId } = tableWith()
        expect(
            reasonMigrateRefused(table.hydrated(), playerId, {
                pawn: 2,
                onto: { character: 'monk', spaceId: HOME },
                wildTiles: [{ tileId: 'tile.sea.i', good: 'food' }]
            })
        ).toBe("You can't spend those region tiles.")
    })
})

describe('Migrate off: R-3.6.1 (S14)', () => {
    it('R-3.6.1, R-3.6.3 is free, clears the pawn, and returns the rank’s marker', () => {
        const { table, playerId } = tableWith()
        const { food } = table.seat(playerId).goods
        const markers = table.seat(playerId).influenceSupply
        expect(table.state.guilds.tracks.farmer.master?.playerId).toBe(playerId)

        const [action] = table.send(playerId, { type: ActionType.Migrate, pawn: 1, onto: 'off' })

        const seat = table.seat(playerId)
        expect(seat.pawns[0].spaceId).toBeUndefined()
        expect(seat.pawns[0].character).toBeUndefined()
        expect(seat.goods.food).toBe(food)
        expect(seat.influenceSupply).toBe(markers + 1)
        expect(table.state.guilds.tracks.farmer.master?.playerId).toBe(table.order[1])
        expect(action).toMatchObject({
            metadata: {
                left: { spaceId: HOME, character: 'farmer' },
                rankChanges: expect.arrayContaining([
                    { guildId: 'farmer', playerId, from: 'master' },
                    {
                        guildId: 'farmer',
                        playerId: table.order[1],
                        from: 'journeyman',
                        to: 'master'
                    }
                ])
            }
        })
        expect(action.revealsInfo).toBeFalsy()
    })

    it('R-3.6-H1 its vessel stays on the space, and its wine goes to the haversack', () => {
        const { table, playerId } = tableWith((state, id) => {
            const [pawn] = state.getPlayerState(id).pawns
            state.supply.vessels.ship -= 1
            pawn.vessel = 'ship'
            state.supply.haversack.sulfur -= 1
            pawn.wine = 'fed'
        })
        const sulfur = table.state.supply.haversack.sulfur

        const [action] = table.send(playerId, { type: ActionType.Migrate, pawn: 1, onto: 'off' })

        const seat = table.seat(playerId)
        expect(seat.pawns[0].vessel).toBeUndefined()
        expect(seat.pawns[0].wine).toBeUndefined()
        expect(table.state.spaces[HOME].vessels.ship).toBe(1)
        expect(table.state.supply.haversack.sulfur).toBe(sulfur + 1)
        expect(action).toMatchObject({
            metadata: {
                left: { spaceId: HOME, character: 'farmer', vessel: 'ship', wine: true }
            }
        })
    })

    it('R-4.2.4 a pinned pawn can still go off: a monster on the space does not stop it', () => {
        const { table, playerId } = tableWith((state) => {
            state.monsters.behemoth = { playerId: 'p9', spaceId: HOME }
        })
        table.send(playerId, { type: ActionType.Migrate, pawn: 1, onto: 'off' })
        expect(table.seat(playerId).pawns[0].spaceId).toBeUndefined()
    })

    it('R-3.6.1 refuses a pawn not on the board, and a tile or Distant Kin going off', () => {
        const { table, playerId } = tableWith()
        const state = table.hydrated()
        expect(reasonMigrateRefused(state, playerId, { pawn: 2, onto: 'off' })).toBe(
            "That pawn isn't on the board."
        )
        expect(
            reasonMigrateRefused(state, playerId, { pawn: 1, onto: 'off', distantKin: true })
        ).toBe('Distant Kin brings a pawn onto the board.')
        expect(
            reasonMigrateRefused(state, playerId, {
                pawn: 1,
                onto: 'off',
                wildTiles: [{ tileId: 'tile.sea.i', good: 'food' }]
            })
        ).toBe('Migrating off is free.')
    })
})

describe('Distant Kin: R-3.6.2', () => {
    const alchemist = (state: HydratedFeudumGameState, playerId: string) => {
        state.getPlayerState(playerId).pawns[0].character = 'alchemist'
    }

    it('R-3.6.2 with an Alchemist pawn on the board, any starting space; it is a special', () => {
        const { table, playerId } = tableWith(alchemist)
        const { food } = table.seat(playerId).goods
        table.send(playerId, {
            type: ActionType.Migrate,
            pawn: 2,
            onto: { character: 'noble', spaceId: OTHER_STARTING },
            distantKin: true
        })
        const seat = table.seat(playerId)
        expect(seat.pawns[1].spaceId).toBe(OTHER_STARTING)
        expect(seat.goods.food).toBe(food - 1)
        expect(seat.played).toEqual([{ kind: 'migrate', use: 'special' }])
    })

    it('R-3.6.2 refuses without an Alchemist pawn, with the reason', () => {
        const { table, playerId } = tableWith()
        expect(
            reasonMigrateRefused(table.hydrated(), playerId, {
                pawn: 2,
                onto: { character: 'alchemist', spaceId: OTHER_STARTING },
                distantKin: true
            })
        ).toBe('Distant Kin needs an Alchemist pawn on the board.')
    })

    it('R-3.6.2 the flag does not open a space that is not a starting space', () => {
        const { table, playerId } = tableWith(alchemist)
        expect(
            reasonMigrateRefused(table.hydrated(), playerId, {
                pawn: 2,
                onto: { character: 'noble', spaceId: AWAY },
                distantKin: true
            })
        ).toBe('Distant Kin enters at a starting space.')
    })

    it('R-3.6.2 without the flag a bare starting space stays refused', () => {
        const { table, playerId } = tableWith(alchemist)
        expect(
            reasonMigrateRefused(table.hydrated(), playerId, {
                pawn: 2,
                onto: { character: 'noble', spaceId: OTHER_STARTING }
            })
        ).toBe('You have no pawn or marker on that space.')
    })
})

describe('R-3.2 the card', () => {
    it('R-3.2 refuses a seat not on turn and a card not held, with the reason', () => {
        const table = tableAtPlayingCards((id) => ({
            cards: id === 'p1' ? ['tax', 'guild'] : ['tax', 'migrate']
        }))
        const onTurn = table.asked
        const other = table.order[1]
        expect(reasonMigrateRefused(table.hydrated(), other, { pawn: 2, onto: 'off' })).toBe(
            "It isn't your turn."
        )
        const handless = onTurn === 'p1' ? onTurn : 'p1'
        table.moveTo((state) => {
            giveCardTurn(state, handless)
            return MachineState.PlayingCards
        })
        expect(reasonMigrateRefused(table.hydrated(), handless, { pawn: 1, onto: 'off' })).toBe(
            "Migrate isn't in your hand."
        )
    })

    it('R-3.2 is offered from the hand, registered for the API', () => {
        const { table, playerId } = tableWith()
        expect(table.offered(playerId)).toContain(ActionType.Migrate)
        expect(FeudumApiActions[ActionType.Migrate]).toBeDefined()
    })

    it('R-3.3-H1 declares a second card like any other', () => {
        const table = tableAtPlayingCards(() => ({
            cards: ['migrate', 'tax', 'guild'],
            pouchGood: 'sulfur'
        }))
        const playerId = table.asked
        table.send(playerId, {
            type: ActionType.Migrate,
            pawn: 2,
            onto: { character: 'monk', spaceId: HOME },
            secondCard: true
        })
        expect(table.asked).toBe(playerId)
        expect(table.seat(playerId).sequentialUsed).toBe(true)
    })

    it('R-3.15.2 Déjà Vu replays it for a saltpeter, on the real Action', () => {
        const table = tableAtPlayingCards(() => ({ cards: ['migrate', 'repeat', 'tax'] }), 2)
        const [first, second] = table.order
        table.send(first, {
            type: ActionType.Migrate,
            pawn: 2,
            onto: { character: 'monk', spaceId: HOME }
        })
        table.send(second, { type: ActionType.ForfeitCard, kind: 'tax' })
        const { saltpeter } = table.seat(first).goods
        expect(table.offered(first)).toContain(ActionType.Migrate)

        table.send(first, {
            type: ActionType.Migrate,
            pawn: 2,
            onto: 'off',
            asRepeat: 'deja-vu'
        })

        const seat = table.seat(first)
        expect(seat.pawns[1].spaceId).toBeUndefined()
        expect(seat.goods.saltpeter).toBe(saltpeter - 1)
        expect(seat.played.at(-1)).toEqual({
            kind: 'repeat',
            use: 'regular',
            replayedKind: 'migrate',
            dejaVu: true
        })
    })
})

describe('R-3.6 the offers (S13, S14)', () => {
    it('R-3.6.1 lights the spaces, the pawns each way, and each character’s rank', () => {
        const { table, playerId } = tableWith()
        const offers = migrateOffers(table.hydrated(), playerId)
        expect(offers.pawnsOff).toEqual([2, 3])
        expect(offers.pawnsOn).toEqual([1])
        expect(offers.spaces).toEqual([HOME])
        expect(offers.distantKinSpaces).toEqual([])
        expect(offers.wildTileNeeded).toBe(false)
        expect(offers.characters).toContainEqual({ character: 'monk', rank: 'master' })
    })

    it('R-3.6.2 Distant Kin lights every other starting space', () => {
        const { table, playerId } = tableWith((state, id) => {
            state.getPlayerState(id).pawns[0].character = 'alchemist'
        })
        const offers = migrateOffers(table.hydrated(), playerId)
        expect(offers.distantKinSpaces).toEqual(StartingSpaceIds.filter((id) => id !== HOME))
    })

    it('R-3.6.1 no food and no tile lights no space; a tile alone asks for it', () => {
        const { table, playerId } = tableWith(turnFoodIn)
        expect(migrateOffers(table.hydrated(), playerId).spaces).toEqual([])
        const held = tableWith((state, id) => {
            turnFoodIn(state, id)
            collectTile(state, id)
        })
        const offers = migrateOffers(held.table.hydrated(), held.playerId)
        expect(offers.spaces).toEqual([HOME])
        expect(offers.wildTileNeeded).toBe(true)
    })

    it('R-3.6.3 the preview changes nothing on the table', () => {
        const { table, playerId } = tableWith()
        const before = JSON.stringify(table.state)
        migrateOffers(table.hydrated(), playerId)
        expect(JSON.stringify(table.state)).toBe(before)
    })
})
