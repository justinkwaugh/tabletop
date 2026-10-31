import { ActionType } from './actions.js'
import { SetupChoice } from '../actions/setupChoice.js'
import { Travel } from '../actions/travel.js'
import { Muster } from '../actions/muster.js'
import { Trade } from '../actions/trade.js'
import { Search } from '../actions/search.js'
import { SearchResolve } from '../actions/searchResolve.js'
import { SearchSwap } from '../actions/searchSwap.js'
import { Recover } from '../actions/recover.js'
import { Campaign } from '../actions/campaign.js'
import { CampaignDefend } from '../actions/campaignDefend.js'
import { CampaignAttackPlans } from '../actions/campaignAttackPlans.js'
import { UseRestPower } from '../actions/useRestPower.js'
import { CampaignSkullLosses } from '../actions/campaignSkullLosses.js'
import { CampaignSacrifice } from '../actions/campaignSacrifice.js'
import { CampaignDefeatKills } from '../actions/campaignDefeatKills.js'
import { CampaignResolveVictory } from '../actions/campaignResolveVictory.js'
import { ResolveWake } from '../actions/resolveWake.js'
import { EndActPhase } from '../actions/endActPhase.js'
import { ForgoFreeAction } from '../actions/forgoFreeAction.js'
import { CompleteRest } from '../actions/completeRest.js'
import { RollEndDie } from '../actions/rollEndDie.js'
import { ResolveOathkeeper } from '../actions/resolveOathkeeper.js'
import { TransferOathkeeper } from '../actions/transferOathkeeper.js'

import { PlayFacedownAdviser } from '../actions/playFacedownAdviser.js'
import { UseActionPower } from '../actions/useActionPower.js'
import { Peek } from '../actions/peek.js'
import { LetPeek } from '../actions/letPeek.js'
import { MoveWarbands } from '../actions/moveWarbands.js'
import { OfferCitizenship } from '../actions/offerCitizenship.js'
import { ResolveCitizenshipOffer } from '../actions/resolveCitizenshipOffer.js'
import { AnswerConsent } from '../actions/answerConsent.js'
import { AnswerQuestion } from '../actions/answerQuestion.js'
import { ExileCitizen } from '../actions/exileCitizen.js'
import { SelfExile } from '../actions/selfExile.js'
import { ClaimDealKept } from '../actions/claimDealKept.js'
import { LeaveDealUnconfirmed } from '../actions/leaveDealUnconfirmed.js'
import { ChooseOath } from '../actions/chooseOath.js'
import { OfferChronicleCitizenship } from '../actions/offerChronicleCitizenship.js'
import { AnswerChronicleCitizenship } from '../actions/answerChronicleCitizenship.js'
import { BuildOrRepairEdifice } from '../actions/buildOrRepairEdifice.js'
import { ChooseChronicleSuit } from '../actions/chooseChronicleSuit.js'
import { ChooseHealStack } from '../actions/chooseHealStack.js'
import { WriteChronicleStory } from '../actions/writeChronicleStory.js'
import { SkipChronicleStory } from '../actions/skipChronicleStory.js'
import { ChronicleStart } from '../actions/chronicleStart.js'
import { ChronicleForcedVow } from '../actions/chronicleForcedVow.js'
import { ChronicleFlipCitizens } from '../actions/chronicleFlipCitizens.js'
import { ChronicleMap } from '../actions/chronicleMap.js'
import { ChronicleSettleSuit } from '../actions/chronicleSettleSuit.js'
import { ChronicleAddCards } from '../actions/chronicleAddCards.js'
import { ChronicleHeal } from '../actions/chronicleHeal.js'
import { ChronicleDispossess } from '../actions/chronicleDispossess.js'
import { ChronicleRelics } from '../actions/chronicleRelics.js'
import { ChronicleRebuild } from '../actions/chronicleRebuild.js'

// The backend generates a validated endpoint for each entry.
export const OathApiActions = {
    [ActionType.PlayFacedownAdviser]: PlayFacedownAdviser,
    [ActionType.UseActionPower]: UseActionPower,
    [ActionType.Peek]: Peek,
    [ActionType.LetPeek]: LetPeek,
    [ActionType.MoveWarbands]: MoveWarbands,
    [ActionType.OfferCitizenship]: OfferCitizenship,
    [ActionType.ResolveCitizenshipOffer]: ResolveCitizenshipOffer,
    [ActionType.AnswerConsent]: AnswerConsent,
    [ActionType.AnswerQuestion]: AnswerQuestion,
    [ActionType.ExileCitizen]: ExileCitizen,
    [ActionType.SelfExile]: SelfExile,
    [ActionType.ClaimDealKept]: ClaimDealKept,
    [ActionType.LeaveDealUnconfirmed]: LeaveDealUnconfirmed,

    [ActionType.SetupChoice]: SetupChoice,
    [ActionType.Travel]: Travel,
    [ActionType.Muster]: Muster,
    [ActionType.Trade]: Trade,
    [ActionType.Search]: Search,
    [ActionType.SearchResolve]: SearchResolve,
    [ActionType.SearchSwap]: SearchSwap,
    [ActionType.Recover]: Recover,
    [ActionType.Campaign]: Campaign,
    [ActionType.CampaignAttackPlans]: CampaignAttackPlans,
    [ActionType.CampaignDefend]: CampaignDefend,
    [ActionType.UseRestPower]: UseRestPower,
    [ActionType.CampaignSkullLosses]: CampaignSkullLosses,
    [ActionType.CampaignSacrifice]: CampaignSacrifice,
    [ActionType.CampaignDefeatKills]: CampaignDefeatKills,
    [ActionType.CampaignResolveVictory]: CampaignResolveVictory,
    [ActionType.ResolveWake]: ResolveWake,
    [ActionType.EndActPhase]: EndActPhase,
    [ActionType.ForgoFreeAction]: ForgoFreeAction,
    [ActionType.CompleteRest]: CompleteRest,
    [ActionType.RollEndDie]: RollEndDie,
    [ActionType.ResolveOathkeeper]: ResolveOathkeeper,
    [ActionType.TransferOathkeeper]: TransferOathkeeper,

    [ActionType.ChooseOath]: ChooseOath,
    [ActionType.OfferChronicleCitizenship]: OfferChronicleCitizenship,
    [ActionType.AnswerChronicleCitizenship]: AnswerChronicleCitizenship,
    [ActionType.BuildOrRepairEdifice]: BuildOrRepairEdifice,
    [ActionType.ChooseChronicleSuit]: ChooseChronicleSuit,
    [ActionType.ChooseHealStack]: ChooseHealStack,
    [ActionType.WriteChronicleStory]: WriteChronicleStory,
    [ActionType.SkipChronicleStory]: SkipChronicleStory,
    [ActionType.ChronicleStart]: ChronicleStart,
    [ActionType.ChronicleForcedVow]: ChronicleForcedVow,
    [ActionType.ChronicleFlipCitizens]: ChronicleFlipCitizens,
    [ActionType.ChronicleMap]: ChronicleMap,
    [ActionType.ChronicleSettleSuit]: ChronicleSettleSuit,
    [ActionType.ChronicleAddCards]: ChronicleAddCards,
    [ActionType.ChronicleHeal]: ChronicleHeal,
    [ActionType.ChronicleDispossess]: ChronicleDispossess,
    [ActionType.ChronicleRelics]: ChronicleRelics,
    [ActionType.ChronicleRebuild]: ChronicleRebuild
}
