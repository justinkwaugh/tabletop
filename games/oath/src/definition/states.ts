import { assertExists } from '@tabletop/common'

export enum MachineState {
    /** R-1.19 through R-1.23.3. */
    Setup = 'Setup',
    /** R-4.1. */
    WakePhase = 'WakePhase',
    /** R-4.2. */
    ActPhase = 'ActPhase',
    /** R-4.3, plus the round boundary and R-3.3's end die. */
    RestPhase = 'RestPhase',
    /** R-5.1.3, R-5.1.4 */
    Searching = 'Searching',
    /** R-5.5.5 */
    CampaignSacrifice = 'CampaignSacrifice',
    /** R-5.5.3, R-7.5.2 */
    CampaignPlans = 'CampaignPlans',
    /** R-5.5.6.a */
    CampaignDefeat = 'CampaignDefeat',
    /** R-5.5.7 */
    CampaignVictory = 'CampaignVictory',
    /** R-2.11.b — the outgoing title holder is on the clock. */
    OathkeeperChoice = 'OathkeeperChoice',
    /** R-X.1 — the asked player is on the clock; the asking turn is held. */
    ConsentRequest = 'ConsentRequest',
    PowerQuestion = 'PowerQuestion',
    EndOfGame = 'EndOfGame'
}

export function toMachineState(value: string): MachineState {
    const state = Object.values(MachineState).find((candidate) => candidate === value)
    assertExists(state, `${value} is not an Oath machine state`)
    return state
}
