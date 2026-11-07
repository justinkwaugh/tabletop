import type { HydratedAction, MachineStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import { CollectingLandscapesStateHandler } from '../stateHandlers/collectingLandscapes.js'
import { ChoosingStartingGoodsStateHandler } from '../stateHandlers/choosingStartingGoods.js'
import { DawnStateHandler } from '../stateHandlers/dawn.js'
import { DiscardingWritsStateHandler } from '../stateHandlers/discardingWrits.js'
import { InspectingHarvestStateHandler } from '../stateHandlers/inspectingHarvest.js'
import { KeepingWritsStateHandler } from '../stateHandlers/keepingWrits.js'
import { AwaitingDefenceStateHandler } from '../stateHandlers/awaitingDefence.js'
import { AwaitingImmunityStateHandler } from '../stateHandlers/awaitingImmunity.js'
import { CommittingAttackStateHandler } from '../stateHandlers/committingAttack.js'
import { EndOfRoundStateHandler } from '../stateHandlers/endOfRound.js'
import { NourishingStateHandler } from '../stateHandlers/nourishing.js'
import { ProgressRollStateHandler } from '../stateHandlers/progressRoll.js'
import { PlacingDiscStateHandler } from '../stateHandlers/placingDisc.js'
import { PlacingStartingPawnStateHandler } from '../stateHandlers/placingStartingPawn.js'
import { PlayingCardsStateHandler } from '../stateHandlers/playingCards.js'
import { ReplenishingStateHandler } from '../stateHandlers/replenishing.js'
import { SelectingHandsStateHandler } from '../stateHandlers/selectingHands.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'

// The mapping of machine states to their handlers, used by the game engine
export const FeudumStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedFeudumGameState>
> = {
    [MachineState.ChoosingStartingGoods]: new ChoosingStartingGoodsStateHandler(),
    [MachineState.PlacingStartingPawn]: new PlacingStartingPawnStateHandler(),
    [MachineState.SelectingHands]: new SelectingHandsStateHandler(),
    [MachineState.PlayingCards]: new PlayingCardsStateHandler(),
    [MachineState.AwaitingDefence]: new AwaitingDefenceStateHandler(),
    [MachineState.AwaitingImmunity]: new AwaitingImmunityStateHandler(),
    [MachineState.CommittingAttack]: new CommittingAttackStateHandler(),
    [MachineState.PlacingDisc]: new PlacingDiscStateHandler(),
    [MachineState.InspectingHarvest]: new InspectingHarvestStateHandler(),
    [MachineState.KeepingWrits]: new KeepingWritsStateHandler(),
    [MachineState.DiscardingWrits]: new DiscardingWritsStateHandler(),
    [MachineState.Nourishing]: new NourishingStateHandler(),
    [MachineState.CollectingLandscapes]: new CollectingLandscapesStateHandler(),
    [MachineState.ProgressRoll]: new ProgressRollStateHandler(),
    [MachineState.Dawn]: new DawnStateHandler(),
    [MachineState.Replenishing]: new ReplenishingStateHandler(),
    [MachineState.EndOfRound]: new EndOfRoundStateHandler()
}
