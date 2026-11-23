import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, Visibility } from '@tabletop/common'
import type { WritId } from '../data/writs.js'
import { ActionType } from '../definition/actions.js'
import { drawWritsToKeep, requireDrawnWrits } from '../model/followUps.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { ComponentCount, WritIdSchema } from '../model/stateSchemas.js'
import { writDeckCount } from '../model/writDeck.js'
import {
    CardPlayFields,
    playCard,
    reasonCardPlayRefused,
    type CardPlayInput,
    type RepeatMode
} from './cardPlay.js'
import { ruledLocationKinds } from '../model/locationDiscs.js'

/** R-3.10.1 */
const ExploreBaseDraw = 2
/** R-3.10.1 */
const ExploreKeep = 1

export type ExploreMetadata = Type.Static<typeof ExploreMetadata>
export const ExploreMetadata = Type.Object({
    /** R-3.10.1, R-4.4-H2 The table sees the count and the keep number. */
    drawnCount: ComponentCount,
    keep: ComponentCount,
    /** R-3.10.1 Actor-known. */
    drawnWritIds: Visibility.protect(Type.Array(WritIdSchema), {
        policy: Visibility.Policy.Actor
    })
})

export type Explore = Type.Static<typeof Explore>
export const Explore = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId', 'revealsInfo']),
        CardPlayFields,
        Type.Object({
            type: Type.Literal(ActionType.Explore),
            playerId: Type.String(),
            /** R-X.2 A writ draw is always a barrier. */
            revealsInfo: Type.Literal(true),
            metadata: Type.Optional(ExploreMetadata)
        })
    ])
)

export const ExploreValidator = Compile(Explore)

export function isExplore(action?: GameAction): action is Explore {
    return action?.type === ActionType.Explore
}

/** R-3.10.1, R-3.10-H1 2 writs + 1 per outpost or feudum ruled beyond the first outpost. */
export function exploreDrawCount(state: HydratedFeudumGameState, playerId: string): number {
    const counted = ruledLocationKinds(state, playerId).filter(
        (kind) => kind === 'outpost' || kind === 'feudum'
    )
    return ExploreBaseDraw + counted.length - 1
}

/** R-3.10.1 */
export function reasonExploreRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    input: CardPlayInput
): string | undefined {
    return (
        reasonCardPlayRefused(state, playerId, 'explore', input) ??
        (ruledLocationKinds(state, playerId).includes('outpost')
            ? undefined
            : 'You rule no outpost.')
    )
}

export interface ExploreOffer {
    /** R-4.4-H2 What the deck will give. */
    readonly drawCount: number
    readonly keep: number
    /** R-X.2 */
    readonly revealsInfo: true
}

/** R-3.10.1, R-4.4-H2 What the press would do, from public state alone: the draw itself is hidden. */
export function exploreOffer(
    state: HydratedFeudumGameState,
    playerId: string,
    input: CardPlayInput = {}
): ExploreOffer | undefined {
    if (reasonExploreRefused(state, playerId, input)) {
        return undefined
    }
    const drawCount = Math.min(exploreDrawCount(state, playerId), writDeckCount(state))
    return { drawCount, keep: Math.min(ExploreKeep, drawCount), revealsInfo: true }
}

export class HydratedExplore extends HydratableAction<typeof Explore> implements Explore {
    declare type: ActionType.Explore
    declare playerId: string
    declare revealsInfo: true
    declare metadata?: ExploreMetadata
    declare asRepeat?: RepeatMode
    declare secondCard?: true

    constructor(data: Explore) {
        super(data, ExploreValidator)
    }

    /** R-3.10.1, R-3.10-H1, R-3.10-H2 The keep comes next; only there is Shovels & Swords decided. */
    apply(state: HydratedFeudumGameState, _context?: MachineContext) {
        const reason = reasonExploreRefused(state, this.playerId, this)
        if (reason) {
            throw Error(reason)
        }
        playCard(state, this.playerId, 'explore', 'regular', this)
        const drawnCount = drawWritsToKeep(
            state,
            { draw: exploreDrawCount(state, this.playerId), keep: ExploreKeep },
            'explore'
        )
        const { writDraw } = state.flow
        let drawnWritIds: WritId[] = []
        if (writDraw) {
            writDraw.shovelsOffered = true
            drawnWritIds = [...requireDrawnWrits(state)]
        }
        this.metadata = { drawnCount, keep: writDraw?.keep ?? 0, drawnWritIds }
    }
}
