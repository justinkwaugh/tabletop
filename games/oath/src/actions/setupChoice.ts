import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, Visibility } from '@tabletop/common'
import { HydratedOathGameState, discardRegionFor } from '../model/gameState.js'
import { PlayerStatus, Region } from '../model/oathEnums.js'
import { ActionType } from '../definition/actions.js'
import { TOP_CRADLE_SLOT } from '../data/mapSlots.js'
import { nextSetupPlayerId, takeFavorFromSupply } from '../util/setup.js'
import { discardCards } from '../util/discard.js'
import { commitHiddenOutputs } from '../util/hiddenInputs.js'
import { discardWitnesses } from '../util/knowledge.js'

export type SetupChoiceMetadata = Type.Static<typeof SetupChoiceMetadata>
export const SetupChoiceMetadata = Type.Object({
    /** R-10.5 — the *next* region's pile, not the pawn's own. */
    discardPileRegion: Type.Enum(Region),
    discardedCardIds: Visibility.protect(Type.Array(Type.String()), {
        policy: Visibility.Policy.Actor
    })
})

export type SetupChoice = Type.Static<typeof SetupChoice>
export const SetupChoice = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.SetupChoice),
            playerId: Type.String(),
            /** R-1.23.1 — any one faceup site; the Chancellor's is the top Cradle. */
            siteId: Type.String(),
            /** R-1.23.2, R-9.4 */
            adviserCardId: Visibility.protect(Type.String(), { policy: Visibility.Policy.Actor }),
            /** R-1.23.3, R-10.5 — in placement order. */
            discardOrder: Visibility.protect(Type.Array(Type.String(), { maxItems: 16 }), {
                policy: Visibility.Policy.Actor
            }),
            /** R-1.16 — the Chancellor's split of a bank too short for every site's favor. */
            siteFavor: Type.Optional(
                Type.Array(Type.Object({ siteCardId: Type.String(), favor: Type.Integer() }), {
                    maxItems: 16
                })
            ),
            metadata: Type.Optional(SetupChoiceMetadata)
        })
    ])
)

export const SetupChoiceValidator = Compile(SetupChoice)

export function isSetupChoice(action?: GameAction): action is SetupChoice {
    return action?.type === ActionType.SetupChoice
}

/** R-1.23.1–R-1.23.3, taken as explicit action input per R-X.1. */
export type SetupChoiceInput = Pick<
    SetupChoice,
    'siteId' | 'adviserCardId' | 'discardOrder' | 'siteFavor'
>

/** R-1.16 — only the Chancellor splits, all the bank holds, no site above what it prints. */
function reasonSiteFavorInvalid(
    state: HydratedOathGameState,
    status: PlayerStatus,
    split: SetupChoiceInput['siteFavor']
): string | undefined {
    const pending = state.pendingSiteFavor
    const chancellor = status === PlayerStatus.Chancellor
    if (!pending || !chancellor) {
        return split
            ? "only the Chancellor splits the sites' favor, and only when it runs short"
            : undefined
    }
    if (!split) return 'the favor runs short: the Chancellor chooses how to place it on the sites'
    for (const { siteCardId, favor } of split) {
        const site = pending.find((p) => p.siteCardId === siteCardId)
        if (!site) return `${siteCardId} is not a site waiting for favor`
        if (favor < 0 || favor > site.wanted) {
            return `${siteCardId} takes between 0 and ${site.wanted} favor`
        }
    }
    if (new Set(split.map((s) => s.siteCardId)).size !== split.length) {
        return 'each site is named once'
    }
    const placed = split.reduce((n, s) => n + s.favor, 0)
    if (placed !== state.favorSupply) {
        return `all ${state.favorSupply} favor left in the bank is placed, not ${placed}`
    }
    return undefined
}

