import { describe, expect, it } from 'vitest'
import { Color, type Visibility } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { OathVisibility } from '../definition/runtime.js'
import { testPlayer, testState } from '../testing/fixture.js'
import { served } from '../testing/projection.js'
import { BANDIT_CHIEF, banditsPerSite } from './bandits.js'

const SEATS = ['dana', 'rhys', 'ann']

type Chief = 'none' | 'site' | 'faceup' | 'facedown'

/** Rhys holds a facedown adviser in every case, so each seat's view lacks something the host has. */
function table(chief: Chief): HydratedOathGameState {
    const rhysAdvisers = [
        { cardId: 'denizen.nomad.tents', faceUp: false },
        ...(chief === 'faceup' || chief === 'facedown'
            ? [{ cardId: BANDIT_CHIEF, faceUp: chief === 'faceup' }]
            : [])
    ]
    return testState(
        [
            testPlayer({ playerId: 'dana', color: Color.Red, siteId: 'c1' }),
            testPlayer({
                playerId: 'rhys',
                color: Color.Blue,
                siteId: 'c2',
                advisers: rhysAdvisers
            }),
            testPlayer({
                playerId: 'ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'p1'
            })
        ],
        {
            chancellorPlayerId: 'ann',
            denizensBySite: {
                c1: chief === 'site' ? [BANDIT_CHIEF] : ['denizen.hearth.storyteller'],
                c2: []
            }
        }
    )
}

function seen(state: HydratedOathGameState, playerId: string): HydratedOathGameState {
    const view: Visibility.Perspective = { kind: 'player', playerId }
    return OathVisibility.state.guardForExecution(
        new HydratedOathGameState(served(state, view)),
        view
    )
}

describe('banditsPerSite on a seat’s own view', () => {
    const cases: [Chief, number][] = [
        ['none', 1],
        ['site', 3],
        ['faceup', 3],
        ['facedown', 1]
    ]
    for (const [chief, count] of cases) {
        it(`R-2.8.3 — Bandit Chief ${chief}: every seat counts ${count}, as the host does`, () => {
            const state = table(chief)
            expect(banditsPerSite(state)).toBe(count)
            for (const playerId of SEATS) {
                expect(banditsPerSite(seen(state, playerId)), playerId).toBe(count)
            }
        })
    }
})
