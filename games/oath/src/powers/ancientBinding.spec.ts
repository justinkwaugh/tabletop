import { describe, expect, it } from 'vitest'
import { Color, type GameAction } from '@tabletop/common'
import { UseActionPower } from '../actions/useActionPower.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import { Banner } from '../model/oathEnums.js'
import { testPlayer, testState, openTurn, withChancellor } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { actionPowerUse } from '../testing/choices.js'
import { RunMode, engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

const ANCIENT_BINDING = 'denizen.nomad.ancient-binding'

const atRevision = OathRevision.EngineFixes2
const before = OathRevision.CardFixes1

type Secrets = { secrets: number; secretsFacedown: number }

/** `binder` rules c1, where Ancient Binding sits; `holder` holds the Darkest Secret, which carries three secrets. */
function table(oathRevision: number, players: Record<string, Secrets>) {
    const s = testState(
        withChancellor(
            ['binder', 'mixed', 'facedown', 'faceup', 'none', 'holder'].map((playerId, i) =>
                testPlayer({
                    playerId,
                    color: [
                        Color.Red,
                        Color.Blue,
                        Color.Yellow,
                        Color.Black,
                        Color.White,
                        Color.Brown
                    ][i],
                    siteId: 'c1',
                    favor: 2,
                    ...players[playerId]
                })
            )
        ),
        {
            oathRevision,
            denizensBySite: { c1: [ANCIENT_BINDING], c2: [], p1: [], h1: [] },
            warbandsBySite: { c1: { binder: 1 } },
            banners: {
                [Banner.DarkestSecret]: { value: 3, holderPlayerId: 'holder' },
                [Banner.PeoplesFavor]: { value: 1 }
            }
        }
    )
    openTurn(s, 'binder')
    return s
}

const secrets: Record<string, Secrets> = {
    binder: { secrets: 3, secretsFacedown: 2 },
    mixed: { secrets: 2, secretsFacedown: 2 },
    facedown: { secrets: 0, secretsFacedown: 3 },
    faceup: { secrets: 3, secretsFacedown: 0 },
    none: { secrets: 0, secretsFacedown: 0 },
    holder: { secrets: 1, secretsFacedown: 1 }
}

function kept(s: HydratedOathGameState, playerId: string): Secrets {
    const player = s.getPlayerState(playerId)
    return { secrets: player.secrets, secretsFacedown: player.secretsFacedown }
}

describe('Ancient Binding burns facedown secrets too, keeping one (its card, Book Burning’s Q&A, revision 5)', () => {
    it('every other player keeps exactly one secret, a faceup one when they have one', () => {
        const s = table(atRevision, secrets)
        const use = actionPowerUse('binder', ANCIENT_BINDING)
        use.apply(s)
        expect(kept(s, 'mixed')).toEqual({ secrets: 1, secretsFacedown: 0 })
        expect(kept(s, 'facedown')).toEqual({ secrets: 0, secretsFacedown: 1 })
        expect(kept(s, 'faceup')).toEqual({ secrets: 1, secretsFacedown: 0 })
        expect(kept(s, 'none')).toEqual({ secrets: 0, secretsFacedown: 0 })
        expect(use.metadata?.summary).toBe('every player burned down to one secret (11 burned)')
    })

    it('its user keeps only the secret on the card, burning their facedown secrets too', () => {
        const s = table(atRevision, secrets)
        actionPowerUse('binder', ANCIENT_BINDING).apply(s)
        expect(kept(s, 'binder')).toEqual({ secrets: 0, secretsFacedown: 0 })
        expect(s.tokensOn(ANCIENT_BINDING).secrets).toBe(1)
    })

    it('the secrets on the Darkest Secret are not burned, as its Q&A rules; its holder keeps one on their board', () => {
        const s = table(atRevision, secrets)
        actionPowerUse('binder', ANCIENT_BINDING).apply(s)
        expect(s.banners[Banner.DarkestSecret].value).toBe(3)
        expect(kept(s, 'holder')).toEqual({ secrets: 1, secretsFacedown: 0 })
    })
})

describe('R-X.4 — before revision 5, Ancient Binding burns faceup secrets only', () => {
    it('a facedown secret counts as the one kept and every facedown secret stays', () => {
        const s = table(before, secrets)
        actionPowerUse('binder', ANCIENT_BINDING).apply(s)
        expect(kept(s, 'binder')).toEqual({ secrets: 0, secretsFacedown: 2 })
        expect(kept(s, 'mixed')).toEqual({ secrets: 0, secretsFacedown: 2 })
        expect(kept(s, 'facedown')).toEqual({ secrets: 0, secretsFacedown: 3 })
        expect(kept(s, 'faceup')).toEqual({ secrets: 1, secretsFacedown: 0 })
        expect(s.banners[Banner.DarkestSecret].value).toBe(3)
    })

    for (const [revision, expected] of [
        [before, { secrets: 0, secretsFacedown: 2 }],
        [atRevision, { secrets: 1, secretsFacedown: 0 }]
    ] as const) {
        it(`an Ancient Binding recorded at revision ${revision} replays unchanged`, () => {
            const game = testGame(Object.keys(secrets))
            const start = table(revision, secrets).dehydrate()
            const step: GameAction = buildAction(UseActionPower, {
                playerId: 'binder',
                cardId: ANCIENT_BINDING,
                powerIndex: powerIndexOf(ANCIENT_BINDING, PowerTiming.Action)
            })
            const result = engine.runNext(step, structuredClone(start), game)
            const recorded: OathProjectedState = result.updatedState
            expect(kept(new HydratedOathGameState(recorded), 'mixed')).toEqual(expected)

            let replayed = structuredClone(start)
            for (const action of result.processedActions) {
                replayed = engine.run(
                    structuredClone(action),
                    replayed,
                    game,
                    RunMode.Single
                ).updatedState
            }
            expect(replayed).toEqual(recorded)
        })
    }
})
