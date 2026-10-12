import {
    Banner,
    OathType,
    PlayerStatus,
    RecoverTargetKind,
    isCampaignResolveVictory,
    isExileCitizen,
    isOfferCitizenship,
    isPlayFacedownAdviser,
    isRecover,
    isResolveCitizenshipOffer,
    isResolveOathkeeper,
    isSearch,
    isSearchResolve,
    isSelfExile,
    isTransferOathkeeper,
    isUseActionPower,
    type HydratedOathGameState,
    type OathProjectedState
} from '@tabletop/oath'
import { RecordedHistory, type GameAction, type Turn } from '@tabletop/common'
import { nextWin, nextWinDiffers, type NextWin } from './nextWin.js'

/** R-2.11 — the goal a new holder of the title meets. */
export type TitleGoal =
    'peoplesFavor' | 'darkestSecret' | 'mostSites' | 'empireSites' | 'mostRelicsAndBanners'

/** How a banner changed hands, where its record says. */
export type BannerHow =
    | { kind: 'recovered'; paid: number }
    | { kind: 'seized' }
    | { kind: 'conspiracy' }
    | { kind: 'card'; cardId: string }
    | { kind: 'offer'; offererId: string }

export type CitizenHow = { kind: 'offer'; offererId: string } | { kind: 'card'; cardId: string }

export type ExileHow =
    { kind: 'exiled'; byId: string; favor: number } | { kind: 'self'; favor: number; toId?: string }

/** One piece of news, in the order it happened; "Next to win" is always the last. */
export type NewsRow =
    | {
          kind: 'vision'
          actionId: string
          drawerId: string
          /** The power that drew it; none for a world-deck Search. */
          powerCardId?: string
          /** The Visions Drawn track after the draw, which prices the next world-deck Search. */
          visionsDrawn?: number
      }
    | {
          kind: 'banner'
          actionId: string
          banner: Banner
          toId?: string
          fromId?: string
          /** The side it shows after the move, and whether this move turned it there (R-2.5.3). */
          mobSide: boolean
          toMob: boolean
          how?: BannerHow
      }
    | {
          kind: 'title'
          actionId: string
          toId?: string
          fromId?: string
          goal?: TitleGoal
          /** R-2.11.b — the holder chose among the tied. */
          tie?: { tiedWithIds: string[]; chooserId: string }
          /** R-2.11 — a title taken from a Usurper turns back to its Oathkeeper side. */
          sideAgain: boolean
      }
    | { kind: 'usurper'; actionId: string; playerId: string }
    | { kind: 'citizen'; actionId: string; playerId: string; how?: CitizenHow }
    | { kind: 'exile'; actionId: string; playerId: string; how?: ExileHow }
    | { kind: 'nextWin'; now?: NextWin; before?: NextWin }

export interface TurnNews {
    /** The viewer's turn the news opens: its `start`, the key a cleared card is stored under. */
    turnStart: number
    rows: NewsRow[]
}

export interface TurnNewsSource {
    viewerId: string
    /** The displayed state, which closes `actions`. */
    state: OathProjectedState
    /** The whole history from the first action: `hasCompleteHistory`. */
    actions: readonly GameAction[]
    hydrate: (state: OathProjectedState) => HydratedOathGameState
}

/** The public facts the rows compare, per seat and banner. */
interface TableFacts {
    banners: Record<Banner, { holderId?: string; mobSide: boolean }>
    oathkeeperId?: string
    usurper: boolean
    status: Record<string, PlayerStatus>
    visionsDrawn: number
    /** R-2.11.b — the seats the holder may choose among. */
    titleCandidates: string[]
}

interface Sampled {
    facts: TableFacts
    /** The whole state, kept only where a reading of the next win needs it. */
    whole?: OathProjectedState
}

interface Transition {
    before: TableFacts
    after: TableFacts
}

function factsOf(state: Readonly<OathProjectedState>): TableFacts {
    return {
        banners: {
            [Banner.PeoplesFavor]: bannerFacts(state, Banner.PeoplesFavor),
            [Banner.DarkestSecret]: bannerFacts(state, Banner.DarkestSecret)
        },
        oathkeeperId: state.oathkeeperPlayerId,
        usurper: state.oathkeeperIsUsurper === true,
        status: Object.fromEntries(state.players.map((p) => [p.playerId, p.status])),
        visionsDrawn: state.visionsDrawn,
        titleCandidates: state.pendingOathkeeperChoice?.candidates ?? []
    }
}

function bannerFacts(state: Readonly<OathProjectedState>, banner: Banner) {
    const held = state.banners[banner]
    return { holderId: held.holderPlayerId, mobSide: held.mobSide === true }
}

