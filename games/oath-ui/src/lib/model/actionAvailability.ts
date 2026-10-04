import {
    ActionType,
    Banner,
    bannerHolder,
    HydratedCampaign,
    HydratedExileCitizen,
    HydratedMoveWarbands,
    HydratedMuster,
    HydratedOfferCitizenship,
    HydratedPeek,
    HydratedLetPeek,
    HydratedPlayFacedownAdviser,
    HydratedRecover,
    HydratedSearch,
    HydratedSelfExile,
    HydratedTrade,
    HydratedTravel,
    HydratedUseActionPower,
    PlayerStatus,
    SearchSource,
    TradeOption,
    freeActionTypesNow,
    reasonFreeActionComesFirst,
    type HydratedOathGameState
} from '@tabletop/oath'
import type { GridAction } from './actionCatalogue.js'
import { unseenPeekSlots } from './relicKnowledge.js'
import { escapeRegExp } from './names.js'

// The engine's own sentence wherever a representative choice exists, else that the list is empty.
export function reasonActionUnavailable(
    gameState: HydratedOathGameState,
    playerId: string,
    type: GridAction,
    nameOf?: (playerId: string) => string
): string | undefined {
    return withPlayerNames(gameState, reasonFor(gameState, playerId, type), nameOf)
}

// Whole ids only: nanoids may begin or end with `-` or `_`, which `\b` does
// not treat as word characters, so lookarounds are used.
function withPlayerNames(
    gameState: HydratedOathGameState,
    reason: string | undefined,
    nameOf?: (playerId: string) => string
): string | undefined {
    if (!reason || !nameOf) return reason
    let text = reason
    for (const seat of gameState.players) {
        const pattern = new RegExp(
            `(?<![A-Za-z0-9_-])${escapeRegExp(seat.playerId)}(?![A-Za-z0-9_-])`,
            'g'
        )
        const name = nameOf(seat.playerId)
        text = text.replace(pattern, () => name)
    }
    return text
}

