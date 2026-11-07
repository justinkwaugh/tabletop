// The list of all possible state machine states
export enum MachineState {
    ChoosingStartingGoods = 'ChoosingStartingGoods',
    PlacingStartingPawn = 'PlacingStartingPawn',
    SelectingHands = 'SelectingHands',
    PlayingCards = 'PlayingCards',
    AwaitingDefence = 'AwaitingDefence',
    AwaitingImmunity = 'AwaitingImmunity',
    CommittingAttack = 'CommittingAttack',
    PlacingDisc = 'PlacingDisc',
    KeepingWrits = 'KeepingWrits',
    InspectingHarvest = 'InspectingHarvest',
    DiscardingWrits = 'DiscardingWrits',
    Nourishing = 'Nourishing',
    CollectingLandscapes = 'CollectingLandscapes',
    ProgressRoll = 'ProgressRoll',
    EndOfRound = 'EndOfRound'
}
