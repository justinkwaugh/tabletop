import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import { HydratedSetupChoice, isSetupChoice } from '../actions/setupChoice.js'
import { HydratedTravel, isTravel } from '../actions/travel.js'
import { HydratedMuster, isMuster } from '../actions/muster.js'
import { HydratedTrade, isTrade } from '../actions/trade.js'
import { HydratedSearch, isSearch } from '../actions/search.js'
import { HydratedSearchResolve, isSearchResolve } from '../actions/searchResolve.js'
import { HydratedRecover, isRecover } from '../actions/recover.js'
import { HydratedCampaign, isCampaign } from '../actions/campaign.js'
import { HydratedCampaignSacrifice, isCampaignSacrifice } from '../actions/campaignSacrifice.js'
import {
    HydratedCampaignDefeatKills,
    isCampaignDefeatKills
} from '../actions/campaignDefeatKills.js'
import { HydratedAnswerConsent, isAnswerConsent } from '../actions/answerConsent.js'
import { HydratedCampaignDefend, isCampaignDefend } from '../actions/campaignDefend.js'
import {
    HydratedCampaignAttackPlans,
    isCampaignAttackPlans
} from '../actions/campaignAttackPlans.js'
import { HydratedUseRestPower, isUseRestPower } from '../actions/useRestPower.js'
import {
    HydratedCampaignResolveVictory,
    isCampaignResolveVictory
} from '../actions/campaignResolveVictory.js'
import { HydratedResolveWake, isResolveWake } from '../actions/resolveWake.js'
import { HydratedEndActPhase, isEndActPhase } from '../actions/endActPhase.js'
import { HydratedForgoFreeAction, isForgoFreeAction } from '../actions/forgoFreeAction.js'
import { HydratedCompleteRest, isCompleteRest } from '../actions/completeRest.js'
import { HydratedRollEndDie, isRollEndDie } from '../actions/rollEndDie.js'
import { HydratedResolveOathkeeper, isResolveOathkeeper } from '../actions/resolveOathkeeper.js'
import { HydratedTransferOathkeeper, isTransferOathkeeper } from '../actions/transferOathkeeper.js'
import {
    HydratedPlayFacedownAdviser,
    isPlayFacedownAdviser
} from '../actions/playFacedownAdviser.js'
import { HydratedUseActionPower, isUseActionPower } from '../actions/useActionPower.js'
import { HydratedPeek, isPeek } from '../actions/peek.js'
import { HydratedLetPeek, isLetPeek } from '../actions/letPeek.js'
import { HydratedMoveWarbands, isMoveWarbands } from '../actions/moveWarbands.js'
import { HydratedOfferCitizenship, isOfferCitizenship } from '../actions/offerCitizenship.js'
import { HydratedAnswerQuestion, isAnswerQuestion } from '../actions/answerQuestion.js'
import {
    HydratedResolveCitizenshipOffer,
    isResolveCitizenshipOffer
} from '../actions/resolveCitizenshipOffer.js'
import { HydratedExileCitizen, isExileCitizen } from '../actions/exileCitizen.js'
import { HydratedSelfExile, isSelfExile } from '../actions/selfExile.js'

export class OathHydrator implements GameHydrator<OathProjectedState, HydratedOathGameState> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isSetupChoice(data): {
                return new HydratedSetupChoice(data)
            }
            case isTravel(data): {
                return new HydratedTravel(data)
            }
            case isMuster(data): {
                return new HydratedMuster(data)
            }
            case isTrade(data): {
                return new HydratedTrade(data)
            }
            case isSearch(data): {
                return new HydratedSearch(data)
            }
            case isSearchResolve(data): {
                return new HydratedSearchResolve(data)
            }
            case isRecover(data): {
                return new HydratedRecover(data)
            }
            case isCampaign(data): {
                return new HydratedCampaign(data)
            }
            case isUseRestPower(data): {
                return new HydratedUseRestPower(data)
            }
            case isCampaignAttackPlans(data): {
                return new HydratedCampaignAttackPlans(data)
            }
            case isCampaignDefend(data): {
                return new HydratedCampaignDefend(data)
            }
            case isCampaignSacrifice(data): {
                return new HydratedCampaignSacrifice(data)
            }
            case isCampaignDefeatKills(data): {
                return new HydratedCampaignDefeatKills(data)
            }
            case isCampaignResolveVictory(data): {
                return new HydratedCampaignResolveVictory(data)
            }
            case isResolveWake(data): {
                return new HydratedResolveWake(data)
            }
            case isEndActPhase(data): {
                return new HydratedEndActPhase(data)
            }
            case isForgoFreeAction(data): {
                return new HydratedForgoFreeAction(data)
            }
            case isCompleteRest(data): {
                return new HydratedCompleteRest(data)
            }
            case isRollEndDie(data): {
                return new HydratedRollEndDie(data)
            }
            case isResolveOathkeeper(data): {
                return new HydratedResolveOathkeeper(data)
            }
            case isTransferOathkeeper(data): {
                return new HydratedTransferOathkeeper(data)
            }
            case isPlayFacedownAdviser(data): {
                return new HydratedPlayFacedownAdviser(data)
            }
            case isUseActionPower(data): {
                return new HydratedUseActionPower(data)
            }
            case isPeek(data): {
                return new HydratedPeek(data)
            }
            case isLetPeek(data): {
                return new HydratedLetPeek(data)
            }
            case isMoveWarbands(data): {
                return new HydratedMoveWarbands(data)
            }
            case isOfferCitizenship(data): {
                return new HydratedOfferCitizenship(data)
            }
            case isResolveCitizenshipOffer(data): {
                return new HydratedResolveCitizenshipOffer(data)
            }
            case isAnswerConsent(data): {
                return new HydratedAnswerConsent(data)
            }
            case isAnswerQuestion(data): {
                return new HydratedAnswerQuestion(data)
            }
            case isExileCitizen(data): {
                return new HydratedExileCitizen(data)
            }
            case isSelfExile(data): {
                return new HydratedSelfExile(data)
            }

            default: {
                throw new Error(`Unknown action type ${data.type}`)
            }
        }
    }

    hydrateState(state: OathProjectedState): HydratedOathGameState {
        return new HydratedOathGameState(state)
    }
}
