import { describe, expect, it } from 'vitest'
import type { RouteMedium, SpaceId } from '../data/board.js'
import type { ActionCardKind } from '../data/cards.js'
import type { GuildId, MonsterId, VesselType } from '../data/components.js'
import type { LandscapeKind } from '../data/regionTiles.js'
import { ActionType } from '../definition/actions.js'
import { FeudumApiActions } from '../definition/apiActions.js'
import { MachineState } from '../definition/states.js'
import { conservationBreaks } from '../model/canonicalValidator.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { rankOf } from '../model/guildStatus.js'
import { placeMarker } from '../model/locationControl.js'
import { canonicalOf } from '../testing/state.js'
import { tableAtPlayingCards, type Table } from '../testing/table.js'
import { moveAllowance, moveOffers, reasonMoveRefused, type MoveStep } from './move.js'

const Start: SpaceId = 'space.desert.3'

type Way = Pick<MoveStep, 'vessel' | 'ferry'>

function pawnStep(
    playerId: string,
    n: 1 | 2 | 3,
    to: SpaceId,
    medium: RouteMedium,
    way: Way = {}
): MoveStep {
    return { piece: { kind: 'pawn', playerId, n }, to, medium, ...way }
}

function monsterStep(
    monsterId: MonsterId,
    to: SpaceId,
    medium: RouteMedium,
    way: Way = {}
): MoveStep {
    return { piece: { kind: 'monster', monsterId }, to, medium, ...way }
}

function standPawn(
    state: HydratedFeudumGameState,
    playerId: string,
    n: 1 | 2 | 3,
    spaceId: SpaceId,
    character: GuildId = 'farmer'
) {
    const pawn = state.getPlayerState(playerId).pawns[n - 1]
    pawn.spaceId = spaceId
    pawn.character = character
}

function standMonster(
    state: HydratedFeudumGameState,
    monster: MonsterId,
    playerId: string,
    spaceId: SpaceId
) {
    state.monsters[monster] = { playerId, spaceId }
    // R-4.2.4 Its controller's marker lies on its icon.
    state.getPlayerState(playerId).influenceSupply -= 1
}

/** R-1.1 A vessel from the general supply into the seat's supply. */
function giveVessel(state: HydratedFeudumGameState, playerId: string, vessel: VesselType) {
    state.supply.vessels[vessel] -= 1
    state.getPlayerState(playerId).vessels[vessel] += 1
}

/** R-1.1 A vessel from the general supply, abandoned on a space. */
function abandonVessel(state: HydratedFeudumGameState, spaceId: SpaceId, vessel: VesselType) {
    state.supply.vessels[vessel] -= 1
    state.spaces[spaceId].vessels[vessel] += 1
}

/** R-4.2.3 The Alchemist's vessels go back to the supply, so the ferries run. */
function sellOut(state: HydratedFeudumGameState) {
    for (const vessel of state.guilds.alchemist.vesselsForSale) {
        state.supply.vessels[vessel] += 1
    }
    state.guilds.alchemist.vesselsForSale = []
}

/** R-1.1 The seat's shillings go back to the supply until it holds `amount`. */
function holdShillings(state: HydratedFeudumGameState, playerId: string, amount: number) {
    const player = state.getPlayerState(playerId)
    state.supply.shillings += player.shillings - amount
    player.shillings = amount
}

/** R-1.4.4 A good from the haversack lies on the space. */
function goodOnSpace(state: HydratedFeudumGameState, spaceId: SpaceId) {
    state.supply.haversack.iron -= 1
    state.spaces[spaceId].goods.iron += 1
}

/** R-4.3.4 A tile of this landscape leaves its stack, shown, on the space, holding `amount`. */
function landscapeOn(
    state: HydratedFeudumGameState,
    spaceId: SpaceId,
    kind: LandscapeKind,
    amount = 1
) {
    const { tileLandscapes } = state.requireVault()
    const stacks = Object.values(state.regionStacks)
    const stack = stacks.find((tiles) => tiles.some((tile) => tileLandscapes[tile] === kind))
    const tileId = stack?.find((tile) => tileLandscapes[tile] === kind)
    if (!stack || !tileId) throw new Error(`no ${kind} in the stacks`)
    stack.splice(stack.indexOf(tileId), 1)
    delete tileLandscapes[tileId]
    state.tileLandscapes[tileId] = kind
    state.spaces[spaceId].landscape = { tileId, amount }
    if (kind === 'orchard') state.supply.haversack.food -= amount
    if (kind === 'sulfur-mine') state.supply.haversack.sulfur -= amount
    if (kind === 'silver-mine') state.supply.shillings -= amount
    if (kind === 'archery-butt') state.supply.targets -= amount
}

/** R-4.1.2 The other seat rules the space and this seat is its serf. */
function serfOn(state: HydratedFeudumGameState, spaceId: SpaceId, ruler: string, serf: string) {
    placeMarker(state, ruler, spaceId)
    placeMarker(state, serf, spaceId)
}

function refused(
    table: Table,
    playerId: string,
    move: Partial<Parameters<typeof reasonMoveRefused>[2]>
) {
    return reasonMoveRefused(table.hydrated(), playerId, { steps: [], ...move })
}

/** The turn player, its hand as named, and `edit` applied to the table it is asked at. */
function tableWith(
    edit: (state: HydratedFeudumGameState, playerId: string, other: string) => void = () => {},
    cards: ActionCardKind[] = ['move', 'tax', 'guild', 'explore']
): { table: Table; playerId: string; other: string } {
    const table = tableAtPlayingCards(() => ({ cards }))
    const [playerId, other] = table.order
    table.moveTo((state) => {
        edit(state, playerId, other)
        return MachineState.PlayingCards
    })
    return { table, playerId, other }
}

function send(table: Table, playerId: string, move: Record<string, unknown>) {
    return table.send(playerId, { type: ActionType.Move, steps: [], ...move })
}

/** The Action the send recorded. */
function sent(table: Table, playerId: string, move: Record<string, unknown>) {
    return send(table, playerId, move)[0]
}