/**
 * The viewer's last closed turn ends with their `CompleteRest`; the table as it stood just before
 * it is the last the viewer saw. A title move that their own Rest caused follows it at once.
 */
function lastClosedTurn(series: readonly Turn[], viewerId: string): Turn | undefined {
    return series.findLast((turn) => turn.playerId === viewerId && turn.end !== undefined)
}

/**
 * What changed for everyone since the viewer's last turn closed, read from the recorded states
 * (`RecordedHistory`, read-only) and from each action's record for how it happened. Undefined
 * unless the viewer's own turn is open and an earlier one of theirs has closed.
 */
export function turnNews(source: TurnNewsSource): TurnNews | undefined {
    const { actions, state, viewerId } = source
    const series = state.turnManager.series
    const current = series.findLast((turn) => turn.end === undefined)
    if (current?.playerId !== viewerId) return undefined
    const closed = lastClosedTurn(series, viewerId)
    if (closed?.end === undefined) return undefined

    // Turn bounds count actions from the first, so with the whole history they are positions.
    const restAt = closed.end - 1
    const windowEnd = Math.min(current.start, actions.length)
    let from = restAt + 1
    while (from < windowEnd && isTransferOathkeeper(actions[from])) from++

    const recorded = sampled(source, restAt, windowEnd)
    const rows = actions
        .slice(from, windowEnd)
        .flatMap((action, i) =>
            rowsOf(action, recorded.transitions.get(action.id), { actions, at: from + i }, state)
        )

    if (recorded.anchor && recorded.now) {
        const before = nextWin(source.hydrate(recorded.anchor))
        const now = nextWin(source.hydrate(recorded.now))
        if (nextWinDiffers(before, now)) rows.push({ kind: 'nextWin', now, before })
    }
    return { turnStart: current.start, rows }
}

/**
 * One reverse pass from the displayed state back to the viewer's Rest: each action's facts before
 * and after, and the two whole states the next win is read on. It stops at an action recorded
 * without an undo patch, so whatever lies behind it has no transition and no anchor.
 */
function sampled(
    source: TurnNewsSource,
    restAt: number,
    windowEnd: number
): {
    transitions: Map<string, Transition>
    anchor?: OathProjectedState
    now?: OathProjectedState
} {
    const slice = source.actions.slice(restAt)
    const history = new RecordedHistory<OathProjectedState>(source.state, slice)
    const samples = history.select((state): Sampled => ({
        facts: factsOf(state),
        whole: state.actionCount === restAt || state.actionCount === windowEnd ? state : undefined
    }))
    const transitions = new Map<string, Transition>()
    for (const [actionId, { before, after }] of samples) {
        if (before) transitions.set(actionId, { before: before.facts, after: after.facts })
    }
    const restAction = slice[0]
    const anchor = restAction ? samples.get(restAction.id)?.before?.whole : undefined
    const nowAction = source.actions[windowEnd]
    const now = nowAction === undefined ? source.state : samples.get(nowAction.id)?.before?.whole
    return { transitions, anchor, now }
}

/** Where an action sits in the history, so its row can read what came before it. */
interface Place {
    actions: readonly GameAction[]
    at: number
}

function rowsOf(
    action: GameAction,
    transition: Transition | undefined,
    place: Place,
    state: OathProjectedState
): NewsRow[] {
    const rows: NewsRow[] = []
    const vision = visionRow(action, transition)
    if (vision) rows.push(vision)
    // A row that compares the table needs this action's undo patch; without it only the record speaks.
    if (!transition) return rows
    const { before, after } = transition
    for (const playerId of Object.keys(after.status)) {
        const was = before.status[playerId]
        const is = after.status[playerId]
        if (was === PlayerStatus.Exile && is === PlayerStatus.Citizen) {
            rows.push({
                kind: 'citizen',
                actionId: action.id,
                playerId,
                how: citizenHow(action, playerId, place)
            })
        } else if (was === PlayerStatus.Citizen && is === PlayerStatus.Exile) {
            rows.push({ kind: 'exile', actionId: action.id, playerId, how: exileHow(action) })
        }
    }
    for (const banner of [Banner.PeoplesFavor, Banner.DarkestSecret]) {
        const was = before.banners[banner]
        const is = after.banners[banner]
        if (was.holderId === is.holderId) continue
        rows.push({
            kind: 'banner',
            actionId: action.id,
            banner,
            toId: is.holderId,
            fromId: was.holderId,
            mobSide: is.mobSide,
            toMob: is.mobSide && !was.mobSide,
            how: bannerHow(action, banner, place)
        })
    }
    if (before.oathkeeperId !== after.oathkeeperId) {
        rows.push({
            kind: 'title',
            actionId: action.id,
            toId: after.oathkeeperId,
            fromId: before.oathkeeperId,
            goal: after.oathkeeperId
                ? titleGoal(state.oathType, after.status[after.oathkeeperId])
                : undefined,
            tie: isResolveOathkeeper(action)
                ? {
                      tiedWithIds: before.titleCandidates.filter(
                          (playerId) => playerId !== action.chosenPlayerId
                      ),
                      chooserId: action.playerId
                  }
                : undefined,
            sideAgain: before.usurper && after.oathkeeperId !== undefined
        })
    } else if (after.oathkeeperId !== undefined && after.usurper && !before.usurper) {
        // R-4.1.3 — an Exile who holds the title at the start of their turn turns it Usurper.
        rows.push({ kind: 'usurper', actionId: action.id, playerId: after.oathkeeperId })
    }
    return rows
}

