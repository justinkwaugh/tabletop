// The list of all possible state machine states
export enum MachineState {
    ChoosingStartingGoods = 'ChoosingStartingGoods',
    PlacingStartingPawn = 'PlacingStartingPawn',
    SelectingHands = 'SelectingHands',
    PlayingCards = 'PlayingCards',
    AwaitingDefence = 'AwaitingDefence',
    CommittingAttack = 'CommittingAttack',
    PlacingDisc = 'PlacingDisc',
    KeepingWrits = 'KeepingWrits',
    InspectingHarvest = 'InspectingHarvest'
}
