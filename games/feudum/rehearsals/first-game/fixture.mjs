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
        "Re-recorded when the State stopped keeping copies: influence markers counted by seat (a dummy row's by its colour), Knight rows by id with their owner, the turn and setup seat read from the turn manager (each serf asked to collect landscapes now takes a turn of its own), and no stored disc face, feudum guild or monster-icon controller. The recorded initial State was moved to that shape and the same 123 user Actions replayed through the engine: the same 138 system Actions, the same scores and winner.",
        'Re-recorded when track discs and printed alternatives became ids: a voyage or service disc names its track space by id (none covered is an absent key), and PlayMandate and a played weapon name the printed alternative by id. The recorded initial State was moved to that shape, the one PlayMandate input given its alternative by id, and the same 123 user Actions replayed through the engine: the same 138 system Actions with their recorded times, the same scores (55 and 45) and winner.',
        "Re-recorded when the State stopped keeping copies and positions: the epoch names its sunray by id (track.epoch.i to track.epoch.v), a location keeps only its disc and a double-sided disc its face, a dummy Knight row is no seat's and its markers are counted by row id, and a follow-up names no seat. The recorded initial State was moved to that shape and the same 123 user Actions replayed through the engine: the same 138 system Actions with their recorded times, the same scores (55 and 45) and winner.",
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
