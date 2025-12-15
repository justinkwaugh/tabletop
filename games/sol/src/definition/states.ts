export enum MachineState {
    StartOfTurn = 'StartOfTurn',
    ActivatedEffect = 'ActivatedEffect', // If this is all we have done so far
    Moving = 'Moving',
    Activating = 'Activating',
    Converting = 'Converting',
    Hatching = 'Hatching',
    Accelerating = 'Accelerating',
    DrawingCards = 'DrawingCards',
    ChoosingCard = 'ChoosingCard',
    SolarFlares = 'SolarFlares',
    CheckEffect = 'CheckEffect',
    EndOfGame = 'EndOfGame'
}
