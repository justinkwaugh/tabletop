// The list of all possible state machine states

export enum MachineState {
    PlacingCastles = 'PlacingCastles',
    // Ready to flip the next action card (or the very start of a round).
    StartOfTurn = 'StartOfTurn',
    // A standard 3-action card is face up; players are placing decision cards.
    ChoosingActions = 'ChoosingActions',
    // All decision cards are in. Dispatches each slot (top/middle/bottom) in order:
    // auto-resolves Money Bag and 0/1-chooser slots, otherwise hands off to
    // Negotiating or Dueling; a border-slot winner hands off to PlacingWalls, a
    // knight-slot winner hands off to PlacingKnights, and a politics-slot winner
    // hands off to TakingPoliticsCard. A transient state - it never waits for a real
    // player action, always cascading onward via a system action. Playing a held
    // politics card (its actual effect) isn't built yet - only taking one is.
    ResolvingActions = 'ResolvingActions',
    // A 2-way tie on the current slot is being negotiated via ducat offers.
    Negotiating = 'Negotiating',
    // A 3+-way tie (or a declined negotiation) is being settled via a blind-bid duel.
    Dueling = 'Dueling',
    // The winner of a border action is placing their 1-3 walls (state.wallsRemaining).
    PlacingWalls = 'PlacingWalls',
    // The winner of a knight action is placing their 1-2 knights (state.knightsRemaining).
    PlacingKnights = 'PlacingKnights',
    // The winner of "Crown and Scepter" is looking through their chosen pile
    // (state.politicsTakingPlayerId) and picking one card from it.
    TakingPoliticsCard = 'TakingPoliticsCard',
    // The King is Dead card was drawn - the game is over.
    EndOfGame = 'EndOfGame',
}