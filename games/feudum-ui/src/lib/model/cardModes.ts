import {
    ActionType,
    cardOf,
    conquerOffers,
    defendVp,
    feastOffers,
    guildActionOffers,
    harvestOffers,
    improveOffers,
    improveShortSpaces,
    influenceOffers,
    migrateOffers,
    moveOffers,
    reasonCardPlayRefused,
    reasonExploreRefused,
    reasonImproveRefused,
    reasonInfluenceRefused,
    reasonMigrateRefused,
    reasonPlayDefendRefused,
    reasonSpecialRefused,
    reasonTaxRefused,
    reinforcementsOffered,
    specialOffered,
    StartingSpaceIds,
    starveOffers,
    taxPreview,
    tendLandscapeOffers,
    type ActionCardKind,
    type CardPlayInput,
    type Good,
    type HydratedFeudumGameState
} from '@tabletop/feudum'

export type CardAction =
    | ActionType.Migrate
    | ActionType.Move
    | ActionType.Influence
    | ActionType.Improve
    | ActionType.TendLandscape
    | ActionType.Explore
    | ActionType.Harvest
    | ActionType.Tax
    | ActionType.Conquer
    | ActionType.StarveThePeople
    | ActionType.PlayDefend
    | ActionType.GuildAction
    | ActionType.Feast

export interface TurnContext {
    readonly state: HydratedFeudumGameState
    readonly playerId: string
    readonly nameOf: (playerId: string) => string
}

/** R-3.4 What a card prints for its special, drawn: a good (from the barrel, for Feast) or coin. */
export type PrintedCost =
    | {
          readonly kind: 'good'
          readonly good: Good
          readonly count: number
          readonly barrel?: true
      }
    | { readonly kind: 'shillings'; readonly count: number }

export interface CardMode {
    readonly action: CardAction
    readonly label: string
    readonly shown?: string
    readonly cost?: PrintedCost
    readonly refusal?: string
}

/** R-3.4 What the card prints for its special, as a chip: "1 wood", "1s". */
export function printedCost(kind: ActionCardKind): string | undefined {
    const need = cardOf(kind).special.needs.find(
        (row) => row.kind === 'good' || row.kind === 'shillings' || row.kind === 'barrel-sulfur'
    )
    if (need?.kind === 'good') {
        return `1 ${need.good}`
    }
    if (need?.kind === 'barrel-sulfur') {
        return '1 barrel sulfur'
    }
    return need?.kind === 'shillings' ? `${need.shillings}s` : undefined
}

/** R-3.4 The printed cost as art, beside the special's name; the words stay its accessible name. */
export function specialCost(kind: ActionCardKind): PrintedCost | undefined {
    const need = cardOf(kind).special.needs.find(
        (row) => row.kind === 'good' || row.kind === 'shillings' || row.kind === 'barrel-sulfur'
    )
    if (need?.kind === 'good') {
        return { kind: 'good', good: need.good, count: 1 }
    }
    if (need?.kind === 'barrel-sulfur') {
        return { kind: 'good', good: 'sulfur', count: 1, barrel: true }
    }
    return need?.kind === 'shillings' ? { kind: 'shillings', count: need.shillings } : undefined
}

function special(action: CardAction, kind: ActionCardKind, refusal: string | undefined): CardMode {
    const cost = printedCost(kind)
    const { name } = cardOf(kind).special
    const art = specialCost(kind)
    return {
        ...mode(action, cost ? `${name} · ${cost}` : name, refusal),
        ...(art ? { shown: name, cost: art } : {})
    }
}

function reasonMigrateModeRefused(
    { state, playerId }: TurnContext,
    input: CardPlayInput
): string | undefined {
    const { pawnsOff, pawnsOn, spaces, distantKinSpaces } = migrateOffers(state, playerId)
    if (
        pawnsOn.length > 0 ||
        (pawnsOff.length > 0 && spaces.length + distantKinSpaces.length > 0)
    ) {
        return reasonCardPlayRefused(state, playerId, 'migrate', input)
    }
    return (
        reasonMigrateRefused(state, playerId, {
            ...input,
            pawn: pawnsOff[0],
            onto: { character: 'farmer', spaceId: spaces[0] ?? StartingSpaceIds[0] }
        }) ?? 'No pawn can migrate.'
    )
}

