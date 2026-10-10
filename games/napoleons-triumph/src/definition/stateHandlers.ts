import type { HydratedAction, MachineStateHandler } from '@tabletop/common'
import type { HydratedNapoleonsTriumphGameState } from '../model/gameState.js'
import {
    AttackDeclarationStateHandler,
    CounterAttackDecisionStateHandler,
    DefenseResponseStateHandler,
    FeintDecisionStateHandler,
    OccupyingStateHandler,
    ResolvingAttackStateHandler,
    RetreatingStateHandler
} from '../stateHandlers/attack.js'
import { CommandingStateHandler } from '../stateHandlers/commanding.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'
import {
    AlliedSetupStateHandler,
    BiddingStateHandler,
    ChoosingSideStateHandler,
    FrenchSetupStateHandler
} from '../stateHandlers/setup.js'
import { MachineState } from './states.js'

export const NapoleonsTriumphStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedNapoleonsTriumphGameState>
> = {
    [MachineState.Bidding]: new BiddingStateHandler(),
    [MachineState.ChoosingSide]: new ChoosingSideStateHandler(),
    [MachineState.AlliedSetup]: new AlliedSetupStateHandler(),
    [MachineState.FrenchSetup]: new FrenchSetupStateHandler(),
    [MachineState.Commanding]: new CommandingStateHandler(),
    [MachineState.DefenseResponse]: new DefenseResponseStateHandler(),
    [MachineState.FeintDecision]: new FeintDecisionStateHandler(),
    [MachineState.AttackDeclaration]: new AttackDeclarationStateHandler(),
    [MachineState.CounterAttackDecision]: new CounterAttackDecisionStateHandler(),
    [MachineState.ResolvingAttack]: new ResolvingAttackStateHandler(),
    [MachineState.Retreating]: new RetreatingStateHandler(),
    [MachineState.Occupying]: new OccupyingStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
