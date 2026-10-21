import { SearchPlay, Region } from '../model/oathEnums.js'
import { ConspiracyPlay } from '../model/conspiracy.js'
export { SearchPlay }
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, Visibility } from '@tabletop/common'
import { discardRegionFor, HydratedOathGameState } from '../model/gameState.js'
import { HiddenReveal } from '../model/hidden.js'
import { PowerOutcome } from '../model/powerOutcome.js'
import { ActionType } from '../definition/actions.js'
import { effectiveSiteCapacity } from '../util/capacity.js'
import { discardCards } from '../util/discard.js'
import { regionOfPawn, pawnSiteId } from '../util/pawn.js'
import { isFaceupPlay, isIrreversible } from '../util/powerDoorway.js'
import { PowerChoice } from '../util/powerChoice.js'
import { discardTargetOf, runAfter, searchPlayModifiers } from '../util/modifiers.js'
import { commitHiddenOutputs, revealForPlay } from '../util/hiddenInputs.js'
import { discardWitnesses, forgetHand } from '../util/knowledge.js'
import {
    FavorShort,
    favorShortOf,
    playCard,
    playMapChanges,
    reasonCannotPlayCard
} from '../util/cardPlay.js'
import type { PlayMapChanges } from '../powers/registry.js'
import type { ActiveModifier } from '../util/modifiers.js'
import { isAtLeastOathRevision, OathRevision } from '../util/revision.js'

/** R-9.4 */
export function playShowsCard(play: SearchPlay, faceUp: boolean | undefined): boolean {
    return (
        play === SearchPlay.RevealedVision ||
        play === SearchPlay.Conspiracy ||
        isFaceupPlay(play, faceUp)
    )
}

export type SearchResolveMetadata = Type.Static<typeof SearchResolveMetadata>
export const SearchResolveMetadata = Type.Object({
    /** R-7.3.3 */
    ...PowerOutcome.properties,
    discardedCardIds: Visibility.protect(Type.Array(Type.String()), {
        policy: Visibility.Policy.Actor
    }),
    /** R-9.4 — how many cards went to the pile is seen by everyone. */
    discardedCount: Type.Number(),
    /** R-9.4 */
    reveal: Type.Optional(Visibility.protect(HiddenReveal, { policy: Visibility.Policy.Actor })),
    /** R-10.5 — the next region's pile, not the pawn's, unless Bracken named one. */
    discardPileRegion: Type.Enum(Region),
    /** Bracken */
    discardToBottom: Type.Optional(Type.Boolean()),
    /** R-9.4 — only when the play shows it. */
    playedCardId: Type.Optional(Type.String()),
    /** Land Warden — only when the play shows it. */
    secondPlayedCardId: Type.Optional(Type.String()),
    /** Truthful Harp */
    revealedKeptCardId: Type.Optional(Type.String()),
    /** Cracked Horn */
    discardToWorldDeck: Type.Optional(Type.Boolean()),
    /** R-5.1.4.I — with Land Warden, both cards' favor. */
    favorGained: Type.Number(),
    /** R-9.3 — the banks that could not give the favor a site play takes, the site's or a Homeland's. */
    favorShort: Type.Optional(Type.Array(FavorShort)),
    /** Book of Records — one for each card played to a site. */
    secretsGained: Type.Optional(Type.Number()),
    /** R-7.3.3 */
    whenPlayed: Type.Optional(Type.String()),
    /** Land Warden — the second card's When Played power, as it resolved. */
    secondWhenPlayed: Type.Optional(Type.String()),
    /** R-7.1.4 — with Land Warden, the kept card's then the second card's. */
    triggered: Type.Optional(Type.Array(Type.String())),
    /** R-7.3.3 */
    endsActPhase: Type.Optional(Type.Boolean()),
    /** R-11.2 */
    sitePower: Type.Optional(Type.String()),
    /** Land Warden — the second card's Homeland (R-11.2). */
    secondSitePower: Type.Optional(Type.String()),
    /** R-7.4 (Wild Cry, Welcoming Party) */
    modifierNotes: Type.Optional(Type.Array(Type.String()))
})

/** Land Warden — "if you play at least one card to a site". */
export type SearchSecondPlay = Type.Static<typeof SearchSecondPlay>
export const SearchSecondPlay = Type.Object({
    cardId: Visibility.protect(Type.String(), { policy: Visibility.Policy.Actor }),
    play: Type.Enum(SearchPlay),
    faceUp: Type.Optional(Type.Boolean())
})

