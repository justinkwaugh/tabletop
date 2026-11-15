import { assert, assertExists, Color, Hydratable, PlayerState, Visibility } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { CardIdSchema } from '../components/cards.js'

export type KoenigrufenPlayerState = Type.Static<typeof KoenigrufenPlayerState>
export const KoenigrufenPlayerState = Type.Object({
    ...PlayerState.properties,
    // Everyone sees every hand once an ouvert game has opened them (the state's `handsShown`).
    hand: Visibility.protect(Type.Array(CardIdSchema), {
        policy: Visibility.Policy.anyOf(
            Visibility.Policy.Owner,
            Visibility.Policy.stateEquals('handsShown', true)
        )
    }),
    handCount: Type.Integer({ minimum: 0 }),
    // Declarer's cards laid away after taking talon cards; they count for declarer's side.
    discards: Visibility.protect(Type.Array(CardIdSchema), { policy: Visibility.Policy.Owner }),
    discardCount: Type.Integer({ minimum: 0 }),
    // Cards laid away face up: trumps, or in Farbendreier suit cards.
    shownDiscards: Type.Array(CardIdSchema),
    score: Type.Integer()
})

export const KoenigrufenProjectedPlayerState =
    Visibility.createProjectionSchema(KoenigrufenPlayerState)
export type KoenigrufenProjectedPlayerState = Type.Static<typeof KoenigrufenProjectedPlayerState>
const KoenigrufenProjectedPlayerStateValidator = Compile(KoenigrufenProjectedPlayerState)

export function newPlayerState(playerId: string, color: Color): KoenigrufenPlayerState {
    return {
        playerId,
        color,
        hand: [],
        handCount: 0,
        discards: [],
        discardCount: 0,
        shownDiscards: [],
        score: 0
    }
}

export class HydratedKoenigrufenPlayerState
    extends Hydratable<typeof KoenigrufenProjectedPlayerState>
    implements KoenigrufenProjectedPlayerState
{
    declare playerId: string
    declare color: Color
    declare hand?: string[]
    declare handCount: number
    declare discards?: string[]
    declare discardCount: number
    declare shownDiscards: string[]
    declare score: number

    constructor(data: KoenigrufenProjectedPlayerState) {
        super(data, KoenigrufenProjectedPlayerStateValidator)
    }

    knownHand(): string[] {
        assertExists(this.hand, `Player ${this.playerId}'s hand is hidden`)
        return this.hand
    }

    knownDiscards(): string[] {
        assertExists(this.discards, `Player ${this.playerId}'s discards are hidden`)
        return this.discards
    }

    hasInHand(cardId: string): boolean {
        return this.knownHand().includes(cardId)
    }

    takeIntoHand(cardIds: readonly string[]) {
        this.knownHand().push(...cardIds)
        this.handCount += cardIds.length
    }

    removeFromHand(cardId: string) {
        const hand = this.knownHand()
        const index = hand.indexOf(cardId)
        assert(index >= 0, `Player ${this.playerId} has no ${cardId} in hand`)
        hand.splice(index, 1)
        this.handCount -= 1
    }

    layAway(cardIds: readonly string[], shown: readonly string[]) {
        for (const cardId of cardIds) {
            this.removeFromHand(cardId)
        }
        this.knownDiscards().push(...cardIds)
        this.discardCount += cardIds.length
        this.shownDiscards.push(...shown)
    }

    clearCards() {
        this.hand = []
        this.handCount = 0
        this.discards = []
        this.discardCount = 0
        this.shownDiscards = []
    }
}