describe('Move: the card', () => {
    it('R-3.7 is registered, offered with the card in hand and hidden without it', () => {
        expect(FeudumApiActions[ActionType.Move]).toBeDefined()
        const { table, playerId } = tableWith()
        expect(table.offered(playerId)).toContain(ActionType.Move)
        const { table: other, playerId: seat } = tableWith(undefined, ['tax', 'guild', 'explore'])
        expect(other.offered(seat)).not.toContain(ActionType.Move)
    })

    it('R-3.2 is refused off turn and without the card', () => {
        const { table, other } = tableWith()
        expect(refused(table, other, {})).toBe("It isn't your turn.")
        const { table: t, playerId } = tableWith(undefined, ['tax', 'guild', 'explore'])
        expect(refused(t, playerId, {})).toBe("Move isn't in your hand.")
    })

    it('R-3.7, R-3.2 leaves the hand and passes the turn; R-X.2 not a barrier', () => {
        const { table, playerId } = tableWith()
        const action = sent(table, playerId, {
            steps: [pawnStep(playerId, 1, 'space.desert.4', 'road')]
        })
        expect(action.revealsInfo).toBeFalsy()
        expect(table.seat(playerId).hand).toEqual(['tax', 'guild', 'explore'])
        expect(table.seat(playerId).played).toEqual([{ kind: 'move', use: 'regular' }])
        expect(table.seat(playerId).pawns[0].spaceId).toBe('space.desert.4')
        expect(table.asked).toBe(table.order[1])
    })
})

describe('R-4.1 The character a pawn shows, for the sentence', () => {
    it('R-4.1 A pawn step records the character it shows', () => {
        const { table, playerId } = tableWith((state, seat) => {
            standPawn(state, seat, 1, Start, 'merchant')
        })
        const action = sent(table, playerId, {
            steps: [pawnStep(playerId, 1, 'space.desert.4', 'road')]
        })

        expect(action).toMatchObject({ metadata: { steps: [{ character: 'merchant' }] } })
    })

    it('R-4.1 A monster step records none', () => {
        const { table, playerId } = tableWith((state, seat) => {
            standMonster(state, 'behemoth', seat, Start)
        })
        const [action] = send(table, playerId, {
            steps: [monsterStep('behemoth', 'space.desert.4', 'road')]
        })

        expect(action).toMatchObject({ metadata: { steps: [{}] } })
        expect(action).not.toMatchObject({
            metadata: { steps: [{ character: expect.anything() }] }
        })
    })
})

describe('Move: the allowance', () => {
    it('R-3.7.1 counts pawns on the board plus monsters', () => {
        const { table, playerId } = tableWith((state, seat) => {
            standPawn(state, seat, 2, 'space.forest.2')
            standMonster(state, 'behemoth', seat, 'space.forest.3')
        })
        expect(moveAllowance(table.hydrated(), playerId)).toBe(3)
    })

    it('R-3.7.1 divides freely: a piece may take all of it, out and back', () => {
        const { table, playerId } = tableWith((state, seat) => {
            standPawn(state, seat, 2, Start)
        })
        const action = sent(table, playerId, {
            steps: [
                pawnStep(playerId, 1, 'space.desert.4', 'road'),
                pawnStep(playerId, 1, Start, 'road')
            ]
        })
        expect(table.seat(playerId).pawns[0].spaceId).toBe(Start)
        expect(action).toMatchObject({
            metadata: {
                steps: [
                    { routeId: 'route.road.desert-3--desert-4', from: Start },
                    { routeId: 'route.road.desert-3--desert-4', from: 'space.desert.4' }
                ]
            }
        })
        expect(table.seat(playerId).successfulMoves).toBe(1)
    })

    it('R-3.7.1 refuses a step past it', () => {
        const { table, playerId } = tableWith()
        expect(
            refused(table, playerId, {
                steps: [
                    pawnStep(playerId, 1, 'space.desert.4', 'road'),
                    pawnStep(playerId, 1, Start, 'road')
                ]
            })
        ).toBe('Your movement allowance is 1.')
    })

    it("R-3.7.1 moves only the seat's own pieces, on the board", () => {
        const { table, playerId, other } = tableWith()
        expect(
            refused(table, playerId, { steps: [pawnStep(other, 1, 'space.desert.4', 'road')] })
        ).toBe("That pawn isn't yours.")
        expect(
            refused(table, playerId, { steps: [pawnStep(playerId, 2, 'space.desert.4', 'road')] })
        ).toBe("That pawn isn't on the board.")
    })

    it('R-4.2 refuses a route that does not join the spaces', () => {
        const { table, playerId } = tableWith()
        expect(
            refused(table, playerId, { steps: [pawnStep(playerId, 1, 'space.sea.1', 'road')] })
        ).toBe('No road joins those spaces.')
        expect(
            refused(table, playerId, {
                steps: [
                    pawnStep(playerId, 1, 'space.desert.4', 'flying-machine', { vessel: 'place' })
                ]
            })
        ).toBe('No flying machine route joins those spaces.')
    })
})