/** R-5.1.2, R-9.4 — only the public flags: which Vision was drawn is never read. */
function visionRow(action: GameAction, transition: Transition | undefined): NewsRow | undefined {
    if (isSearch(action) && action.metadata?.stoppedOnVision === true) {
        return {
            kind: 'vision',
            actionId: action.id,
            drawerId: action.playerId,
            visionsDrawn: transition?.after.visionsDrawn ?? action.metadata.visionsDrawn
        }
    }
    if (isUseActionPower(action) && action.metadata?.visionDrawn === true) {
        return {
            kind: 'vision',
            actionId: action.id,
            drawerId: action.playerId,
            powerCardId: action.cardId,
            visionsDrawn: transition?.after.visionsDrawn
        }
    }
    return undefined
}

/** A played card's name where the play shows it (a facedown play does not). */
function playedCardId(action: GameAction): string | undefined {
    if (isUseActionPower(action)) return action.cardId
    if (isSearchResolve(action) || isPlayFacedownAdviser(action))
        return action.metadata?.playedCardId
    return undefined
}

/** R-6.6.1 — an offer is made by the Grand Scepter's holder, recorded on the offer itself. */
function offererOf(playerId: string, place: Place): string | undefined {
    for (let i = place.at - 1; i >= 0; i--) {
        const action = place.actions[i]
        if (isOfferCitizenship(action) && action.exilePlayerId === playerId) return action.playerId
    }
    return undefined
}

function citizenHow(action: GameAction, playerId: string, place: Place): CitizenHow | undefined {
    if (isResolveCitizenshipOffer(action)) {
        const offererId = offererOf(playerId, place)
        return offererId ? { kind: 'offer', offererId } : undefined
    }
    const cardId = playedCardId(action)
    return cardId ? { kind: 'card', cardId } : undefined
}

/** R-6.7, R-6.8 — the favor that moved is on the record. */
function exileHow(action: GameAction): ExileHow | undefined {
    if (isExileCitizen(action) && action.metadata) {
        return { kind: 'exiled', byId: action.playerId, favor: action.metadata.favorGiven }
    }
    if (isSelfExile(action) && action.metadata) {
        return {
            kind: 'self',
            favor: action.metadata.favorGiven,
            toId: action.metadata.scepterHolderId
        }
    }
    return undefined
}

function bannerHow(action: GameAction, banner: Banner, place: Place): BannerHow | undefined {
    if (
        isRecover(action) &&
        action.target.kind === RecoverTargetKind.Banner &&
        action.target.banner === banner
    ) {
        const paid = action.metadata?.amountPaid ?? action.amountPaid
        return paid === undefined ? undefined : { kind: 'recovered', paid }
    }
    if (isCampaignResolveVictory(action) && action.metadata?.bannersSeized.includes(banner)) {
        return { kind: 'seized' }
    }
    if (
        (isSearchResolve(action) || isPlayFacedownAdviser(action)) &&
        action.conspiracy?.take.kind === 'banner' &&
        action.conspiracy.take.banner === banner
    ) {
        return { kind: 'conspiracy' }
    }
    if (isResolveCitizenshipOffer(action)) {
        const offererId = offererOf(action.playerId, place)
        return offererId ? { kind: 'offer', offererId } : undefined
    }
    const cardId = playedCardId(action)
    return cardId ? { kind: 'card', cardId } : undefined
}

/** R-2.11 — the Oath's goal; under Supremacy an Imperial holder holds it with the Empire's sites. */
function titleGoal(oathType: OathType, holderStatus: PlayerStatus | undefined): TitleGoal {
    switch (oathType) {
        case OathType.ThePeople:
            return 'peoplesFavor'
        case OathType.Devotion:
            return 'darkestSecret'
        case OathType.Protection:
            return 'mostRelicsAndBanners'
        case OathType.Supremacy:
            return holderStatus === PlayerStatus.Exile || holderStatus === undefined
                ? 'mostSites'
                : 'empireSites'
    }
}