/** R-1.1, R-3.8-H1 Markers short, the refusal is of a full placement rather than of no list. */
function reasonInfluenceModeRefused(
    { state, playerId }: TurnContext,
    input: CardPlayInput
): string | undefined {
    const { spaces, markers, short } = influenceOffers(state, playerId)
    return reasonInfluenceRefused(state, playerId, {
        ...input,
        ...(short ? { spaceIds: spaces.slice(0, markers) } : {})
    })
}

function reasonImproveModeRefused(
    { state, playerId }: TurnContext,
    input: CardPlayInput
): string | undefined {
    const refused = reasonCardPlayRefused(state, playerId, 'improve', input)
    if (refused || improveOffers(state, playerId).length > 0) {
        return refused
    }
    const [short] = improveShortSpaces(state, playerId)
    const spaceId = short ?? state.ruledSpaceIds(playerId)[0]
    if (!spaceId) {
        return 'You rule no location to improve.'
    }
    return (
        reasonImproveRefused(state, playerId, { ...input, spaceId }) ??
        'No location can be improved.'
    )
}

function reasonTendModeRefused(
    { state, playerId }: TurnContext,
    input: CardPlayInput
): string | undefined {
    const refused = reasonCardPlayRefused(state, playerId, 'improve', input)
    if (refused) {
        return refused
    }
    if (!specialOffered(state, playerId, 'improve')) {
        return reasonSpecialRefused(state, playerId, 'improve')
    }
    const { tiles, spaceIds } = tendLandscapeOffers(state, playerId)
    if (tiles.length === 0) {
        return 'You hold no collected tile.'
    }
    return spaceIds.length === 0 ? 'You are serf on no space without a landscape.' : undefined
}

function reasonOfOffers(
    { state, playerId }: TurnContext,
    kind: ActionCardKind,
    input: CardPlayInput,
    none: string,
    hasOffers: () => boolean
): string | undefined {
    return reasonCardPlayRefused(state, playerId, kind, input) ?? (hasOffers() ? undefined : none)
}

/** R-3.7 Refused when no piece can step; the Move draft takes over from here. */
function reasonMoveModeRefused(context: TurnContext, input: CardPlayInput): string | undefined {
    return reasonOfOffers(context, 'move', input, 'Nothing of yours can move.', () =>
        moveOffers(context.state, context.playerId).pieces.some(
            ({ pinned, ways }) => !pinned && ways.length > 0
        )
    )
}

function firstOfferReason(
    offers: readonly { readonly reason?: string }[],
    none: string
): string | undefined {
    return offers.some(({ reason }) => !reason)
        ? undefined
        : (offers.find(({ reason }) => reason)?.reason ?? none)
}

function reasonFeastModeRefused(
    { state, playerId }: TurnContext,
    input: CardPlayInput
): string | undefined {
    const refused = reasonCardPlayRefused(state, playerId, 'guild', input)
    if (refused) {
        return refused
    }
    return specialOffered(state, playerId, 'guild')
        ? firstOfferReason(feastOffers(state, playerId, input), 'No one to feast with.')
        : reasonSpecialRefused(state, playerId, 'guild')
}

/** R-3.12.1, R-3.12-H1 The shillings; Reinforcements is asked once the card is picked. */
function taxLabel({ state, playerId }: TurnContext): string {
    return `Tax · +${taxPreview(state, playerId, { collect: false }).shillings}s`
}

/** R-3.12-H1 Either answer to Reinforcements opens the mode; its flow asks which. */
function reasonTaxModeRefused(
    { state, playerId }: TurnContext,
    input: CardPlayInput
): string | undefined {
    const answered = reinforcementsOffered(state, playerId) ? { ...input, collect: false } : input
    return reasonTaxRefused(state, playerId, answered)
}