describe('Move: vessels', () => {
    const Port: SpaceId = 'space.desert.1'
    const ByShip: SpaceId = 'space.desert.2'
    const ByRoad: SpaceId = 'space.desert.3'

    it('R-4.2.2 places one from the supply under the pawn, which stays aboard', () => {
        const { table, playerId } = tableWith((state, seat) => {
            standPawn(state, seat, 1, Port)
            standPawn(state, seat, 2, 'space.forest.2')
            giveVessel(state, seat, 'ship')
        })
        const held = table.seat(playerId).vessels.ship
        const action = sent(table, playerId, {
            steps: [
                pawnStep(playerId, 1, ByShip, 'ship', { vessel: 'place' }),
                pawnStep(playerId, 1, Port, 'ship')
            ]
        })
        const seat = table.seat(playerId)
        expect(seat.vessels.ship).toBe(held - 1)
        expect(seat.pawns[0]).toMatchObject({ spaceId: Port, vessel: 'ship' })
        expect(action).toMatchObject({
            metadata: {
                steps: [
                    { routeId: 'route.ship.desert-1--desert-2', from: Port, vessel: 'ship' },
                    { routeId: 'route.ship.desert-1--desert-2', from: ByShip, vessel: 'ship' }
                ]
            }
        })
    })

    it('R-4.2.2 boards one abandoned on the space', () => {
        const { table, playerId } = tableWith((state, seat) => {
            standPawn(state, seat, 1, Port)
            abandonVessel(state, Port, 'submersible')
        })
        send(table, playerId, {
            steps: [pawnStep(playerId, 1, ByShip, 'submersible', { vessel: 'board' })]
        })
        expect(table.hydrated().spaces[Port].vessels.submersible).toBe(0)
        expect(table.seat(playerId).pawns[0]).toMatchObject({
            spaceId: ByShip,
            vessel: 'submersible'
        })
    })

    it('R-4.2.2 leaves a vessel on the space when the pawn goes on by road', () => {
        const { table, playerId } = tableWith((state, seat) => {
            standPawn(state, seat, 1, Port)
            state.getPlayerState(seat).pawns[0].vessel = 'ship'
            state.supply.vessels.ship -= 1
        })
        const action = sent(table, playerId, { steps: [pawnStep(playerId, 1, ByRoad, 'road')] })
        expect(table.seat(playerId).pawns[0].vessel).toBeUndefined()
        expect(table.hydrated().spaces[Port].vessels.ship).toBe(1)
        expect(action).toMatchObject({
            metadata: {
                steps: [{ routeId: 'route.road.desert-1--desert-3', from: Port, left: 'ship' }]
            }
        })
    })

    it('R-4.2.2, R-4.2-H2 a vessel left this turn is not boarded until a later turn', () => {
        const { table, playerId, other } = tableWith((state, seat, next) => {
            standPawn(state, seat, 1, Port)
            standPawn(state, seat, 2, Port)
            standPawn(state, next, 1, Port)
            state.getPlayerState(seat).pawns[0].vessel = 'ship'
            state.supply.vessels.ship -= 1
        })
        const relay = [
            pawnStep(playerId, 1, ByRoad, 'road'),
            pawnStep(playerId, 2, ByShip, 'ship', { vessel: 'board' })
        ]
        expect(refused(table, playerId, { steps: relay })).toBe(
            'That ship was left this turn; it can be boarded on a later turn.'
        )
        const offered = moveOffers(table.hydrated(), playerId, { steps: relay.slice(0, 1) })
        const pawn2 = offered.pieces.find(({ piece }) => piece.kind === 'pawn' && piece.n === 2)
        expect(pawn2?.ways.some((way) => way.vessel === 'board')).toBe(false)
        send(table, playerId, { steps: [pawnStep(playerId, 1, ByRoad, 'road')] })
        expect(table.hydrated().spaces[Port].vessels.ship).toBe(1)
        expect(table.asked).toBe(other)
        send(table, other, {
            steps: [pawnStep(other, 1, ByShip, 'ship', { vessel: 'board' })]
        })
        expect(table.seat(other).pawns[0]).toMatchObject({ spaceId: ByShip, vessel: 'ship' })
        expect(table.hydrated().spaces[Port].vessels.ship).toBe(0)
    })

    it('R-4.2-H2 a vessel abandoned before this turn is boarded beside one left this turn', () => {
        const { table, playerId } = tableWith((state, seat) => {
            standPawn(state, seat, 1, Port)
            standPawn(state, seat, 2, Port)
            standPawn(state, seat, 3, Port)
            state.getPlayerState(seat).pawns[0].vessel = 'ship'
            state.supply.vessels.ship -= 1
            abandonVessel(state, Port, 'ship')
        })
        const steps = [
            pawnStep(playerId, 1, ByRoad, 'road'),
            pawnStep(playerId, 2, ByShip, 'ship', { vessel: 'board' }),
            pawnStep(playerId, 3, ByShip, 'ship', { vessel: 'board' })
        ]
        expect(refused(table, playerId, { steps })).toBe(
            'That ship was left this turn; it can be boarded on a later turn.'
        )
        send(table, playerId, { steps: steps.slice(0, 2) })
        expect(table.seat(playerId).pawns[1]).toMatchObject({ spaceId: ByShip, vessel: 'ship' })
        expect(table.hydrated().spaces[Port].vessels.ship).toBe(1)
    })

    it('R-4.2-H2, R-3.6-H1 a vessel left by migrating off is not boarded by the second card', () => {
        const table = tableAtPlayingCards(() => ({
            cards: ['migrate', 'move', 'tax'],
            pouchGood: 'sulfur'
        }))
        const playerId = table.asked
        table.moveTo((state) => {
            standPawn(state, playerId, 1, Port)
            standPawn(state, playerId, 2, Port)
            state.getPlayerState(playerId).pawns[0].vessel = 'ship'
            state.supply.vessels.ship -= 1
            return MachineState.PlayingCards
        })
        table.send(playerId, { type: ActionType.Migrate, pawn: 1, onto: 'off', secondCard: true })
        expect(table.asked).toBe(playerId)
        expect(table.hydrated().spaces[Port].vessels.ship).toBe(1)
        const board = [pawnStep(playerId, 2, ByShip, 'ship', { vessel: 'board' })]
        expect(refused(table, playerId, { steps: board })).toBe(
            'That ship was left this turn; it can be boarded on a later turn.'
        )
        const pawn2 = moveOffers(table.hydrated(), playerId).pieces.find(
            ({ piece }) => piece.kind === 'pawn' && piece.n === 2
        )
        expect(pawn2?.ways.some((way) => way.vessel === 'board')).toBe(false)
    })

    it('R-4.2.2 changes vessels: the old one stays behind, the new one comes up', () => {
        const { table, playerId } = tableWith((state, seat) => {
            standPawn(state, seat, 1, Port)
            state.getPlayerState(seat).pawns[0].vessel = 'ship'
            state.supply.vessels.ship -= 1
            giveVessel(state, seat, 'submersible')
        })
        const action = sent(table, playerId, {
            steps: [pawnStep(playerId, 1, ByShip, 'submersible', { vessel: 'place' })]
        })
        expect(table.seat(playerId).pawns[0].vessel).toBe('submersible')
        expect(table.hydrated().spaces[Port].vessels.ship).toBe(1)
        expect(action).toMatchObject({
            metadata: {
                steps: [{ left: 'ship', vessel: 'submersible' }]
            }
        })
    })

    it('R-4.2.2 refuses a vessel route without a vessel, and each wrong way of naming one', () => {
        const { table, playerId } = tableWith((state, seat) => {
            standPawn(state, seat, 1, Port)
        })
        const step = (way: Way) => ({ steps: [pawnStep(playerId, 1, ByShip, 'ship', way)] })
        expect(refused(table, playerId, step({}))).toBe('That pawn must board or place a ship.')
        expect(refused(table, playerId, step({ vessel: 'board' }))).toBe(
            'There is no ship to board there.'
        )
        expect(refused(table, playerId, step({ vessel: 'place' }))).toBe(
            'You have no ship in your supply.'
        )
        expect(
            refused(table, playerId, {
                steps: [pawnStep(playerId, 1, ByRoad, 'road', { vessel: 'place' })]
            })
        ).toBe('A road takes no vessel.')
        const { table: aboard, playerId: seat } = tableWith((state, id) => {
            standPawn(state, id, 1, Port)
            state.getPlayerState(id).pawns[0].vessel = 'ship'
            state.supply.vessels.ship -= 1
        })
        expect(
            refused(aboard, seat, {
                steps: [pawnStep(seat, 1, ByShip, 'ship', { vessel: 'board' })]
            })
        ).toBe('That pawn is already aboard.')
    })
})