function reasonFor(
    gameState: HydratedOathGameState,
    playerId: string,
    type: GridAction
): string | undefined {
    const player = gameState.getPlayerState(playerId)
    const freeFirst = reasonFreeActionComesFirst(gameState, playerId, type)
    if (freeFirst) return freeFirst

    switch (type) {
        case ActionType.SelfExile:
            return HydratedSelfExile.reasonCannotSelfExile(gameState, playerId)

        case ActionType.Travel: {
            if (HydratedTravel.legalDestinations(gameState, playerId).length > 0) return undefined
            return player.siteId
                ? 'no destination you can afford — the cheapest Travel is 1 Supply'
                : 'your pawn is not on the map yet'
        }

        case ActionType.Muster: {
            if (HydratedMuster.canDoMuster(gameState, playerId)) return undefined
            const cards = cardsAtSite(gameState, playerId)
            if (cards.length === 0) return 'no card at your site to place favor on'
            return HydratedMuster.reasonCannotMuster(gameState, playerId, cards[0])
        }

        case ActionType.Trade: {
            if (HydratedTrade.canDoTrade(gameState, playerId)) return undefined
            const cards = cardsAtSite(gameState, playerId)
            if (cards.length === 0) return 'no card at your site to trade with'
            // R-5.3.2 — either option alone makes Trade available.
            return (
                HydratedTrade.reasonCannotTrade(
                    gameState,
                    playerId,
                    cards[0],
                    TradeOption.ForFavor
                ) ??
                HydratedTrade.reasonCannotTrade(
                    gameState,
                    playerId,
                    cards[0],
                    TradeOption.ForSecrets
                )
            )
        }

        case ActionType.Search: {
            if (HydratedSearch.canDoSearch(gameState, playerId)) return undefined
            // R-5.1.1 — the discard's flat cost is the more useful sentence.
            return (
                HydratedSearch.reasonCannotSearch(gameState, playerId, SearchSource.Discard) ??
                HydratedSearch.reasonCannotSearch(gameState, playerId, SearchSource.WorldDeck)
            )
        }

        case ActionType.Recover: {
            if (HydratedRecover.canDoRecover(gameState, playerId)) return undefined
            const hasRelic = !!player.siteId && gameState.relicSlotsAt(player.siteId).length > 0
            const anyBanner = Object.values(Banner).some(
                (banner) => bannerHolder(gameState, banner) !== playerId
            )
            if (!hasRelic && !anyBanner) {
                return 'nothing at your site to recover, and you hold both banners'
            }
            return 'you cannot pay for anything recoverable here'
        }

        case ActionType.Campaign: {
            if (HydratedCampaign.canDoCampaign(gameState, playerId)) return undefined
            if (!player.siteId) return 'your pawn is not on the map yet'
            // R-5.5.1 — a defender rules or stands on your site; the bandits only when nobody rules it.
            if (HydratedCampaign.legalDefenders(gameState, playerId).length === 0) {
                return 'nobody at your site to attack'
            }
            return `costs ${HydratedCampaign.supplyCostFor(gameState, playerId)} Supply`
        }

        case ActionType.PlayFacedownAdviser:
            return HydratedPlayFacedownAdviser.legalCards(gameState, playerId).length > 0
                ? undefined
                : 'no facedown adviser to play or discard'

        case ActionType.Peek:
            if (!HydratedPeek.canDoPeek(gameState, playerId)) {
                return 'no facedown relic you may peek at'
            }
            return unseenPeekSlots(gameState, playerId).length > 0
                ? undefined
                : 'you have already seen every relic here'

        case ActionType.LetPeek:
            return HydratedLetPeek.canDoLetPeek(gameState, playerId)
                ? undefined
                : 'no facedown adviser to show, and no Reliquary relic you may show an Exile'

        case ActionType.MoveWarbands:
            return HydratedMoveWarbands.legalMoves(gameState, playerId).length > 0
                ? undefined
                : 'no warbands you may move — you must rule your site'

        case ActionType.ExileCitizen: {
            if (HydratedExileCitizen.canDoExileCitizen(gameState, playerId)) return undefined
            const citizen = gameState.players.find((p) => p.status === PlayerStatus.Citizen)
            if (!citizen) return 'there are no Citizens to exile'
            return HydratedExileCitizen.reasonCannotExile(gameState, playerId, citizen.playerId)
        }

        case ActionType.OfferCitizenship: {
            if (HydratedOfferCitizenship.canDoOfferCitizenship(gameState, playerId)) {
                return undefined
            }
            const exile = gameState.players.find((p) => p.status === PlayerStatus.Exile)
            const space = gameState.reliquarySlots()[0]
            if (!exile) return 'nobody is an Exile to offer Citizenship to'
            if (!space) return 'the Imperial Reliquary is empty, so there is no relic to offer'
            return HydratedOfferCitizenship.reasonCannotOffer(gameState, playerId, {
                exilePlayerId: exile.playerId,
                reliquarySlotId: space.slotId
            })
        }

        // R-6.2 — offered only when some accessible card prints a built, affordable "Action:" power.
        case ActionType.UseActionPower:
            return HydratedUseActionPower.canDoUseActionPower(gameState, playerId)
                ? undefined
                : 'no built, affordable "Action:" power on a card you have access to'
    }
}

function cardsAtSite(gameState: HydratedOathGameState, playerId: string): string[] {
    const siteId = gameState.getPlayerState(playerId).siteId
    if (!siteId) return []
    return gameState.denizensBySite[siteId] ?? []
}

/** R-10.2 — the line above the grid while a granted free action must come next. */
export function freeActionDueLine(
    gameState: HydratedOathGameState,
    playerId: string
): string | undefined {
    const due = freeActionTypesNow(gameState, playerId)
    if (due.length === 0) return undefined
    const names = due.map((type) => (type === ActionType.Travel ? 'Travel' : 'Campaign'))
    return `Your free ${names.join(' or ')} comes next: take it, give it up, or end the Act Phase.`
}