export type SearchResolve = Type.Static<typeof SearchResolve>
export const SearchResolve = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.SearchResolve),
            playerId: Type.String(),
            /** R-5.1.3, R-9.4 */
            keptCardId: Visibility.protect(Type.String(), { policy: Visibility.Policy.Actor }),
            discardOrder: Visibility.protect(Type.Array(Type.String(), { maxItems: 16 }), {
                policy: Visibility.Policy.Actor
            }),
            play: Type.Enum(SearchPlay),
            /** R-5.1.4.II — advisers may be played either way up. */
            faceUp: Type.Optional(Type.Boolean()),
            conspiracy: Type.Optional(ConspiracyPlay),
            /** R-5.1.4.II, R-7.6.4 — as many as the play puts above the adviser limit. */
            discardedAdviserCardIds: Type.Optional(
                Visibility.protect(Type.Array(Type.String(), { maxItems: 8 }), {
                    policy: Visibility.Policy.Actor
                })
            ),
            /** R-7.3.3 */
            choices: Type.Optional(Type.Array(PowerChoice, { maxItems: 16 })),
            /** R-11.10 (Great Slum) — discarded before the site play. */
            discardFirstCardId: Type.Optional(Type.String()),
            /** New Growth */
            toSiteId: Type.Optional(Type.String()),
            secondPlay: Type.Optional(SearchSecondPlay),
            metadata: Type.Optional(SearchResolveMetadata)
        })
    ])
)

export const SearchResolveValidator = Compile(SearchResolve)

export type SearchResolveChoice = Pick<
    SearchResolve,
    | 'keptCardId'
    | 'discardOrder'
    | 'play'
    | 'faceUp'
    | 'conspiracy'
    | 'discardedAdviserCardIds'
    | 'choices'
    | 'discardFirstCardId'
    | 'toSiteId'
    | 'secondPlay'
>

export function isSearchResolve(action?: GameAction): action is SearchResolve {
    return action?.type === ActionType.SearchResolve
}

