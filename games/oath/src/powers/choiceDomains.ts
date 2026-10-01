import { HydratedOathGameState } from '../model/gameState.js'
import { Region } from '../model/oathEnums.js'
import { PowerChoiceKind, type PowerChoice } from '../util/powerChoice.js'
import { sitesRuledBy } from '../util/rule.js'
import { denizensAtYourSite, otherPlayersAtYourSite, regionOfPawn } from './vocabulary.js'

// Function declarations: card registrations reach these at module load, inside a `const`'s temporal dead zone.

export function playerChoicesAtYourSite(
    state: HydratedOathGameState,
    playerId: string
): PowerChoice[] {
    return otherPlayersAtYourSite(state, playerId).map((id) => ({
        kind: PowerChoiceKind.Player,
        playerId: id
    }))
}

export function cardChoicesAtYourSite(
    state: HydratedOathGameState,
    playerId: string
): PowerChoice[] {
    return denizensAtYourSite(state, playerId).map((cardId) => ({
        kind: PowerChoiceKind.Card,
        cardId
    }))
}

export function siteChoicesYouRule(state: HydratedOathGameState, playerId: string): PowerChoice[] {
    return sitesRuledBy(state, playerId).map((siteId) => ({ kind: PowerChoiceKind.Site, siteId }))
}

export function otherRegionChoices(state: HydratedOathGameState, playerId: string): PowerChoice[] {
    const mine = regionOfPawn(state, playerId)
    return Object.values(Region)
        .filter((region) => region !== mine)
        .map((region) => ({ kind: PowerChoiceKind.Region, region }))
}