describe('Move: ferries', () => {
    const Quay: SpaceId = 'space.desert.4'
    const Across: SpaceId = 'space.desert.5'
    const Fare = { ferry: true } as const

    it('R-4.2.3 refuses a ferry while a vessel is for sale', () => {
        const { table, playerId } = tableWith((state, seat) => {
            standPawn(state, seat, 1, Quay)
        })
        expect(
            refused(table, playerId, { steps: [pawnStep(playerId, 1, Across, 'ferry', Fare)] })
        ).toBe('Ferries run only while no vessel is for sale.')
    })

    it('R-4.2.3 charges 2 shillings to the general supply, per trip', () => {
        const { table, playerId } = tableWith((state, seat) => {
            standPawn(state, seat, 1, Quay)
            standPawn(state, seat, 2, Quay)
            sellOut(state)
        })
        const shillings = table.seat(playerId).shillings
        const supply = table.hydrated().supply.shillings
        const action = sent(table, playerId, {
            steps: [
                pawnStep(playerId, 1, Across, 'ferry', Fare),
                pawnStep(playerId, 1, Quay, 'ferry', Fare)
            ]
        })
        expect(table.seat(playerId).shillings).toBe(shillings - 4)
        expect(table.hydrated().supply.shillings).toBe(supply + 4)
        expect(action).toMatchObject({
            metadata: {
                steps: [
                    { routeId: 'route.ferry.desert-4--desert-5', from: Quay, fare: 2 },
                    { routeId: 'route.ferry.desert-4--desert-5', from: Across, fare: 2 }
                ]
            }
        })
    })

    it('R-4.2.3 refuses a fare the seat no longer holds, after the steps before it', () => {
        const { table, playerId } = tableWith((state, seat) => {
            standPawn(state, seat, 1, Quay)
            standPawn(state, seat, 2, Quay)
            sellOut(state)
            holdShillings(state, seat, 2)
        })
        expect(
            refused(table, playerId, {
                steps: [
                    pawnStep(playerId, 1, Across, 'ferry', Fare),
                    pawnStep(playerId, 2, Across, 'ferry', Fare)
                ]
            })
        ).toBe('A ferry costs 2 shillings.')
    })

    it('R-4.2.3 a ferry step names its fare and no other step does', () => {
        const { table, playerId } = tableWith((state, seat) => {
            standPawn(state, seat, 1, Quay)
            sellOut(state)
        })
        expect(refused(table, playerId, { steps: [pawnStep(playerId, 1, Across, 'ferry')] })).toBe(
            'A ferry step must name its fare.'
        )
        expect(
            refused(table, playerId, { steps: [pawnStep(playerId, 1, Start, 'road', Fare)] })
        ).toBe('Only a ferry charges a fare.')
    })
})

describe('Move: monsters', () => {
    it('R-4.2.4 a pawn on an opposing monster’s space cannot step; other pieces can', () => {
        const { table, playerId } = tableWith((state, seat, opponent) => {
            standPawn(state, seat, 2, 'space.forest.2')
            standMonster(state, 'behemoth', opponent, Start)
        })
        expect(
            refused(table, playerId, { steps: [pawnStep(playerId, 1, 'space.desert.4', 'road')] })
        ).toBe('A monster pins that pawn.')
        send(table, playerId, { steps: [pawnStep(playerId, 2, 'space.forest.1', 'road')] })
        expect(table.seat(playerId).pawns[1].spaceId).toBe('space.forest.1')
    })

    it('R-4.2.4 the seat’s own monster pins nothing', () => {
        const { table, playerId } = tableWith((state, seat) => {
            standMonster(state, 'behemoth', seat, Start)
        })
        expect(
            refused(table, playerId, { steps: [pawnStep(playerId, 1, 'space.desert.4', 'road')] })
        ).toBe(undefined)
    })

    it('R-4.2.4 a pawn stepping onto an opposing monster’s space stops there', () => {
        const { table, playerId } = tableWith((state, seat, opponent) => {
            standPawn(state, seat, 2, Start)
            standMonster(state, 'behemoth', opponent, 'space.desert.4')
        })
        expect(
            refused(table, playerId, {
                steps: [
                    pawnStep(playerId, 1, 'space.desert.4', 'road'),
                    pawnStep(playerId, 1, Start, 'road')
                ]
            })
        ).toBe('A monster pins that pawn.')
    })

    it('R-3.7.1, R-4.2.4 a monster moves by its own media', () => {
        const { table, playerId } = tableWith((state, seat) => {
            standMonster(state, 'behemoth', seat, Start)
        })
        const action = sent(table, playerId, {
            steps: [monsterStep('behemoth', 'space.desert.4', 'road')]
        })
        expect(table.hydrated().monsters.behemoth.spaceId).toBe('space.desert.4')
        expect(action).toMatchObject({
            metadata: {
                steps: [{ routeId: 'route.road.desert-3--desert-4', from: Start }]
            }
        })
    })

    it('R-4.2.4 a monster never uses a vessel, nor a route not its own', () => {
        const { table, playerId } = tableWith((state, seat) => {
            standMonster(state, 'behemoth', seat, 'space.desert.1')
            standMonster(state, 'sea-serpent', seat, 'space.desert.1')
            abandonVessel(state, 'space.desert.1', 'ship')
        })
        expect(
            refused(table, playerId, {
                steps: [monsterStep('behemoth', 'space.desert.2', 'ship')]
            })
        ).toBe("The behemoth can't use that route.")
        expect(
            refused(table, playerId, {
                steps: [monsterStep('sea-serpent', 'space.desert.2', 'ship', { vessel: 'board' })]
            })
        ).toBe('Monsters never use vessels.')
        expect(
            refused(table, playerId, {
                steps: [monsterStep('sea-serpent', 'space.desert.2', 'ship')]
            })
        ).toBe(undefined)
    })

    it('R-4.2.4 a monster that isn’t the seat’s stays put', () => {
        const { table, playerId } = tableWith((state, _seat, opponent) => {
            standMonster(state, 'behemoth', opponent, Start)
        })
        expect(
            refused(table, playerId, { steps: [monsterStep('behemoth', 'space.desert.4', 'road')] })
        ).toBe("That monster isn't yours.")
    })
})

