export enum MachineState {
    StartOfTurn = 'StartOfTurn',
    ActivatedEffect = 'ActivatedEffect', // If this is all we have done so far
    Moving = 'Moving',
    Activating = 'Activating',
    Converting = 'Converting',
    DrawingCards = 'DrawingCards',
    ChoosingCard = 'ChoosingCard',
    SolarFlares = 'SolarFlares',
    EndOfGame = 'EndOfGame'
}
