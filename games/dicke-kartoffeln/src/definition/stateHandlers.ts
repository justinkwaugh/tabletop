import type { HydratedAction, MachineStateHandler } from '@tabletop/common'
import { CalculateMarket, isCalculateMarket } from '../actions/calculateMarket.js'
import { GrowSunflowers, isGrowSunflowers } from '../actions/growSunflowers.js'
import { Harvest, isHarvest } from '../actions/harvest.js'
import { MoveCompost, isMoveCompost } from '../actions/moveCompost.js'
import { ReactSoil, isReactSoil } from '../actions/reactSoil.js'
import { ReadMessage, isReadMessage } from '../actions/readMessage.js'
import { SellPotatoes, isSellPotatoes } from '../actions/sellPotatoes.js'
import type { HydratedDickeKartoffelnGameState } from '../model/gameState.js'
import { AutomaticStateHandler } from '../stateHandlers/automatic.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'
import { EndingYearStateHandler } from '../stateHandlers/endingYear.js'
import { FinalScoringStateHandler } from '../stateHandlers/finalScoring.js'
import { PlanningStateHandler } from '../stateHandlers/planning.js'
import { RevealingPlansStateHandler } from '../stateHandlers/revealingPlans.js'
import { MachineState } from './states.js'

export const DickeKartoffelnStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedDickeKartoffelnGameState>
> = {
    [MachineState.TakingCompost]: new PlanningStateHandler(MachineState.TakingCompost),
    [MachineState.Cultivating]: new PlanningStateHandler(MachineState.Cultivating),
    [MachineState.Sowing]: new PlanningStateHandler(MachineState.Sowing),
    [MachineState.Fertilizing]: new PlanningStateHandler(MachineState.Fertilizing),
    [MachineState.Spraying]: new PlanningStateHandler(MachineState.Spraying),
    [MachineState.RevealingPlans]: new RevealingPlansStateHandler(),
    [MachineState.GrowingSunflowers]: new AutomaticStateHandler(
        MachineState.GrowingSunflowers,
        GrowSunflowers,
        isGrowSunflowers
    ),
    [MachineState.ReadingMessage]: new AutomaticStateHandler(
        MachineState.ReadingMessage,
        ReadMessage,
        isReadMessage,
        { revealsInfo: true }
    ),
    [MachineState.Harvesting]: new AutomaticStateHandler(
        MachineState.Harvesting,
        Harvest,
        isHarvest
    ),
    [MachineState.RegisteringSales]: new PlanningStateHandler(MachineState.RegisteringSales),
    [MachineState.CalculatingMarket]: new AutomaticStateHandler(
        MachineState.CalculatingMarket,
        CalculateMarket,
        isCalculateMarket
    ),
    [MachineState.Selling]: new AutomaticStateHandler(
        MachineState.Selling,
        SellPotatoes,
        isSellPotatoes
    ),
    [MachineState.SoilReacting]: new AutomaticStateHandler(
        MachineState.SoilReacting,
        ReactSoil,
        isReactSoil
    ),
    [MachineState.SpreadingCompost]: new PlanningStateHandler(MachineState.SpreadingCompost),
    [MachineState.MovingCompost]: new AutomaticStateHandler(
        MachineState.MovingCompost,
        MoveCompost,
        isMoveCompost
    ),
    [MachineState.EndingYear]: new EndingYearStateHandler(),
    [MachineState.FinalScoring]: new FinalScoringStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