describe('Move: Godspeed', () => {
    it('R-3.7.3 needs a Monk pawn on the board', () => {
        const { table, playerId } = tableWith()
        expect(
            refused(table, playerId, {
                godspeed: { pawn: 1, to: 'space.desert.4', medium: 'road' }
            })
        ).toBe('Godspeed needs a Monk pawn on the board.')
    })

    it('R-3.7.3 moves only a monk', () => {
        const { table, playerId } = tableWith((state, seat) => {
            standPawn(state, seat, 2, 'space.forest.2', 'monk')
        })
        expect(
            refused(table, playerId, {
                godspeed: { pawn: 1, to: 'space.desert.4', medium: 'road' }
            })
        ).toBe('Godspeed moves only a monk.')
    })

    it('R-3.7.3 one monk +1 step past the allowance, naming its medium, whether or not it moved', () => {
        const { table, playerId } = tableWith((state, seat) => {
            standPawn(state, seat, 2, 'space.desert.4', 'monk')
        })
        const action = sent(table, playerId, {
            steps: [
                pawnStep(playerId, 1, 'space.desert.4', 'road'),
                pawnStep(playerId, 1, Start, 'road')
            ],
            godspeed: { pawn: 2, to: 'space.forest.3', medium: 'road' }
        })
        const seat = table.seat(playerId)
        expect(seat.played).toEqual([{ kind: 'move', use: 'special' }])
        expect(seat.pawns[1].spaceId).toBe('space.forest.3')
        expect(action).toMatchObject({
            metadata: {
                steps: [{}, {}],
                godspeed: { routeId: 'route.road.forest-3--desert-4', from: 'space.desert.4' }
            }
        })
    })

    it('R-3.7.3 comes at the end, from where the steps left the monk', () => {
        const { table, playerId } = tableWith((state, seat) => {
            standPawn(state, seat, 1, Start, 'monk')
        })
        send(table, playerId, {
            steps: [pawnStep(playerId, 1, 'space.desert.4', 'road')],
            godspeed: { pawn: 1, to: 'space.forest.3', medium: 'road' }
        })
        expect(table.seat(playerId).pawns[0].spaceId).toBe('space.forest.3')
    })

    it('R-3.7.3, R-4.2 its step is judged like any other: vessel, ferry, pin', () => {
        const pinned = tableWith((state, seat, opponent) => {
            standPawn(state, seat, 1, Start, 'monk')
            standMonster(state, 'behemoth', opponent, Start)
        })
        expect(
            refused(pinned.table, pinned.playerId, {
                godspeed: { pawn: 1, to: 'space.desert.4', medium: 'road' }
            })
        ).toBe('A monster pins that pawn.')

        const { table, playerId } = tableWith((state, seat) => {
            standPawn(state, seat, 1, 'space.desert.4', 'monk')
            sellOut(state)
        })
        const shillings = table.seat(playerId).shillings
        const action = sent(table, playerId, {
            godspeed: { pawn: 1, to: 'space.desert.5', medium: 'ferry', ferry: true }
        })
        expect(table.seat(playerId).shillings).toBe(shillings - 2)
        expect(action).toMatchObject({
            metadata: {
                steps: [],
                godspeed: { routeId: 'route.ferry.desert-4--desert-5', fare: 2 }
            }
        })
    })
})

