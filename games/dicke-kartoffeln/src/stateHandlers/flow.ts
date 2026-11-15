import { MachineState } from '../definition/states.js'
import { messagesInYear, type DickeKartoffelnSetup } from '../definition/setup.js'
import type { HydratedDickeKartoffelnGameState } from '../model/gameState.js'
import { planners } from '../model/planRules.js'
import { isPlanningState } from '../model/plans.js'

// The rounds of the "Jahresübersicht", in order. RevealingPlans follows each planning round.
const YEAR_ROUNDS: readonly MachineState[] = [
    MachineState.TakingCompost,
    MachineState.Cultivating,
    MachineState.Sowing,
    MachineState.Fertilizing,
    MachineState.Spraying,
    MachineState.GrowingSunflowers,
    MachineState.ReadingMessage,
    MachineState.Harvesting,
    MachineState.RegisteringSales,
    MachineState.CalculatingMarket,
    MachineState.Selling,
    MachineState.SoilReacting,
    MachineState.SpreadingCompost,
    MachineState.MovingCompost,
    MachineState.EndingYear
]

// The next round anyone takes part in. A planning round waits for every farmer with a decision
// to make; the others carry on by themselves.
export function nextRound(
    state: HydratedDickeKartoffelnGameState,
    setup: DickeKartoffelnSetup,
    after?: MachineState
): MachineState {
    const start = after === undefined ? 0 : YEAR_ROUNDS.indexOf(after) + 1
    for (const round of YEAR_ROUNDS.slice(start)) {
        if (isPlanningState(round)) {
            const planning = planners(state, round, setup)
            if (planning.length === 0) continue
            state.activePlayerIds = planning
            return round
        }
        if (round === MachineState.ReadingMessage && !messagesInYear(setup, state.year())) {
            continue
        }
        state.activePlayerIds = []
        return round
    }
    throw Error(`No round follows ${after}`)
}
