import type { HydratedAction, MachineStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import { BeginRound, isBeginRound } from '../actions/beginRound.js'
import { ResolveAuction, isResolveAuction } from '../actions/resolveAuction.js'
import { RevealStartCities, isRevealStartCities } from '../actions/revealStartCities.js'
import type { HydratedKoggeGameState } from '../model/gameState.js'
import { BiddingStateHandler } from '../stateHandlers/bidding.js'
import { ChoosingStartCitiesStateHandler } from '../stateHandlers/choosingStartCities.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'
import { MovingGuildMasterStateHandler } from '../stateHandlers/movingGuildMaster.js'
import {
    ChoosingSpoilsStateHandler,
    DividingSpoilsStateHandler,
    ExpellingRaiderStateHandler
} from '../stateHandlers/raid.js'
import { SystemStepStateHandler } from '../stateHandlers/systemStep.js'
import { TakingTurnStateHandler } from '../stateHandlers/takingTurn.js'

export const KoggeStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedKoggeGameState>
> = {
    [MachineState.ChoosingStartCities]: new ChoosingStartCitiesStateHandler(),
    [MachineState.RevealingStartCities]: new SystemStepStateHandler({
        schema: RevealStartCities,
        matches: isRevealStartCities,
        next: (state) =>
            state.startChoices === undefined
                ? MachineState.StartingRound
                : MachineState.ChoosingStartCities
    }),
    [MachineState.StartingRound]: new SystemStepStateHandler({
        schema: BeginRound,
        matches: isBeginRound,
        next: () => MachineState.Bidding
    }),
    [MachineState.Bidding]: new BiddingStateHandler(),
    [MachineState.ResolvingAuction]: new SystemStepStateHandler({
        schema: ResolveAuction,
        matches: isResolveAuction,
        next: () => MachineState.MovingGuildMaster
    }),
    [MachineState.MovingGuildMaster]: new MovingGuildMasterStateHandler(),
    [MachineState.TakingTurn]: new TakingTurnStateHandler(),
    [MachineState.DividingSpoils]: new DividingSpoilsStateHandler(),
    [MachineState.ChoosingSpoils]: new ChoosingSpoilsStateHandler(),
    [MachineState.ExpellingRaider]: new ExpellingRaiderStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