describe('Move: pilfer', () => {
    const To: SpaceId = 'space.desert.4'
    const step = (playerId: string) => [pawnStep(playerId, 1, To, 'road')]
    const pawn1 = (playerId: string) => ({ kind: 'pawn', playerId, n: 1 }) as const

    it('R-3.7.4 takes a good from the space, naming its source', () => {
        const { table, playerId } = tableWith((state) => {
            state.spaces[To].location.kind = 'town'
            goodOnSpace(state, To)
        })
        const { iron } = table.seat(playerId).goods
        const before = table.hydrated().spaces[To].goods.iron
        const action = sent(table, playerId, {
            steps: step(playerId),
            pilfer: { piece: pawn1(playerId), from: 'space', resource: 'iron' }
        })
        expect(table.seat(playerId).goods.iron).toBe(iron + 1)
        expect(table.hydrated().spaces[To].goods.iron).toBe(before - 1)
        expect(action).toMatchObject({ metadata: { pilfer: { spaceId: To } } })
    })

    it('R-3.7.4 only a piece that moved pilfers', () => {
        const { table, playerId } = tableWith((state, seat) => {
            state.spaces[Start].location.kind = 'town'
            goodOnSpace(state, Start)
            standPawn(state, seat, 2, 'space.forest.2')
        })
        expect(
            refused(table, playerId, {
                steps: [pawnStep(playerId, 2, 'space.forest.1', 'road')],
                pilfer: { piece: pawn1(playerId), from: 'space', resource: 'iron' }
            })
        ).toBe('Only a piece that moved can pilfer.')
        expect(
            refused(table, playerId, {
                pilfer: { piece: pawn1(playerId), from: 'space', resource: 'iron' }
            })
        ).toBe('Only a piece that moved can pilfer.')
    })

    it('R-3.7.4 a piece out and back pilfers where it began', () => {
        const { table, playerId } = tableWith((state, seat) => {
            standPawn(state, seat, 2, 'space.forest.2')
            state.spaces[Start].location.kind = 'town'
            goodOnSpace(state, Start)
        })
        const { iron } = table.seat(playerId).goods
        send(table, playerId, {
            steps: [pawnStep(playerId, 1, To, 'road'), pawnStep(playerId, 1, Start, 'road')],
            pilfer: { piece: pawn1(playerId), from: 'space', resource: 'iron' }
        })
        expect(table.seat(playerId).goods.iron).toBe(iron + 1)
    })

    it('R-3.7.4 a monster that moved pilfers; a pawn after Godspeed pilfers where that left it', () => {
        const monster = tableWith((state, seat) => {
            standMonster(state, 'behemoth', seat, Start)
            state.spaces[To].location.kind = 'town'
            goodOnSpace(state, To)
        })
        const { iron } = monster.table.seat(monster.playerId).goods
        send(monster.table, monster.playerId, {
            steps: [monsterStep('behemoth', To, 'road')],
            pilfer: {
                piece: { kind: 'monster', monsterId: 'behemoth' },
                from: 'space',
                resource: 'iron'
            }
        })
        expect(monster.table.seat(monster.playerId).goods.iron).toBe(iron + 1)

        const { table, playerId } = tableWith((state, seat) => {
            standPawn(state, seat, 1, Start, 'monk')
            state.spaces[To].location.kind = 'town'
            goodOnSpace(state, To)
        })
        expect(
            refused(table, playerId, {
                godspeed: { pawn: 1, to: To, medium: 'road' },
                pilfer: { piece: pawn1(playerId), from: 'space', resource: 'iron' }
            })
        ).toBe(undefined)
    })

    it('R-3.7.4, R-4.2-H1 a pawn that stepped onto an opposing monster’s space may still pilfer', () => {
        const { table, playerId } = tableWith((state, _seat, opponent) => {
            standMonster(state, 'behemoth', opponent, To)
            state.spaces[To].location.kind = 'town'
            goodOnSpace(state, To)
        })
        const { iron } = table.seat(playerId).goods
        send(table, playerId, {
            steps: step(playerId),
            pilfer: { piece: pawn1(playerId), from: 'space', resource: 'iron' }
        })
        expect(table.seat(playerId).goods.iron).toBe(iron + 1)
    })

    it('R-3.7.4 a non-farm location the seat rules is allowed', () => {
        const { table, playerId } = tableWith((state, seat) => {
            state.spaces[To].location.kind = 'town'
            placeMarker(state, seat, To)
            goodOnSpace(state, To)
        })
        expect(
            refused(table, playerId, {
                steps: step(playerId),
                pilfer: { piece: pawn1(playerId), from: 'space', resource: 'iron' }
            })
        ).toBe(undefined)
    })

    it('R-3.7.4 takes from a farm the seat doesn’t rule, never one it does', () => {
        const ruled = tableWith((state, seat) => {
            state.spaces[To].location.kind = 'farm'
            placeMarker(state, seat, To)
            goodOnSpace(state, To)
        })
        expect(
            refused(ruled.table, ruled.playerId, {
                steps: step(ruled.playerId),
                pilfer: { piece: pawn1(ruled.playerId), from: 'farm', resource: 'iron' }
            })
        ).toBe("You can't pilfer from a farm you rule.")

        const { table, playerId } = tableWith((state, _seat, opponent) => {
            state.spaces[To].location.kind = 'farm'
            placeMarker(state, opponent, To)
            goodOnSpace(state, To)
        })
        const { iron } = table.seat(playerId).goods
        send(table, playerId, {
            steps: step(playerId),
            pilfer: { piece: pawn1(playerId), from: 'farm', resource: 'iron' }
        })
        expect(table.seat(playerId).goods.iron).toBe(iron + 1)
    })

    it('R-3.7.4 the source must be what the space is, and hold what is named', () => {
        const { table, playerId } = tableWith((state) => {
            state.spaces[To].location.kind = 'town'
        })
        const pilfer = (from: 'space' | 'farm' | 'landscape', resource: 'iron' | 'shillings') =>
            refused(table, playerId, {
                steps: step(playerId),
                pilfer: { piece: pawn1(playerId), from, resource }
            })
        expect(pilfer('farm', 'iron')).toBe('There is no farm there.')
        expect(pilfer('space', 'iron')).toBe('There is no iron there.')
        expect(pilfer('space', 'shillings')).toBe('Only a landscape holds shillings.')
        expect(pilfer('landscape', 'shillings')).toBe('There is no landscape there.')

        const farm = tableWith((state) => {
            state.spaces[To].location.kind = 'farm'
            goodOnSpace(state, To)
        })
        expect(
            refused(farm.table, farm.playerId, {
                steps: step(farm.playerId),
                pilfer: { piece: pawn1(farm.playerId), from: 'space', resource: 'iron' }
            })
        ).toBe("That space's goods are its farm's harvest.")
    })

    it('R-3.7.4 takes from a landscape not tended by the seat’s serf; a shilling to the seat', () => {
        const { table, playerId } = tableWith((state, seat, opponent) => {
            landscapeOn(state, To, 'silver-mine', 2)
            serfOn(state, To, seat, opponent)
        })
        const { shillings } = table.seat(playerId)
        const action = sent(table, playerId, {
            steps: step(playerId),
            pilfer: { piece: pawn1(playerId), from: 'landscape', resource: 'shillings' }
        })
        expect(table.seat(playerId).shillings).toBe(shillings + 1)
        expect(table.hydrated().spaces[To].landscape?.amount).toBe(1)
        expect(action).toMatchObject({ metadata: { pilfer: { spaceId: To } } })
    })

    it('R-3.7.4 a landscape on a farm the seat rules is still open: only its serf bars it', () => {
        const { table, playerId } = tableWith((state, seat, opponent) => {
            state.spaces[To].location.kind = 'farm'
            landscapeOn(state, To, 'orchard', 1)
            serfOn(state, To, seat, opponent)
        })
        expect(
            refused(table, playerId, {
                steps: step(playerId),
                pilfer: { piece: pawn1(playerId), from: 'landscape', resource: 'food' }
            })
        ).toBe(undefined)
    })

    it('R-3.7.4 never from a landscape the seat’s own serf tends', () => {
        const { table, playerId } = tableWith((state, seat, opponent) => {
            landscapeOn(state, To, 'orchard', 2)
            serfOn(state, To, opponent, seat)
        })
        expect(
            refused(table, playerId, {
                steps: step(playerId),
                pilfer: { piece: pawn1(playerId), from: 'landscape', resource: 'food' }
            })
        ).toBe("You can't pilfer from a landscape your own serf tends.")
    })

    it('R-3.7.4 a landscape gives only what it holds', () => {
        const empty = tableWith((state) => {
            landscapeOn(state, To, 'orchard', 0)
        })
        expect(
            refused(empty.table, empty.playerId, {
                steps: step(empty.playerId),
                pilfer: { piece: pawn1(empty.playerId), from: 'landscape', resource: 'food' }
            })
        ).toBe('That landscape holds no food.')
        const orchard = tableWith((state) => {
            landscapeOn(state, To, 'orchard', 2)
        })
        expect(
            refused(orchard.table, orchard.playerId, {
                steps: step(orchard.playerId),
                pilfer: { piece: pawn1(orchard.playerId), from: 'landscape', resource: 'iron' }
            })
        ).toBe('That landscape holds no iron.')
    })

    it('R-3.7.4 an untended landscape’s food reaches the seat', () => {
        const { table, playerId } = tableWith((state) => {
            landscapeOn(state, To, 'orchard', 2)
        })
        const { food } = table.seat(playerId).goods
        send(table, playerId, {
            steps: step(playerId),
            pilfer: { piece: pawn1(playerId), from: 'landscape', resource: 'food' }
        })
        expect(table.seat(playerId).goods.food).toBe(food + 1)
    })

    it('R-3.7-H2, R-4.3.4 a target becomes one of the seat’s markers from the general supply', () => {
        const { table, playerId } = tableWith((state) => {
            landscapeOn(state, To, 'archery-butt', 2)
        })
        const state = table.hydrated()
        const { influenceSupply } = state.getPlayerState(playerId)
        const { targets } = state.supply
        const inSupply = state.supply.influence[playerId]
        const action = sent(table, playerId, {
            steps: step(playerId),
            pilfer: { piece: pawn1(playerId), from: 'landscape', resource: 'targets' }
        })
        const after = table.hydrated()
        expect(after.getPlayerState(playerId).influenceSupply).toBe(influenceSupply + 1)
        expect(after.supply.influence[playerId]).toBe(inSupply - 1)
        expect(after.supply.targets).toBe(targets + 1)
        expect(action).toMatchObject({ metadata: { pilfer: { spaceId: To, marker: true } } })
    })

    it('R-3.7-H2, R-4.3.4 with none of the seat’s markers in the supply, the target is discarded', () => {
        const { table, playerId } = tableWith((state, seat) => {
            landscapeOn(state, To, 'archery-butt', 2)
            const player = state.getPlayerState(seat)
            player.influenceSupply += state.supply.influence[player.playerId]
            state.supply.influence[player.playerId] = 0
        })
        const { influenceSupply } = table.seat(playerId)
        const { targets } = table.hydrated().supply
        const action = sent(table, playerId, {
            steps: step(playerId),
            pilfer: { piece: pawn1(playerId), from: 'landscape', resource: 'targets' }
        })
        expect(table.seat(playerId).influenceSupply).toBe(influenceSupply)
        expect(table.hydrated().supply.targets).toBe(targets + 1)
        expect(action).toMatchObject({ metadata: { pilfer: { marker: false } } })
    })

    it('R-4.5.2, R-3.7-H2 a seat waiting on a guild for want of a marker joins it at once when a pilfered target gives one', () => {
        const { table, playerId } = tableWith((state, seat) => {
            landscapeOn(state, To, 'archery-butt', 2)
            const player = state.getPlayerState(seat)
            // Every marker placed, then a monk migrated in: 1 Monk star and no marker to show it.
            state.supply.influence[player.playerId] += player.influenceSupply
            player.influenceSupply = 0
            standPawn(state, seat, 2, Start, 'monk')
            state.recomputeRanks(seat)
        })
        const before = table.hydrated()
        expect(conservationBreaks(canonicalOf(before))).toEqual([])
        expect(rankOf(before.guilds.tracks.monk, playerId)).toBeUndefined()

        const action = sent(table, playerId, {
            steps: step(playerId),
            pilfer: { piece: pawn1(playerId), from: 'landscape', resource: 'targets' }
        })

        const after = table.hydrated()
        expect(rankOf(after.guilds.tracks.monk, playerId)).toBe('master')
        expect(after.getPlayerState(playerId).influenceSupply).toBe(0)
        expect(action).toMatchObject({
            metadata: {
                pilfer: { spaceId: To, marker: true },
                rankChanges: [{ guildId: 'monk', playerId, to: 'master' }]
            }
        })
        expect(conservationBreaks(canonicalOf(after))).toEqual([])
    })

    it('R-4.10.2 a pilfered sulfur may go to the barrel, while there is room', () => {
        const { table, playerId } = tableWith((state) => {
            landscapeOn(state, To, 'sulfur-mine', 2)
        })
        const { sulfur } = table.seat(playerId).goods
        send(table, playerId, {
            steps: step(playerId),
            pilfer: {
                piece: pawn1(playerId),
                from: 'landscape',
                resource: 'sulfur',
                sulfurToBarrel: true
            }
        })
        expect(table.seat(playerId).barrel).toBe(1)
        expect(table.seat(playerId).goods.sulfur).toBe(sulfur)

        const full = tableWith((state, seat) => {
            landscapeOn(state, To, 'sulfur-mine', 2)
            const player = state.getPlayerState(seat)
            state.supply.haversack.sulfur -= 3
            player.barrel = 3
        })
        expect(
            refused(full.table, full.playerId, {
                steps: step(full.playerId),
                pilfer: {
                    piece: pawn1(full.playerId),
                    from: 'landscape',
                    resource: 'sulfur',
                    sulfurToBarrel: true
                }
            })
        ).toBe('Your barrel is full.')
        const other = tableWith((state) => {
            landscapeOn(state, To, 'orchard', 2)
        })
        expect(
            refused(other.table, other.playerId, {
                steps: step(other.playerId),
                pilfer: {
                    piece: pawn1(other.playerId),
                    from: 'landscape',
                    resource: 'food',
                    sulfurToBarrel: true
                }
            })
        ).toBe('Only sulfur goes in your barrel.')
    })
})

