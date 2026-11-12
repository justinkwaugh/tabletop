import assert from 'node:assert/strict'

export default {
    name: 'Feudum, two seats, first complete hotseat game, November 2026',
    packageId: 'feudum',
    state: './state.json',
    actions: './actions.json',
    config: {},
    game: {
        name: 'Feudum, two seats, first complete hotseat game',
        protectedInformation: true,
        players: [
            {
                id: 'xVxV1Xn5UQq54-oz_yKWU',
                name: 'Aldric',
                userId: 'rehearsal-player-0',
                isHuman: true,
                status: 'joined'
            },
            {
                id: '1xR9m1pAy_W5irFjMM2pw',
                name: 'Brielle',
                userId: 'rehearsal-player-1',
                isHuman: true,
                status: 'joined'
            }
        ]
    },
    comparisonNotes: [
        'Exported from a local hotseat game played to its end through the site: 123 user Actions. Its State and History were the canonical ones the browser stored for a Local game, not a projection.',
        'Re-recorded when the pouch goods became revealed together (RevealPouches after the last FinaliseHand of each round): the same 123 user Actions, in the same order, replayed through the engine from the recorded initial State, giving 138 system Actions and the State and History stored here.',
        'Seat names and account ids are replaced with invented ones; Feudum State holds neither, so no comparison is affected.'
    ],
    assertProtectedView(state) {
        assert.equal(
            state.vault,
            undefined,
            'The vault (deck order, seal identities, stacked landscapes) never reaches a view'
        )
        assert.equal(
            state.masterSeed,
            undefined,
            'The reproduction master seed never reaches a view'
        )
    }
}
