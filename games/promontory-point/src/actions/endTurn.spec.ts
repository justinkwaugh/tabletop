import { Visibility, assertExists, playerUndoReach, type Game } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import type { RailroadId } from '../components/railroads.js'
import { MachineState } from '../definition/states.js'
import type { PromontoryPointGameState } from '../model/gameState.js'
import { openSpaceIds } from '../rules/network.js'
import { withEmptyBag } from '../testing/fixtures.js'
import { startGame } from '../testing/startGame.js'
import { withNoRoomFor, withPlacementsMade, withTurnPieces } from '../testing/turnPieces.js'
import {
    action,
    actionEngine,
    edited,
    playerOf,
    revealedTurn,
    turnPlayer
} from '../testing/turns.js'
import {
    END_TURN_DRAW,
    EndTurn,
    EndTurnMetadata,
    EndTurnRefusal,
    LeftoverChoice,
    VARIANT_FULL_DRAW
} from './endTurn.js'

const CP = 'railroad.cp'
const UP = 'railroad.up'
const KP = 'railroad.kp'
const SP = 'railroad.sp'

function endTurn(
    game: Game,
    state: PromontoryPointGameState,
    fields: { returnKeptPiece?: boolean; playerId?: string } = {}
) {
    return actionEngine.executeCanonicalAction({
        action: action(EndTurn, state, { playerId: turnPlayer(state), ...fields }),
        state,
        game
    })
}

// R-2.2 step 3: each named piece placed on a space open to it, one after another.
function placed(state: PromontoryPointGameState, pieces: RailroadId[]): PromontoryPointGameState {
    return pieces.reduce((current, railroadId) => {
        const [spaceId] = openSpaceIds(current.track, railroadId)
        assertExists(spaceId, `A space is open to ${railroadId}`)
        return withPlacementsMade(current, [[spaceId, railroadId]])
    }, state)
}

function afterPlacing(state: PromontoryPointGameState): PromontoryPointGameState {
    return edited(state, (draft) => {
        draft.machineState = MachineState.TradingAfterPlacing
    })
}

// The turn's pieces named, the listed ones placed, and trading open after the placements.
function endingTurn(
    pieces: RailroadId[],
    toPlace: RailroadId[],
    options: {
        variant?: boolean
        edit?: (state: PromontoryPointGameState) => PromontoryPointGameState
    } = {}
) {
    const { game, state } = startGame({ config: { fourPieceVariant: options.variant === true } })
    const revealed = withTurnPieces(revealedTurn(game, state), pieces)
    const edit = options.edit ?? ((current: PromontoryPointGameState) => current)
    return { game, state: afterPlacing(placed(edit(revealed), toPlace)) }
}

function topOfBag(state: PromontoryPointGameState, count: number): RailroadId[] {
    return state.bag.items.slice(state.bag.remaining - count)
}