describe('Move: successful moves', () => {
    const Hand: ActionCardKind[] = ['move', 'repeat', 'tax', 'guild']

    /** Both seats pass cards so the turn comes back to the first after its Move. */
    function repeated(steps: (playerId: string) => MoveStep[]) {
        const table = tableAtPlayingCards(() => ({ cards: Hand }), 2)
        const [playerId, other] = table.order
        send(table, playerId, { steps: steps(playerId) })
        table.send(other, { type: ActionType.ForfeitCard, kind: 'tax' })
        return { table, playerId }
    }

    const out = (playerId: string) => [pawnStep(playerId, 1, 'space.desert.4', 'road')]
    const back = (playerId: string) => [pawnStep(playerId, 1, Start, 'road')]

    it('R-3.7.2 a Move with a step counts, and the first asks nothing more', () => {
        const { table, playerId } = repeated(out)
        expect(table.seat(playerId).successfulMoves).toBe(1)
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
    })

    it('R-3.7.2, R-3.7-H3 a Move with no step is played and doesn’t count', () => {
        const { table, playerId } = repeated(() => [])
        expect(table.seat(playerId).successfulMoves).toBe(0)
        expect(table.seat(playerId).played).toEqual([{ kind: 'move', use: 'regular' }])
    })

    it('R-3.7.2, R-3.7.3 Godspeed’s step alone makes it successful', () => {
        const { table, playerId } = tableWith((state, seat) => {
            standPawn(state, seat, 1, Start, 'monk')
        })
        send(table, playerId, { godspeed: { pawn: 1, to: 'space.desert.4', medium: 'road' } })
        expect(table.seat(playerId).successfulMoves).toBe(1)
    })

    it('R-3.7.5, R-3.15.1 the round’s second, by Repeat, queues the voyage', () => {
        const { table, playerId } = repeated(out)
        const action = sent(table, playerId, { steps: back(playerId), asRepeat: 'repeat' })
        expect(table.seat(playerId).successfulMoves).toBe(2)
        expect(table.seat(playerId).played).toEqual([
            { kind: 'move', use: 'regular' },
            { kind: 'repeat', use: 'regular', replayedKind: 'move' }
        ])
        expect(table.state.machineState).toBe(MachineState.PlacingDisc)
        expect(table.asked).toBe(playerId)
        expect(table.state.flow.turn?.followUps).toEqual([{ kind: 'voyage', playerId }])
        expect(action.revealsInfo).toBeFalsy()
        table.send(playerId, { type: ActionType.PlaceDisc, place: true })
        expect(table.hydrated().voyageTrack[playerId]).toBe(1)
    })

    it('R-3.7.5 a replay with no step isn’t the second', () => {
        const { table, playerId } = repeated(out)
        send(table, playerId, { asRepeat: 'repeat' })
        expect(table.seat(playerId).successfulMoves).toBe(1)
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
    })
})

