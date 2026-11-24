import { addPawn } from '@tabletop/feudum/testing'
import {
    collectTopTile,
    fillLandscape,
    MachineState,
    moveConcealedSeal,
    placeMarker,
    queueFollowUp,
    RegionIds,
    stackTop,
    type ActionCardKind,
    type DiscFollowUp,
    type HydratedFeudumGameState,
    type ImmunityRole,
    type SpaceId
} from '@tabletop/feudum'
import type { FeudumGameSession } from '$lib/model/session.svelte.js'
import { atPlayingCards, emptySpaces, giveGood, returnGoods, type TurnTable } from './turnTable.js'

export interface SeatTable extends TurnTable {
    readonly session: FeudumGameSession
}

type Arrange = (state: HydratedFeudumGameState, turn: TurnTable) => void

/** R-3.2 The seat asked for a card, its session open, once `arrange` has set the table. */
export async function seatedAtCards(
    cards: readonly ActionCardKind[],
    arrange?: Arrange,
    options: Parameters<typeof atPlayingCards>[1] = {}
): Promise<SeatTable> {
    const turn = await atPlayingCards(cards, options)
    turn.host.edit((state) => {
        arrange?.(state, turn)
    })
    return { ...turn, session: await turn.host.openSeat(turn.seat) }
}

/** R-4.10.2 Sulfur from the haversack into this seat's barrel, keeping totals. */
export function fillBarrel(state: HydratedFeudumGameState, playerId: string, count: number): void {
    state.supply.haversack.sulfur -= count
    state.getPlayerState(playerId).barrel += count
}

/** R-1.1 The seat holds exactly this many food, and nothing else. */
export function holdFood(state: HydratedFeudumGameState, playerId: string, count: number): void {
    returnGoods(state, playerId)
    for (let index = 0; index < count; index += 1) {
        giveGood(state, playerId, 'food')
    }
}

/** R-3.14.2 */
export function sealMarker(
    state: HydratedFeudumGameState,
    spaceId: SpaceId,
    role: ImmunityRole
): void {
    moveConcealedSeal(state, { kind: 'pile' }, { kind: 'immunity', spaceId, role })
}

/** R-4.4-H2 The deck holds only this many writs: the rest are gone, and the slots with them. */
export function shortenWritDeck(state: HydratedFeudumGameState, count: number): void {
    const vault = state.requireVault()
    const removed = vault.writDeck.length - count
    vault.writDeck.splice(0, removed)
    state.writDeck.top += removed
}

/** R-4.7, R-4.9.1, R-3.7.5 The seat is asked about this disc; `arrange` sets the table it asks on. */
export async function atDisc(followUp: DiscFollowUp, arrange?: Arrange): Promise<SeatTable> {
    const turn = await atPlayingCards(['move', 'tax', 'guild'])
    turn.host.edit((state) => {
        arrange?.(state, turn)
        queueFollowUp(state, followUp)
        state.machineState = MachineState.PlacingDisc
        state.activePlayerIds = [turn.seat]
    })
    return { ...turn, session: await turn.host.openSeat(turn.seat) }
}

/** R-4.10, R-4.10-H4 The seat is the one nourishing asks; `arrange` sets what it feeds, and with what. */
export async function atNourishing(arrange: Arrange): Promise<SeatTable> {
    const turn = await atPlayingCards(['move', 'tax', 'guild'])
    turn.host.edit((state) => {
        arrange(state, turn)
        state.flow.turn = undefined
        state.flow.nourish = { pending: [turn.seat] }
        state.machineState = MachineState.Nourishing
        state.activePlayerIds = [turn.seat]
    })
    return { ...turn, session: await turn.host.openSeat(turn.seat) }
}

/** R-4.10-H4 The seat and the next are asked at once; the third seat watches. */
export async function atNourishingTogether(arrange: Arrange): Promise<SeatTable> {
    const turn = await atPlayingCards(['move', 'tax', 'guild'])
    turn.host.edit((state) => {
        arrange(state, turn)
        const pending = state.turnManager.turnOrder.filter(
            (playerId) => playerId === turn.seat || playerId === turn.other
        )
        state.flow.turn = undefined
        state.flow.nourish = { pending }
        state.machineState = MachineState.Nourishing
        state.activePlayerIds = [...pending]
    })
    return { ...turn, session: await turn.host.openSeat(turn.seat) }
}

/** R-4.1 Three pawns on the board for this seat, whatever it had. */
export function threePawns(state: HydratedFeudumGameState, playerId: string): void {
    const onBoard = state.getPlayerState(playerId).pawns.filter((pawn) => pawn.spaceId)
    for (let count = onBoard.length; count < 3; count += 1) {
        addPawn(state, playerId, 'farmer', emptySpaces(state, 'town')[count])
    }
    state.recomputeRanks()
}

/** R-4.3.4, R-4.12.3 The seat, a serf on two filled landscapes under the next seat, is asked to collect. */
export async function atCollecting(): Promise<SeatTable & { readonly spaces: readonly SpaceId[] }> {
    const turn = await atPlayingCards(['move', 'tax', 'guild'])
    const spaces: SpaceId[] = []
    turn.host.edit((state) => {
        const [first, second] = RegionIds.filter((id) => stackTop(state, id)?.epoch === 1)
        const farms = emptySpaces(state, 'farm')
        for (const [index, region] of [first, second].entries()) {
            const spaceId = farms[index]
            placeMarker(state, turn.other, spaceId)
            placeMarker(state, turn.seat, spaceId)
            const { id } = collectTopTile(state, turn.other, region).tile
            const ruler = state.getPlayerState(turn.other)
            ruler.regionTiles = ruler.regionTiles.filter((held) => held !== id)
            state.spaces[spaceId].landscape = { tileId: id, amount: 0 }
            fillLandscape(state, spaceId)
            spaces.push(spaceId)
        }
        state.flow.turn = undefined
        state.flow.landscapes = { pending: [turn.seat] }
        state.machineState = MachineState.CollectingLandscapes
        state.activePlayerIds = [turn.seat]
    })
    return { ...turn, spaces, session: await turn.host.openSeat(turn.seat) }
}