describe('EndTurn', () => {
    it('R-2.2 step 4: draws three concealed pieces from the top of the bag and closes the turn', () => {
        const { game, state } = endingTurn([CP, UP, SP], [CP, UP, SP])
        const playerId = turnPlayer(state)
        const expected = topOfBag(state, END_TURN_DRAW)

        const { processedActions, updatedState } = endTurn(game, state)

        expect(playerOf(updatedState, playerId)).toMatchObject({
            hand: expected,
            handCount: END_TURN_DRAW
        })
        expect(playerOf(updatedState, playerId).keptPiece).toBeUndefined()
        expect(updatedState.bag.remaining).toBe(state.bag.remaining - END_TURN_DRAW)
        expect(updatedState.turn).toBeUndefined()
        expect(processedActions).toHaveLength(1)
        expect(processedActions[0]).toMatchObject({
            revealsInfo: true,
            metadata: { drawn: expected, drawnCount: END_TURN_DRAW }
        })
        expect(processedActions[0]).not.toHaveProperty('metadata.leftover')
    })

    it('R-X.2: always an Undo barrier', () => {
        const { game, state } = endingTurn([CP, UP, SP], [CP, UP, SP])
        const { processedActions } = endTurn(game, state)
        expect(playerUndoReach(processedActions, turnPlayer(state))).toBeUndefined()
    })

    it('R-5: the drawn pieces are for the drawer alone; the count and the choice are public', () => {
        expect(EndTurnMetadata.properties.drawn[Visibility.MetadataKey]).toMatchObject({
            policy: Visibility.Policy.Actor
        })
        expect(Visibility.MetadataKey in EndTurnMetadata.properties.drawnCount).toBe(false)
        expect(Visibility.MetadataKey in EndTurnMetadata.properties.leftover).toBe(false)
    })

    it('R-6.1-H2: draws what is left when the bag runs short', () => {
        const short = (left: number) => (state: PromontoryPointGameState) =>
            edited(state, (draft) => {
                const removed = draft.bag.items.splice(0, draft.bag.remaining - left)
                for (const railroadId of removed) {
                    draft.scrapped[railroadId] += 1
                }
                draft.bag.remaining = left
            })
        const twoLeft = endingTurn([CP, UP, SP], [CP, UP, SP], { edit: short(2) })
        const expected = topOfBag(twoLeft.state, 2)
        const drewTwo = endTurn(twoLeft.game, twoLeft.state)
        expect(playerOf(drewTwo.updatedState, turnPlayer(twoLeft.state)).hand).toEqual(expected)
        expect(drewTwo.updatedState.bag.remaining).toBe(0)
        expect(drewTwo.processedActions[0]).toMatchObject({
            revealsInfo: true,
            metadata: { drawn: expected, drawnCount: 2 }
        })

        const empty = endingTurn([CP, UP, SP], [CP, UP, SP], { edit: withEmptyBag })
        const drewNone = endTurn(empty.game, empty.state)
        expect(playerOf(drewNone.updatedState, turnPlayer(empty.state))).toMatchObject({
            hand: [],
            handCount: 0
        })
        expect(drewNone.processedActions[0]).toMatchObject({
            revealsInfo: true,
            metadata: { drawn: [], drawnCount: 0 }
        })
    })

    it('R-6.3, R-6.3-H2: in the variant keeps the leftover piece face up and draws three', () => {
        const { game, state } = endingTurn([CP, UP, SP, KP], [CP, UP, SP], { variant: true })
        const playerId = turnPlayer(state)
        const expected = topOfBag(state, END_TURN_DRAW)

        const { processedActions, updatedState } = endTurn(game, state, { returnKeptPiece: false })

        expect(playerOf(updatedState, playerId)).toMatchObject({
            keptPiece: KP,
            hand: expected,
            handCount: END_TURN_DRAW
        })
        expect(updatedState.turn).toBeUndefined()
        expect(updatedState.protectedPrng).toEqual(state.protectedPrng)
        expect(processedActions[0]).toMatchObject({
            revealsInfo: true,
            metadata: { drawn: expected, drawnCount: END_TURN_DRAW, leftover: LeftoverChoice.Kept }
        })
    })

    it('R-6.3, R-5: in the variant returns the leftover to the bag, reshuffles from the protected stream and draws four', () => {
        const { game, state } = endingTurn([CP, UP, SP, KP], [CP, UP, SP], { variant: true })
        const playerId = turnPlayer(state)
        assertExists(state.protectedPrng, 'The game has a protected stream')

        const { processedActions, updatedState } = endTurn(game, state, { returnKeptPiece: true })

        const player = playerOf(updatedState, playerId)
        expect(player.keptPiece).toBeUndefined()
        expect(player.hand).toHaveLength(VARIANT_FULL_DRAW)
        expect(player.handCount).toBe(VARIANT_FULL_DRAW)
        expect(updatedState.bag.remaining).toBe(state.bag.remaining + 1 - VARIANT_FULL_DRAW)
        expect(updatedState.protectedPrng?.invocations).toBeGreaterThan(
            state.protectedPrng.invocations
        )
        expect(updatedState.prng).toEqual(state.prng)
        expect(processedActions[0]).toMatchObject({
            revealsInfo: true,
            metadata: {
                drawn: player.hand,
                drawnCount: VARIANT_FULL_DRAW,
                leftover: LeftoverChoice.Returned
            }
        })
    })

    it('R-6.3: in the variant draws four with no leftover piece', () => {
        const { game, state } = endingTurn([CP, UP, SP], [CP, UP, SP], { variant: true })
        const expected = topOfBag(state, VARIANT_FULL_DRAW)

        const { processedActions, updatedState } = endTurn(game, state)

        expect(playerOf(updatedState, turnPlayer(state)).hand).toEqual(expected)
        expect(processedActions[0]).toMatchObject({
            metadata: { drawn: expected, drawnCount: VARIANT_FULL_DRAW }
        })
        expect(() => endTurn(game, state, { returnKeptPiece: true })).toThrow(
            EndTurnRefusal.NoLeftoverPiece
        )
        expect(() => endTurn(game, state, { returnKeptPiece: false })).toThrow(
            EndTurnRefusal.NoLeftoverPiece
        )
    })

    it('R-6.3-H2: in the variant a piece with no open space may be kept instead of scrapped', () => {
        const boxedIn = (state: PromontoryPointGameState) => withNoRoomFor(state, KP, UP)
        const { game, state } = endingTurn([KP, CP, SP, SP], [CP, SP, SP], {
            variant: true,
            edit: boxedIn
        })
        expect(openSpaceIds(state.track, KP)).toEqual([])
        expect(state.turn?.pieces).toEqual([KP])

        const { updatedState } = endTurn(game, state, { returnKeptPiece: false })

        expect(playerOf(updatedState, turnPlayer(state)).keptPiece).toBe(KP)
        expect(updatedState.scrapped).toEqual(state.scrapped)
    })

    it('R-6.3: the keep-or-return choice is refused outside the variant and required with a leftover', () => {
        const base = endingTurn([CP, UP, SP], [CP, UP, SP])
        expect(() => endTurn(base.game, base.state, { returnKeptPiece: false })).toThrow(
            EndTurnRefusal.NotVariant
        )
        expect(() => endTurn(base.game, base.state, { returnKeptPiece: true })).toThrow(
            EndTurnRefusal.NotVariant
        )

        const variant = endingTurn([CP, UP, SP, KP], [CP, UP, SP], { variant: true })
        expect(() => endTurn(variant.game, variant.state)).toThrow(
            EndTurnRefusal.KeepOrReturnUnchosen
        )
    })

    it('R-2.2-H1: is refused until placing has ended, and while a Repairs is being paid', () => {
        const { game, state } = endingTurn([CP, UP, SP], [CP])
        expect(() => endTurn(game, state)).toThrow(EndTurnRefusal.PlacingUnderWay)
        for (const machineState of [MachineState.TradingBeforePlacing, MachineState.Placing]) {
            const placing = edited(state, (draft) => {
                draft.machineState = machineState
            })
            expect(() => endTurn(game, placing)).toThrow(EndTurnRefusal.PlacingUnderWay)
        }
        const paying = edited(state, (draft) => {
            draft.machineState = MachineState.PayingRepairs
        })
        expect(() => endTurn(game, paying)).toThrow(EndTurnRefusal.RepairsPending)
    })

    it('R-2.2: is refused to a seat whose turn it is not', () => {
        const { game, state } = endingTurn([CP, UP, SP], [CP, UP, SP])
        const allActive = edited(state, (draft) => {
            draft.activePlayerIds = [...draft.turnManager.turnOrder]
        })
        expect(() =>
            endTurn(game, allActive, { playerId: allActive.turnManager.turnOrder[1] })
        ).toThrow(EndTurnRefusal.NotTurnPlayer)
    })

    it('R-5: draws from canonical state, never from a submitted field', () => {
        const { game, state } = endingTurn([CP, UP, SP], [CP, UP, SP])
        const expected = topOfBag(state, END_TURN_DRAW)
        const submitted = {
            ...action(EndTurn, state, { playerId: turnPlayer(state) }),
            metadata: { drawn: [KP, KP, KP], drawnCount: 3 }
        }

        const { processedActions, updatedState } = actionEngine.executeCanonicalAction({
            action: submitted,
            state,
            game
        })

        expect(playerOf(updatedState, turnPlayer(state)).hand).toEqual(expected)
        expect(processedActions[0]).toMatchObject({ metadata: { drawn: expected } })
    })
})