describe('Move: offers', () => {
    const Quay: SpaceId = 'space.desert.4'

    it('R-3.7.1, R-4.2.4 lists each piece with its ways, pinned ones empty', () => {
        const { table, playerId } = tableWith((state, seat, opponent) => {
            standPawn(state, seat, 2, 'space.forest.2')
            standMonster(state, 'behemoth', seat, 'space.forest.3')
            standMonster(state, 'sea-serpent', opponent, Start)
        })
        const offers = moveOffers(table.hydrated(), playerId)
        expect(offers.allowance).toBe(3)
        expect(offers.stepsLeft).toBe(3)
        expect(offers.pieces.map((offer) => offer.piece)).toEqual([
            { kind: 'pawn', playerId, n: 1 },
            { kind: 'pawn', playerId, n: 2 },
            { kind: 'monster', monsterId: 'behemoth' }
        ])
        expect(offers.pieces[0]).toMatchObject({ pinned: true, ways: [] })
        expect(offers.pieces[1].ways.map((way) => way.to)).toContain('space.forest.1')
    })

    it('R-3.7.1 a draft folds: the piece’s ways start where it now stands, until the allowance is spent', () => {
        const { table, playerId } = tableWith()
        const state = table.hydrated()
        const before = JSON.stringify(state.dehydrate())
        const offers = moveOffers(state, playerId, {
            steps: [pawnStep(playerId, 1, Quay, 'road')]
        })
        expect(JSON.stringify(state.dehydrate())).toBe(before)
        expect(offers.stepsLeft).toBe(0)
        expect(offers.pieces[0]).toMatchObject({ pinned: false, ways: [] })
    })

    it('R-4.2.3 ferries are offered only with no vessel for sale', () => {
        const closed = tableWith((state, seat) => {
            standPawn(state, seat, 1, Quay)
        })
        const ways = (t: Table, playerId: string) =>
            moveOffers(t.hydrated(), playerId).pieces[0].ways.map((way) => way.route.medium)
        expect(ways(closed.table, closed.playerId)).not.toContain('ferry')
        const open = tableWith((state, seat) => {
            standPawn(state, seat, 1, Quay)
            sellOut(state)
        })
        expect(ways(open.table, open.playerId)).toContain('ferry')
    })

    it('R-3.7.3 offers Godspeed only to monks, from where the draft left them', () => {
        const none = tableWith()
        expect(moveOffers(none.table.hydrated(), none.playerId).godspeed).toEqual([])
        const { table, playerId } = tableWith((state, seat) => {
            standPawn(state, seat, 1, Start, 'monk')
        })
        const [offer] = moveOffers(table.hydrated(), playerId, {
            steps: [pawnStep(playerId, 1, Quay, 'road')]
        }).godspeed
        expect(offer.pawn).toBe(1)
        expect(offer.ways.map((way) => way.to)).toContain('space.forest.3')
    })

    it('R-3.7.4 offers each resource the moved piece may take, and nothing else', () => {
        const { table, playerId } = tableWith((state, seat) => {
            standPawn(state, seat, 2, 'space.forest.2')
            state.spaces[Quay].location.kind = 'town'
            goodOnSpace(state, Quay)
            landscapeOn(state, Quay, 'archery-butt', 1)
            goodOnSpace(state, 'space.forest.2')
        })
        const offers = moveOffers(table.hydrated(), playerId, {
            steps: [pawnStep(playerId, 1, Quay, 'road')]
        })
        expect(offers.pilfers).toEqual([
            {
                piece: { kind: 'pawn', playerId, n: 1 },
                spaceId: Quay,
                from: 'space',
                resource: 'iron'
            },
            {
                piece: { kind: 'pawn', playerId, n: 1 },
                spaceId: Quay,
                from: 'landscape',
                resource: 'targets'
            }
        ])
    })
})