export class HydratedSearchResolve
    extends HydratableAction<typeof SearchResolve>
    implements SearchResolve
{
    declare type: ActionType.SearchResolve
    declare playerId: string
    declare keptCardId: string
    declare discardOrder: string[]
    declare play: SearchPlay
    declare faceUp?: boolean
    declare conspiracy?: ConspiracyPlay
    declare discardedAdviserCardIds?: string[]
    declare choices?: PowerChoice[]
    declare discardFirstCardId?: string
    declare toSiteId?: string
    declare secondPlay?: SearchSecondPlay
    declare metadata?: SearchResolveMetadata

    constructor(data: SearchResolve) {
        super(data, SearchResolveValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        const witnesses = discardWitnesses(state)
        const player = state.getPlayerState(this.playerId)
        const reason = HydratedSearchResolve.reasonCannotResolve(state, this.playerId, this)
        if (reason) {
            throw Error(`Cannot resolve search: ${reason}`)
        }
        const keptMapChanges = keptPlayMapChanges(state, this.playerId, this.keptCardId, this)
        const reveal = revealForPlay(state, this)

        const region = regionOfPawn(state, this.playerId)

        const carried = searchPlayModifiers(state)
        state.pendingSearchModifiers = undefined
        const discardTarget = discardTargetOf(state, this.playerId, carried)

        // R-5.1.3, R-10.5 — to the next region's pile, or where Bracken says.
        discardCards(state, this.playerId, this.discardOrder, region, discardTarget)
        player.setHand([])
        forgetHand(state, this.playerId)

        // R-5.1.4
        // Truthful Harp — "you must reveal every card you draw and the card you keep".
        const shown = carried.some((m) => m.hooks.revealsDraw)
        const played = playCard(state, this.playerId, this.keptCardId, this.play, region, {
            faceUp: this.faceUp,
            seen: shown,
            conspiracy: this.conspiracy,
            discardedAdviserCardIds: this.discardedAdviserCardIds,
            choices: this.choices,
            reveal,
            discardTarget,
            carried,
            discardFirstCardId: this.discardFirstCardId,
            toSiteId: this.toSiteId
        })

        // HIDDEN-016 — a hand of one card has nowhere else to go: whoever knew it knows the row it took.
        if (
            this.discardOrder.length === 0 &&
            this.secondPlay === undefined &&
            this.play === SearchPlay.Adviser &&
            this.faceUp !== true &&
            !shown
        )
            for (const knower of witnesses.handSetsByCard.get(this.keptCardId) ?? [])
                if (knower === 'everyone') player.markSeen(this.keptCardId)
                else player.markShown(this.keptCardId, knower)

        // Land Warden
        const second = this.secondPlay
            ? playCard(state, this.playerId, this.secondPlay.cardId, this.secondPlay.play, region, {
                  faceUp: this.secondPlay.faceUp,
                  seen: shown,
                  discardTarget,
                  carried: secondPlayModifiers(state, carried),
                  earlierMapChanges: keptMapChanges
              })
            : undefined

        // R-5.1.4, R-9.4 — a facedown adviser has no suit, so only a shown card reaches the hooks.
        const after = runAfter(state, this.playerId, carried, {
            playedCardId: playShowsCard(this.play, this.faceUp) ? this.keptCardId : undefined,
            playedTo: this.play,
            secondPlayedCardId: shownSecondCardForAfter(state, this.secondPlay)
        })

        const pileDeposits = [
            ...(played.outcome.pileDeposits ?? []),
            ...(second?.outcome.pileDeposits ?? [])
        ]
        const discardedCardIds = [
            ...this.discardOrder,
            ...played.discarded,
            ...(second?.discarded ?? [])
        ]
        // Land Warden — the record holds what both plays did. Of the second play's `PowerOutcome` only its pile
        // deposits can be set, since that play takes no choices and no hidden draw (docs/known-deviations.md).
        const triggered = [...(played.triggered ?? []), ...(second?.triggered ?? [])]
        // R-7.3.3 — either card's power ends the Act Phase. Before revision 12 a Search ended it on the kept card's
        // alone, and recorded the kept card's favor alone (the History of such a game reads as it was recorded).
        const bothPlays = isAtLeastOathRevision(state, OathRevision.EngineFixes8)
        const endsActPhase = bothPlays
            ? played.endsActPhase || second?.endsActPhase
            : played.endsActPhase
        const favorGained = played.favorGained + (bothPlays ? (second?.favorGained ?? 0) : 0)
        const favorShort = favorShortOf([
            ...played.favorTaken,
            ...(bothPlays ? (second?.favorTaken ?? []) : [])
        ])
        this.metadata = {
            ...played.outcome,
            reveal,
            pileDeposits: pileDeposits.length > 0 ? pileDeposits : undefined,
            discardedCardIds,
            discardedCount: discardedCardIds.length,
            playedCardId: playShowsCard(this.play, this.faceUp) ? this.keptCardId : undefined,
            secondPlayedCardId:
                this.secondPlay && playShowsCard(this.secondPlay.play, this.secondPlay.faceUp)
                    ? this.secondPlay.cardId
                    : undefined,
            revealedKeptCardId: shown ? this.keptCardId : undefined,
            discardPileRegion: discardTarget?.region ?? discardRegionFor(region),
            discardToBottom: discardTarget?.bottom || undefined,
            discardToWorldDeck: discardTarget?.worldDeck || undefined,
            favorGained,
            favorShort: favorShort.length > 0 ? favorShort : undefined,
            secretsGained: played.secretsGained + (second?.secretsGained ?? 0) || undefined,
            whenPlayed: played.whenPlayed,
            secondWhenPlayed: second?.whenPlayed,
            triggered: triggered.length > 0 ? triggered : undefined,
            endsActPhase,
            sitePower: played.sitePower,
            secondSitePower: second?.sitePower,
            modifierNotes: after.notes.length > 0 ? after.notes : undefined
        }

        // R-X.3 — the vault is never rolled back, and a card shown to everyone cannot be unseen.
        this.revealsInfo =
            this.metadata.discardedCardIds.length > 0 ||
            this.metadata.playedCardId !== undefined ||
            this.metadata.secondPlayedCardId !== undefined ||
            this.metadata.revealedKeptCardId !== undefined ||
            isIrreversible(this.metadata) ||
            reveal !== undefined
        commitHiddenOutputs(this, state, witnesses)
    }

    static reasonCannotResolve(
        state: HydratedOathGameState,
        playerId: string,
        choice: SearchResolveChoice
    ): string | undefined {
        const player = state.getPlayerState(playerId)

        // R-5.1.3 — one card kept, every other drawn card discarded. Exactly.
        if (!player.knownHand().includes(choice.keptCardId)) {
            return `${choice.keptCardId} was not drawn`
        }
        const second = choice.secondPlay
        if (second) {
            const secondReason =
                reasonCannotPlaySecondCard(state, playerId, choice.keptCardId, second, choice) ??
                reasonCannotPairSecondPlay(state, playerId, choice.play, second, choice.toSiteId)
            if (secondReason) return secondReason
        }
        const expected = player
            .knownHand()
            .filter((id) => id !== choice.keptCardId && id !== second?.cardId)
        if (!HydratedSearchResolve.sameMembers(expected, choice.discardOrder)) {
            return `must discard exactly the cards not kept (${expected.join(', ') || 'none'})`
        }

        // R-5.1.4
        return reasonCannotPlayCard(state, playerId, choice.keptCardId, choice.play, {
            carried: searchPlayModifiers(state),
            discardFirstCardId: choice.discardFirstCardId,
            toSiteId: choice.toSiteId,
            faceUp: choice.faceUp,
            conspiracy: choice.conspiracy,
            discardedAdviserCardIds: choice.discardedAdviserCardIds,
            choices: choice.choices
        })
    }

    static canDoSearchResolve(state: HydratedOathGameState, playerId: string): boolean {
        const player = state.getPlayerState(playerId)
        return player.handCount > 0
    }

    private static sameMembers(a: string[], b: string[]): boolean {
        if (a.length !== b.length) return false
        const counts = new Map<string, number>()
        for (const id of a) counts.set(id, (counts.get(id) ?? 0) + 1)
        for (const id of b) {
            const n = counts.get(id)
            if (!n) return false
            counts.set(id, n - 1)
        }
        return true
    }
}

/**
 * Land Warden — the second drawn card and how it is played. Given the kept card's play, its When Played power is
 * judged on the map that play leaves; without it, on the map as it is.
 */
export function reasonCannotPlaySecondCard(
    state: HydratedOathGameState,
    playerId: string,
    keptCardId: string,
    second: SearchSecondPlay,
    kept?: KeptPlay
): string | undefined {
    const allowed = searchPlayModifiers(state).some((m) => m.hooks.secondPlay)
    if (!allowed) return 'only one drawn card may be played'
    const hand = state.getPlayerState(playerId).knownHand()
    if (second.cardId === keptCardId || !hand.includes(second.cardId))
        return `${second.cardId} is not a second drawn card`
    if (second.play !== SearchPlay.Site && second.play !== SearchPlay.Adviser)
        return 'the second card is played to your site or as an adviser'
    const reason = reasonCannotPlayCard(state, playerId, second.cardId, second.play, {
        faceUp: second.faceUp,
        carried: secondPlayModifiers(state, searchPlayModifiers(state)),
        earlierMapChanges: kept && keptPlayMapChanges(state, playerId, keptCardId, kept)
    })
    return reason ? `second card: ${reason}` : undefined
}

/** Land Warden — the kept card's play, which comes before the second card's. */
type KeptPlay = Pick<
    SearchResolveChoice,
    'play' | 'discardFirstCardId' | 'toSiteId' | 'faceUp' | 'discardedAdviserCardIds'
>

/**
 * Land Warden — the kept card's play lands before the second card's When Played power resolves: its map changes,
 * and what it gains first (R-7.3.3), with the Search's carried modifiers, as `playCard` plays it.
 */
function keptPlayMapChanges(
    state: HydratedOathGameState,
    playerId: string,
    keptCardId: string,
    kept: KeptPlay
): PlayMapChanges {
    return playMapChanges(state, playerId, keptCardId, kept.play, {
        carried: searchPlayModifiers(state),
        discardFirstCardId: kept.discardFirstCardId,
        toSiteId: kept.toSiteId,
        faceUp: kept.faceUp,
        discardedAdviserCardIds: kept.discardedAdviserCardIds
    })
}

/** Land Warden — R-7.4: the Search's modifiers last the whole action, so they reach the second card's play as they reach the first. */
function secondPlayModifiers(
    state: HydratedOathGameState,
    carried: ActiveModifier[]
): ActiveModifier[] | undefined {
    // R-X.4 — a game created before this revision played the second card with no modifier.
    return isAtLeastOathRevision(state, OathRevision.PlanCostsAndSearchPlays) ? carried : undefined
}

/** Land Warden — Wild Cry and Welcoming Party look at both cards played (R-7.4.2: and pay once). */
function shownSecondCardForAfter(
    state: HydratedOathGameState,
    second: SearchSecondPlay | undefined
): string | undefined {
    // R-X.4 — a game created before this revision looked at the kept card only.
    if (!second || !isAtLeastOathRevision(state, OathRevision.PlanCostsAndSearchPlays))
        return undefined
    return playShowsCard(second.play, second.faceUp) ? second.cardId : undefined
}

/**
 * Land Warden — "if you play at least one card to a site", with room for both at your site when both go there.
 * `keptToSiteId` is where the kept card goes: the People's Favor may send it to another site (R-5.1.4.I), and its
 * Q&A lets both cards use it.
 */
export function reasonCannotPairSecondPlay(
    state: HydratedOathGameState,
    playerId: string,
    firstPlay: SearchPlay,
    second: SearchSecondPlay,
    keptToSiteId?: string
): string | undefined {
    if (firstPlay !== SearchPlay.Site && second.play !== SearchPlay.Site)
        return 'Land Warden: at least one of the two cards must be played to a site'
    if (firstPlay === SearchPlay.Site && second.play === SearchPlay.Site) {
        const here = pawnSiteId(state, playerId)
        // Each site's room counts the cards that go there; the second card's own check counts it alone. Before
        // revision 16 (R-X.4), both counted at your site wherever the kept card went.
        const keptHere =
            keptToSiteId === undefined ||
            keptToSiteId === here ||
            !isAtLeastOathRevision(state, OathRevision.EngineFixes12)
        if (keptHere && state.denizensAt(here).length + 2 > effectiveSiteCapacity(state, here))
            return 'no room at your site for two cards'
    }
    return undefined
}
