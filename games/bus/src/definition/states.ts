// The list of all possible state machine states

export enum MachineState {
    EndOfGame = 'EndOfGame',
    SettingFirstPlayer = 'SettingFirstPlayer',
    Vrooming = 'Vrooming',
    TimeMachine = 'TimeMachine',
    AddingBuildings = 'AddingBuildings',
    AddingPassengers = 'AddingPassengers',
    IncreaseBuses = 'IncreaseBuses',
    LineExpansion = 'LineExpansion',
    ChoosingActions = 'ChoosingActions',
    InitialBusLinePlacement = 'InitialBusLinePlacement',
    InitialBuildingPlacement = 'InitialBuildingPlacement'
}