export function reasonCannotSetupChoice(
    state: HydratedOathGameState,
    playerId: string,
    choice: SetupChoiceInput
): string | undefined {
    const player = state.getPlayerState(playerId)
    if (player.siteId !== undefined) return 'player has already resolved setup'
    if (nextSetupPlayerId(state) !== playerId) {
        return `R-1.23 resolves in turn order; ${nextSetupPlayerId(state)} is next`
    }

    // R-1.23.1
    if (!state.allSiteIds().includes(choice.siteId)) {
        return `${choice.siteId} is not a site on the map`
    }
    if (!state.isSiteFaceup(choice.siteId)) {
        return `${choice.siteId} is facedown; R-1.23.1 places a pawn on a faceup site`
    }
    if (player.status === PlayerStatus.Chancellor && choice.siteId !== TOP_CRADLE_SLOT) {
        return 'R-1.23.1 puts the Chancellor on the top Cradle site'
    }

    // R-1.23.2, R-1.23.3, R-9.5
    const kept = [choice.adviserCardId, ...choice.discardOrder]
    const hand = [...player.knownHand()].sort()
    if (kept.length !== hand.length || [...kept].sort().join() !== hand.join()) {
        return `R-1.23.2 and R-1.23.3 must name exactly the ${hand.length} cards drawn`
    }
    if (choice.discardOrder.includes(choice.adviserCardId)) {
        return 'a card cannot be both the adviser and discarded'
    }
    const siteFavorReason = reasonSiteFavorInvalid(state, player.status, choice.siteFavor)
    if (siteFavorReason) return siteFavorReason
    return undefined
}

/** R-1.23.1 to R-1.23.3 in order: R-10.5 discards from where the pawn now stands. */
export function applySetupChoice(
    state: HydratedOathGameState,
    playerId: string,
    choice: SetupChoiceInput
): SetupChoiceMetadata {
    const reason = reasonCannotSetupChoice(state, playerId, choice)
    if (reason) {
        throw Error(`Cannot resolve setup for ${playerId}: ${reason}`)
    }
    const player = state.getPlayerState(playerId)

    // R-1.16
    for (const { siteCardId, favor } of choice.siteFavor ?? []) {
        state.addTokensOn(siteCardId, { favor: takeFavorFromSupply(state, favor), secrets: 0 })
    }
    if (choice.siteFavor) state.pendingSiteFavor = undefined

    // R-1.23.1
    player.siteId = choice.siteId

    // R-1.23.2
    player.addAdviser(choice.adviserCardId, false)

    // R-1.23.3
    const region = state.regionOf(choice.siteId)
    player.setHand([])
    discardCards(state, playerId, choice.discardOrder, region)

    return {
        discardPileRegion: discardRegionFor(region),
        discardedCardIds: [...choice.discardOrder]
    }
}

export class HydratedSetupChoice
    extends HydratableAction<typeof SetupChoice>
    implements SetupChoice
{
    declare type: ActionType.SetupChoice
    declare playerId: string
    declare siteId: string
    declare adviserCardId: string
    declare discardOrder: string[]
    declare siteFavor?: { siteCardId: string; favor: number }[]
    declare metadata?: SetupChoiceMetadata

    constructor(data: SetupChoice) {
        super(data, SetupChoiceValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        const witnesses = discardWitnesses(state)
        this.metadata = applySetupChoice(state, this.playerId, this.choice())

        this.revealsInfo = this.metadata.discardedCardIds.length > 0
        commitHiddenOutputs(this, state, witnesses)
    }

    private choice(): SetupChoiceInput {
        return {
            siteId: this.siteId,
            adviserCardId: this.adviserCardId,
            discardOrder: this.discardOrder,
            siteFavor: this.siteFavor
        }
    }

    static reasonCannotSetupChoice(
        state: HydratedOathGameState,
        playerId: string
    ): string | undefined {
        const player = state.getPlayerState(playerId)
        if (player.siteId !== undefined) return 'player has already resolved setup'
        const next = nextSetupPlayerId(state)
        if (next !== playerId) return `R-1.23 resolves in turn order; ${next} is next`
        return undefined
    }

    static canDoSetupChoice(state: HydratedOathGameState, playerId: string): boolean {
        return HydratedSetupChoice.reasonCannotSetupChoice(state, playerId) === undefined
    }

    /** Full validation, the cards named included. */
    static reasonCannotResolve(
        state: HydratedOathGameState,
        playerId: string,
        choice: SetupChoiceInput
    ): string | undefined {
        return reasonCannotSetupChoice(state, playerId, choice)
    }
}
