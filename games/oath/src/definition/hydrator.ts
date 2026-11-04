import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import { HydratedSetupChoice, isSetupChoice } from '../actions/setupChoice.js'
import { HydratedTravel, isTravel } from '../actions/travel.js'
import { HydratedMuster, isMuster } from '../actions/muster.js'
import { HydratedTrade, isTrade } from '../actions/trade.js'
import { HydratedSearch, isSearch } from '../actions/search.js'
import { HydratedSearchResolve, isSearchResolve } from '../actions/searchResolve.js'
import { HydratedSearchSwap, isSearchSwap } from '../actions/searchSwap.js'
import { HydratedRecover, isRecover } from '../actions/recover.js'
import { HydratedCampaign, isCampaign } from '../actions/campaign.js'
import { HydratedCampaignSacrifice, isCampaignSacrifice } from '../actions/campaignSacrifice.js'
import {
    HydratedCampaignSkullLosses,
    isCampaignSkullLosses
} from '../actions/campaignSkullLosses.js'
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
import { HydratedClaimDealKept, isClaimDealKept } from '../actions/claimDealKept.js'
import {
    HydratedLeaveDealUnconfirmed,
    isLeaveDealUnconfirmed
} from '../actions/leaveDealUnconfirmed.js'
import { HydratedChooseOath, isChooseOath } from '../actions/chooseOath.js'
import {
    HydratedOfferChronicleCitizenship,
    isOfferChronicleCitizenship
} from '../actions/offerChronicleCitizenship.js'
import {
    HydratedAnswerChronicleCitizenship,
    isAnswerChronicleCitizenship
} from '../actions/answerChronicleCitizenship.js'
import {
    HydratedBuildOrRepairEdifice,
    isBuildOrRepairEdifice
} from '../actions/buildOrRepairEdifice.js'
import {
    HydratedChooseChronicleSuit,
    isChooseChronicleSuit
} from '../actions/chooseChronicleSuit.js'
import { HydratedChooseHealStack, isChooseHealStack } from '../actions/chooseHealStack.js'
import {
    HydratedWriteChronicleStory,
    isWriteChronicleStory
} from '../actions/writeChronicleStory.js'
import { HydratedSkipChronicleStory, isSkipChronicleStory } from '../actions/skipChronicleStory.js'
import { HydratedChronicleStart, isChronicleStart } from '../actions/chronicleStart.js'
import { HydratedChronicleForcedVow, isChronicleForcedVow } from '../actions/chronicleForcedVow.js'
import {
    HydratedChronicleFlipCitizens,
    isChronicleFlipCitizens
} from '../actions/chronicleFlipCitizens.js'
import { HydratedChronicleMap, isChronicleMap } from '../actions/chronicleMap.js'
import {
    HydratedChronicleSettleSuit,
    isChronicleSettleSuit
} from '../actions/chronicleSettleSuit.js'
import { HydratedChronicleAddCards, isChronicleAddCards } from '../actions/chronicleAddCards.js'
import { HydratedChronicleHeal, isChronicleHeal } from '../actions/chronicleHeal.js'
import {
    HydratedChronicleDispossess,
    isChronicleDispossess
} from '../actions/chronicleDispossess.js'
import { HydratedChronicleRelics, isChronicleRelics } from '../actions/chronicleRelics.js'
import { HydratedChronicleRebuild, isChronicleRebuild } from '../actions/chronicleRebuild.js'

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
            case isSearchSwap(data): {
                return new HydratedSearchSwap(data)
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
            case isCampaignSkullLosses(data): {
                return new HydratedCampaignSkullLosses(data)
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
            case isClaimDealKept(data): {
                return new HydratedClaimDealKept(data)
            }
            case isLeaveDealUnconfirmed(data): {
                return new HydratedLeaveDealUnconfirmed(data)
            }
            case isChooseOath(data): {
                return new HydratedChooseOath(data)
            }
            case isOfferChronicleCitizenship(data): {
                return new HydratedOfferChronicleCitizenship(data)
            }
            case isAnswerChronicleCitizenship(data): {
                return new HydratedAnswerChronicleCitizenship(data)
            }
            case isBuildOrRepairEdifice(data): {
                return new HydratedBuildOrRepairEdifice(data)
            }
            case isChooseChronicleSuit(data): {
                return new HydratedChooseChronicleSuit(data)
            }
            case isChooseHealStack(data): {
                return new HydratedChooseHealStack(data)
            }
            case isWriteChronicleStory(data): {
                return new HydratedWriteChronicleStory(data)
            }
            case isSkipChronicleStory(data): {
                return new HydratedSkipChronicleStory(data)
            }
            case isChronicleStart(data): {
                return new HydratedChronicleStart(data)
            }
            case isChronicleForcedVow(data): {
                return new HydratedChronicleForcedVow(data)
            }
            case isChronicleFlipCitizens(data): {
                return new HydratedChronicleFlipCitizens(data)
            }
            case isChronicleMap(data): {
                return new HydratedChronicleMap(data)
            }
            case isChronicleSettleSuit(data): {
                return new HydratedChronicleSettleSuit(data)
            }
            case isChronicleAddCards(data): {
                return new HydratedChronicleAddCards(data)
            }
            case isChronicleHeal(data): {
                return new HydratedChronicleHeal(data)
            }
            case isChronicleDispossess(data): {
                return new HydratedChronicleDispossess(data)
            }
            case isChronicleRelics(data): {
                return new HydratedChronicleRelics(data)
            }
            case isChronicleRebuild(data): {
                return new HydratedChronicleRebuild(data)
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