type ModeRow = (context: TurnContext, input: CardPlayInput) => CardMode | undefined

function mode(action: CardAction, label: string, refusal: string | undefined): CardMode {
    return { action, label, ...(refusal ? { refusal } : {}) }
}

const Regular =
    (
        action: CardAction,
        kind: ActionCardKind,
        reason: (context: TurnContext, input: CardPlayInput) => string | undefined
    ): ModeRow =>
    (context, input) =>
        mode(action, cardOf(kind).printedName, reason(context, input))

/** R-3.4 Shown only when the need is met. */
const Special =
    (
        action: CardAction,
        kind: ActionCardKind,
        reason: (context: TurnContext, input: CardPlayInput) => string | undefined
    ): ModeRow =>
    (context, input) =>
        specialOffered(context.state, context.playerId, kind)
            ? special(action, kind, reason(context, input))
            : undefined

/** R-3.5 Each card's modes in the panel's order; Repeat has none of its own (R-3.15). */
const CardModes: Readonly<Record<ActionCardKind, readonly ModeRow[]>> = {
    migrate: [Regular(ActionType.Migrate, 'migrate', reasonMigrateModeRefused)],
    move: [Regular(ActionType.Move, 'move', reasonMoveModeRefused)],
    influence: [Regular(ActionType.Influence, 'influence', reasonInfluenceModeRefused)],
    improve: [
        Regular(ActionType.Improve, 'improve', reasonImproveModeRefused),
        Special(ActionType.TendLandscape, 'improve', reasonTendModeRefused)
    ],
    explore: [
        Regular(ActionType.Explore, 'explore', ({ state, playerId }, input) =>
            reasonExploreRefused(state, playerId, input)
        )
    ],
    harvest: [
        Regular(ActionType.Harvest, 'harvest', (context, input) =>
            reasonOfOffers(
                context,
                'harvest',
                input,
                'No farm under 10 goods.',
                () => harvestOffers(context.state, context.playerId).farms.length > 0
            )
        )
    ],
    tax: [
        (context, input) =>
            mode(ActionType.Tax, taxLabel(context), reasonTaxModeRefused(context, input))
    ],
    conquer: [
        Regular(ActionType.Conquer, 'conquer', (context, input) =>
            reasonOfOffers(
                context,
                'conquer',
                input,
                'No target where you have a pawn or monster.',
                () => conquerOffers(context.state, context.playerId, input).length > 0
            )
        ),
        Special(ActionType.StarveThePeople, 'conquer', (context, input) =>
            reasonOfOffers(
                context,
                'conquer',
                input,
                'No subject or serf where your Noble stands.',
                () => starveOffers(context.state, context.playerId, input).length > 0
            )
        )
    ],
    defend: [
        (context, input) =>
            mode(
                ActionType.PlayDefend,
                `Play Defend · +${defendVp()} vp`,
                reasonPlayDefendRefused(context.state, context.playerId, input)
            )
    ],
    repeat: [],
    guild: [
        Regular(ActionType.GuildAction, 'guild', ({ state, playerId }, input) => {
            return (
                reasonCardPlayRefused(state, playerId, 'guild', input) ??
                firstOfferReason(guildActionOffers(state, playerId), 'No guild function is open.')
            )
        }),
        Special(ActionType.Feast, 'guild', reasonFeastModeRefused)
    ]
}

/** R-3.2, R-3.4 What a card can do now, each mode with the engine's refusal. Pure. */
export function cardModes(
    context: TurnContext,
    kind: ActionCardKind,
    input: CardPlayInput
): readonly CardMode[] {
    return CardModes[kind].flatMap((row) => row(context, input) ?? [])
}

/** Not an auto stage: Forfeit stays a legal choice, so a press further on still sends. */
export function loneMode(modes: readonly CardMode[]): CardAction | undefined {
    const enabled = modes.filter(({ refusal }) => !refusal)
    return enabled.length === 1 ? enabled[0].action : undefined
}
