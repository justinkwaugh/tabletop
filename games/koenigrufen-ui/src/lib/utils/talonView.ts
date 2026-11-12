import {
    Goal,
    MachineState,
    Partnership,
    type HydratedKoenigrufenGameState
} from '@tabletop/koenigrufen'

export enum TalonPlace {
    // The middle of the table, from the deal until the contract has used the talon.
    Middle = 'middle',
    // The upper left, where talon cards that go to no team yet wait for the hand.
    Corner = 'corner'
}

export type TalonView =
    | { kind: 'stack'; place: TalonPlace }
    | { kind: 'halves'; place: TalonPlace.Middle; halves: string[][] }
    | { kind: 'half'; place: TalonPlace.Corner; cards: string[] }
    | { kind: 'gone' }

// The talon stays in the middle until these states are over.
const MiddleStates: readonly MachineState[] = [
    MachineState.Dealing,
    MachineState.Bidding,
    MachineState.ChoosingContract,
    MachineState.CallingKing,
    MachineState.RevealingTalon,
    MachineState.PickingUpTalon
]

// Whether talon cards the declarer does not take go straight to the defenders: when declarer plays
// alone against three, whose side everyone knows. With a secret partner they wait instead.
export function talonGoesToDefenders(state: HydratedKoenigrufenGameState): boolean {
    if (!state.contract) {
        return false
    }
    const definition = state.contractDefinition()
    if (definition.goal !== Goal.TakePoints) {
        return false
    }
    return definition.partnership === Partnership.Alone || state.isCalledKingInTalon()
}

// The talon as the table shows it. It is dealt face down to the middle. A contract that uses it
// turns it up there as two halves for the declarer to choose; then the declarer's cards go to the
// declarer, the defenders' to the defenders, and any that go to no team yet wait in the corner.
export function talonViewOf(state: HydratedKoenigrufenGameState): TalonView {
    const halves = state.talonHalves
    const rejected = state.rejectedTalonHalf
    if (halves) {
        if (rejected === undefined) {
            return { kind: 'halves', place: TalonPlace.Middle, halves }
        }
        return talonGoesToDefenders(state)
            ? { kind: 'gone' }
            : { kind: 'half', place: TalonPlace.Corner, cards: rejected }
    }
    if (!state.contract || MiddleStates.includes(state.machineState)) {
        return { kind: 'stack', place: TalonPlace.Middle }
    }
    const definition = state.contractDefinition()
    // Sechserdreier's declarer has picked it up; the solo games give it to the defenders unseen.
    if (definition.talonCards === 6 || talonGoesToDefenders(state)) {
        return { kind: 'gone' }
    }
    return { kind: 'stack', place: TalonPlace.Corner }
}

// The opponent who gathers the defenders' cards: the first after the declarer in turn order.
export function defenderCollector(state: HydratedKoenigrufenGameState): string | undefined {
    const declarerId = state.contract?.declarerId
    if (declarerId === undefined) {
        return undefined
    }
    const order = state.turnManager.turnOrder
    const declarer = order.indexOf(declarerId)
    return order[(declarer + 1) % order.length]
}
