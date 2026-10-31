import assert from 'node:assert/strict'

export default {
    name: 'Promontory Point, three players, October 2026',
    packageId: 'promontory-point',
    state: './state.json',
    actions: './actions.json',
    config: { fourPieceVariant: false },
    game: { seed: 3439027034, protectedInformation: true },
    // R-5: the bag's order and every other seat's hand stay concealed in each player's view.
    assertProtectedView(state, playerId) {
        assert.deepEqual(state.bag.items, [], 'The bag order must stay hidden')
        for (const player of state.players) {
            if (player.playerId !== playerId) {
                assert.equal(player.hand, undefined, `${player.playerId}'s hand must stay hidden`)
            }
        }
    }
}
