import { BeginDawn } from '../actions/beginDawn.js'
import { ReplenishGuilds } from '../actions/replenishGuilds.js'
import { ReplenishMap } from '../actions/replenishMap.js'
import { CollectLandscapes } from '../actions/collectLandscapes.js'
import { Nourish } from '../actions/nourish.js'
import { ChooseFavours } from '../actions/chooseFavours.js'
import { ChooseStartingGoods } from '../actions/chooseStartingGoods.js'
import { DiscardWrit } from '../actions/discardWrit.js'
import { Explore } from '../actions/explore.js'
import { FinaliseHand } from '../actions/finaliseHand.js'
import { ForfeitCard } from '../actions/forfeitCard.js'
import { AnswerAttack } from '../actions/answerAttack.js'
import { AnswerStarve } from '../actions/answerStarve.js'
import { PlaceVessel } from '../actions/placeVessel.js'
import { PlayMandate } from '../actions/playMandate.js'
import { ReclaimImmunitySeal } from '../actions/reclaimImmunitySeal.js'
import { SpendRegionTile } from '../actions/spendRegionTile.js'
import { RevealPouches } from '../actions/revealPouches.js'
import { StartRound } from '../actions/startRound.js'
import { AdvanceTurn } from '../actions/advanceTurn.js'
import { EndRound } from '../actions/endRound.js'
import { ScoreGame } from '../actions/scoreGame.js'
import { NourishPawns } from '../actions/nourishPawns.js'
import { RollProgressDie } from '../actions/rollProgressDie.js'
import { StarveThePeople } from '../actions/starveThePeople.js'
import { CommitAttack } from '../actions/commitAttack.js'
import { Conquer } from '../actions/conquer.js'
import { Harvest } from '../actions/harvest.js'
import { Improve } from '../actions/improve.js'
import { Influence } from '../actions/influence.js'
import { KeepWrits } from '../actions/keepWrits.js'
import { Migrate } from '../actions/migrate.js'
import { Move } from '../actions/move.js'
import { PlaceDisc } from '../actions/placeDisc.js'
import { PlaceStartingPawn } from '../actions/placeStartingPawn.js'
import { PlayDefend } from '../actions/playDefend.js'
import { Feast } from '../actions/feast.js'
import { GuildAction } from '../actions/guildAction.js'
import { Tax } from '../actions/tax.js'
import { TendLandscape } from '../actions/tendLandscape.js'
import { ActionType } from './actions.js'

export const FeudumApiActions = {
    [ActionType.ChooseStartingGoods]: ChooseStartingGoods,
    [ActionType.PlaceStartingPawn]: PlaceStartingPawn,
    [ActionType.FinaliseHand]: FinaliseHand,
    [ActionType.ForfeitCard]: ForfeitCard,
    [ActionType.PlayDefend]: PlayDefend,
    [ActionType.Migrate]: Migrate,
    [ActionType.Influence]: Influence,
    [ActionType.Tax]: Tax,
    [ActionType.GuildAction]: GuildAction,
    [ActionType.Feast]: Feast,
    [ActionType.Explore]: Explore,
    [ActionType.KeepWrits]: KeepWrits,
    [ActionType.DiscardWrit]: DiscardWrit,
    [ActionType.Improve]: Improve,
    [ActionType.TendLandscape]: TendLandscape,
    [ActionType.Harvest]: Harvest,
    [ActionType.Conquer]: Conquer,
    [ActionType.AnswerAttack]: AnswerAttack,
    [ActionType.CommitAttack]: CommitAttack,
    [ActionType.StarveThePeople]: StarveThePeople,
    [ActionType.AnswerStarve]: AnswerStarve,
    [ActionType.ReclaimImmunitySeal]: ReclaimImmunitySeal,
    [ActionType.ChooseFavours]: ChooseFavours,
    [ActionType.PlaceDisc]: PlaceDisc,
    [ActionType.Move]: Move,
    [ActionType.PlayMandate]: PlayMandate,
    [ActionType.SpendRegionTile]: SpendRegionTile,
    [ActionType.PlaceVessel]: PlaceVessel,
    [ActionType.Nourish]: Nourish,
    [ActionType.CollectLandscapes]: CollectLandscapes,
    [ActionType.StartRound]: StartRound,
    [ActionType.RevealPouches]: RevealPouches,
    [ActionType.AdvanceTurn]: AdvanceTurn,
    [ActionType.NourishPawns]: NourishPawns,
    [ActionType.RollProgressDie]: RollProgressDie,
    [ActionType.BeginDawn]: BeginDawn,
    [ActionType.ReplenishMap]: ReplenishMap,
    [ActionType.ReplenishGuilds]: ReplenishGuilds,
    [ActionType.EndRound]: EndRound,
    [ActionType.ScoreGame]: ScoreGame
}
