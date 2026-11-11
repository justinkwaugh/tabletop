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
                id: 'TW-IHZh-ZkbJ_T2VOwL2r',
                name: 'Aldric',
                userId: 'rehearsal-player-0',
                isHuman: true,
                status: 'joined'
            },
            {
                id: '8BUHFpPWXGjHLJB2JlLmu',
                name: 'Brielle',
                userId: 'rehearsal-player-1',
                isHuman: true,
                status: 'joined'
            }
        ]
    },
    comparisonNotes: [
        'Exported from a local hotseat game played to its end through the site: 164 user Actions and 163 system Actions. The State and History are the canonical ones the browser stored for a Local game, not a projection.',
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
