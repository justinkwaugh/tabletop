import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import { HydratedChooseFavours, isChooseFavours } from '../actions/chooseFavours.js'
import {
    HydratedChooseStartingGoods,
    isChooseStartingGoods
} from '../actions/chooseStartingGoods.js'
import { HydratedFinaliseHand, isFinaliseHand } from '../actions/finaliseHand.js'
import { HydratedForfeitCard, isForfeitCard } from '../actions/forfeitCard.js'
import { HydratedAnswerAttack, isAnswerAttack } from '../actions/answerAttack.js'
import { HydratedAnswerStarve, isAnswerStarve } from '../actions/answerStarve.js'
import {
    HydratedReclaimImmunitySeal,
    isReclaimImmunitySeal
} from '../actions/reclaimImmunitySeal.js'
import { HydratedStarveThePeople, isStarveThePeople } from '../actions/starveThePeople.js'
import { HydratedCommitAttack, isCommitAttack } from '../actions/commitAttack.js'
import { HydratedConquer, isConquer } from '../actions/conquer.js'
import { HydratedHarvest, isHarvest } from '../actions/harvest.js'
import { HydratedImprove, isImprove } from '../actions/improve.js'
import { HydratedInfluence, isInfluence } from '../actions/influence.js'
import { HydratedMigrate, isMigrate } from '../actions/migrate.js'
import { HydratedMove, isMove } from '../actions/move.js'
import { HydratedPlaceDisc, isPlaceDisc } from '../actions/placeDisc.js'
import { HydratedPlaceStartingPawn, isPlaceStartingPawn } from '../actions/placeStartingPawn.js'
import { HydratedPlayDefend, isPlayDefend } from '../actions/playDefend.js'
import { HydratedDiscardWrit, isDiscardWrit } from '../actions/discardWrit.js'
import { HydratedPlaceVessel, isPlaceVessel } from '../actions/placeVessel.js'
import { HydratedPlayMandate, isPlayMandate } from '../actions/playMandate.js'
import { HydratedSealCharter, isSealCharter } from '../actions/sealCharter.js'
import { HydratedSpendRegionTile, isSpendRegionTile } from '../actions/spendRegionTile.js'
import { HydratedExplore, isExplore } from '../actions/explore.js'
import { HydratedKeepWrits, isKeepWrits } from '../actions/keepWrits.js'
import { HydratedFeast, isFeast } from '../actions/feast.js'
import { HydratedGuildAction, isGuildAction } from '../actions/guildAction.js'
import { HydratedTax, isTax } from '../actions/tax.js'
import { HydratedTendLandscape, isTendLandscape } from '../actions/tendLandscape.js'
import { HydratedFeudumGameState, type FeudumProjectedState } from '../model/gameState.js'

export class FeudumHydrator implements GameHydrator<FeudumProjectedState, HydratedFeudumGameState> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isChooseStartingGoods(data): {
                return new HydratedChooseStartingGoods(data)
            }
            case isPlaceStartingPawn(data): {
                return new HydratedPlaceStartingPawn(data)
            }
            case isFinaliseHand(data): {
                return new HydratedFinaliseHand(data)
            }
            case isForfeitCard(data): {
                return new HydratedForfeitCard(data)
            }
            case isPlayDefend(data): {
                return new HydratedPlayDefend(data)
            }
            case isMigrate(data): {
                return new HydratedMigrate(data)
            }
            case isInfluence(data): {
                return new HydratedInfluence(data)
            }
            case isTax(data): {
                return new HydratedTax(data)
            }
            case isGuildAction(data): {
                return new HydratedGuildAction(data)
            }
            case isFeast(data): {
                return new HydratedFeast(data)
            }
            case isExplore(data): {
                return new HydratedExplore(data)
            }
            case isKeepWrits(data): {
                return new HydratedKeepWrits(data)
            }
            case isDiscardWrit(data): {
                return new HydratedDiscardWrit(data)
            }
            case isPlayMandate(data): {
                return new HydratedPlayMandate(data)
            }
            case isSealCharter(data): {
                return new HydratedSealCharter(data)
            }
            case isSpendRegionTile(data): {
                return new HydratedSpendRegionTile(data)
            }
            case isPlaceVessel(data): {
                return new HydratedPlaceVessel(data)
            }
            case isImprove(data): {
                return new HydratedImprove(data)
            }
            case isTendLandscape(data): {
                return new HydratedTendLandscape(data)
            }
            case isHarvest(data): {
                return new HydratedHarvest(data)
            }
            case isConquer(data): {
                return new HydratedConquer(data)
            }
            case isAnswerAttack(data): {
                return new HydratedAnswerAttack(data)
            }
            case isCommitAttack(data): {
                return new HydratedCommitAttack(data)
            }
            case isStarveThePeople(data): {
                return new HydratedStarveThePeople(data)
            }
            case isAnswerStarve(data): {
                return new HydratedAnswerStarve(data)
            }
            case isReclaimImmunitySeal(data): {
                return new HydratedReclaimImmunitySeal(data)
            }
            case isChooseFavours(data): {
                return new HydratedChooseFavours(data)
            }
            case isPlaceDisc(data): {
                return new HydratedPlaceDisc(data)
            }
            case isMove(data): {
                return new HydratedMove(data)
            }
            default: {
                throw new Error(`Unknown action type ${data.type}`)
            }
        }
    }

    hydrateState(state: FeudumProjectedState): HydratedFeudumGameState {
        return new HydratedFeudumGameState(state)
    }
}
