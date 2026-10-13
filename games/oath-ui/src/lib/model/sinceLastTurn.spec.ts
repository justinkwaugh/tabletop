import { describe, expect, it } from 'vitest'
import { ActionSource, Color, createAction } from '@tabletop/common'
import {
    ActionType,
    Banner,
    CompleteRest,
    EndActPhase,
    HydratedOathGameState,
    MachineState,
    OathRevision,
    OathType,
    PlayerStatus,
    PowerQuestionKind,
    Recover,
    RecoverTargetKind,
    SearchSource,
    Suit,
    WinKind,
    type OathProjectedState
} from '@tabletop/oath'
import {
    openTurn,
    testBanners,
    testPlayer,
    testState,
    testVaultWithRelics
} from '@tabletop/oath/testing'
import { played, tableOf } from '$lib/testing/sessionHarness.js'
import { RecordedStory } from '$lib/testing/recordedStory.js'
import { turnNews, type NewsRow } from './sinceLastTurn.js'

/** A recorded game told action by action, read as the viewer `me` by default. */
class Story extends RecordedStory {
    news(viewerId = 'me') {
        return turnNews({
            viewerId,
            state: this.state,
            actions: this.actions,
            hydrate: (state) => new HydratedOathGameState(state)
        })
    }

    rows(viewerId = 'me'): NewsRow[] {
        return this.news(viewerId)?.rows ?? []
    }
}

function player(state: OathProjectedState, playerId: string) {
    const found = state.players.find((p) => p.playerId === playerId)
    if (!found) throw Error(`no seat ${playerId}`)
    return found
}

/** Four seats under the Oath of the People: Dana the Chancellor holds the People's Favor and the title. */
function table(overrides: Partial<OathProjectedState> = {}): Story {
    const state = testState(
        [
            testPlayer({ playerId: 'me', color: Color.Blue, favor: 4 }),
            testPlayer({ playerId: 'bea', color: Color.Yellow, favor: 1 }),
            testPlayer({
                playerId: 'dana',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                favor: 2
            }),
            testPlayer({ playerId: 'rhys', color: Color.Red, favor: 3 })
        ],
        {
            chancellorPlayerId: 'dana',
            oathType: OathType.ThePeople,
            oathkeeperPlayerId: 'dana',
            round: 4,
            banners: { ...testBanners({ [Banner.PeoplesFavor]: 'dana' }, 3) },
            ...overrides
        }
    ).dehydrate()
    state.turnManager.turnOrder = ['me', 'bea', 'dana', 'rhys']
    state.turnManager.series = [{ type: 'turn', playerId: 'me', start: 0 }]
    return new Story(state)
}

/** The viewer's turn: an action, then the Rest that hands the table to Bea. */
function afterMyTurn(story = table()): Story {
    return story.act({ type: ActionType.EndActPhase, playerId: 'me' }).rest('me', 'bea')
}

function seize(story: Story, playerId: string, banner: Banner): Story {
    return story.act(
        {
            type: ActionType.CampaignResolveVictory,
            playerId,
            metadata: { bannersSeized: [banner], relicsTaken: [] }
        },
        (state) => {
            state.banners[banner] = {
                holderPlayerId: playerId,
                value: 1,
                mobSide: banner === Banner.PeoplesFavor
            }
        }
    )
}

/** The full scene: a Vision, a Citizenship, a banner seized and the title it carried. */
function fullScene(): Story {
    const story = afterMyTurn()
        .act(
            {
                type: ActionType.Search,
                playerId: 'bea',
                drawFrom: SearchSource.WorldDeck,
                metadata: {
                    supplySpent: 2,
                    cardsDrawn: 1,
                    visionsDrawn: 1,
                    stoppedOnVision: true,
                    draw: { drawnCardIds: ['vision.conquest'] }
                }
            },
            (state) => {
                state.visionsDrawn = 1
            }
        )
        .rest('bea', 'dana', (state) => {
            state.round = 5
        })
        .act({
            type: ActionType.OfferCitizenship,
            playerId: 'dana',
            exilePlayerId: 'bea',
            reliquarySlotId: 'reliquary-0'
        })
        .act(
            {
                type: ActionType.ResolveCitizenshipOffer,
                playerId: 'bea',
                granted: true,
                metadata: { granted: true, givenBanners: [] }
            },
            (state) => {
                player(state, 'bea').status = PlayerStatus.Citizen
            }
        )
        .rest('dana', 'rhys')
    return seize(story, 'rhys', Banner.PeoplesFavor).title('dana', 'rhys').rest('rhys', 'me')
}

describe('when the card has news: the viewer’s own turn, after one of theirs closed', () => {
    it('has none before the viewer’s first turn closes', () => {
        const story = table()
        story.state.turnManager.series = [{ type: 'turn', playerId: 'bea', start: 0 }]
        story.act({ type: ActionType.EndActPhase, playerId: 'bea' }).rest('bea', 'me')
        expect(story.news()).toBeUndefined()
    })

    it('has none while another seat’s turn is open', () => {
        const story = afterMyTurn().act({ type: ActionType.EndActPhase, playerId: 'bea' })
        expect(story.news()).toBeUndefined()
        expect(story.news('bea')).toBeUndefined()
    })

    it('is keyed by the viewer’s open turn, and nothing new is no row', () => {
        const story = afterMyTurn()
            .act({ type: ActionType.EndActPhase, playerId: 'bea' })
            .rest('bea', 'me')
        expect(story.news()).toEqual({ turnStart: 4, rows: [] })
    })
})

describe('the rows, each kind', () => {
    it('a Vision seen: its drawer and the price it leaves, never which Vision (R-5.1.2, R-9.4)', () => {
        const rows = fullScene().rows()
        expect(rows[0]).toEqual({
            kind: 'vision',
            actionId: 'a2',
            drawerId: 'bea',
            visionsDrawn: 1
        })
        expect(JSON.stringify(rows)).not.toContain('vision.conquest')
    })

    it('a Vision drawn by a power names the power', () => {
        const story = afterMyTurn()
            .act(
                {
                    type: ActionType.UseActionPower,
                    playerId: 'bea',
                    cardId: 'denizen.nomad.oracle',
                    powerIndex: 0,
                    metadata: {
                        summary: '',
                        visionDrawn: true,
                        reveal: { kind: 'vision', cardId: 'vision.faith' }
                    }
                },
                (state) => {
                    state.visionsDrawn = 2
                }
            )
            .rest('bea', 'me')
        expect(story.rows()).toEqual([
            {
                kind: 'vision',
                actionId: 'a2',
                drawerId: 'bea',
                powerCardId: 'denizen.nomad.oracle',
                visionsDrawn: 2
            }
        ])
        expect(JSON.stringify(story.rows())).not.toContain('vision.faith')
    })

    it('a banner seized: who from, and its Mob side', () => {
        const rows = fullScene().rows()
        expect(rows[2]).toEqual({
            kind: 'banner',
            actionId: 'a7',
            banner: Banner.PeoplesFavor,
            toId: 'rhys',
            fromId: 'dana',
            mobSide: true,
            toMob: true,
            how: { kind: 'seized' }
        })
    })

    it('a banner recovered: what was paid (R-5.4.2)', () => {
        const story = afterMyTurn()
            .act(
                {
                    type: ActionType.Recover,
                    playerId: 'bea',
                    target: { kind: RecoverTargetKind.Banner, banner: Banner.DarkestSecret },
                    amountPaid: 2,
                    metadata: { supplySpent: 1, amountPaid: 2 }
                },
                (state) => {
                    state.banners[Banner.DarkestSecret] = {
                        holderPlayerId: 'bea',
                        value: 2,
                        mobSide: false
                    }
                }
            )
            .rest('bea', 'me')
        expect(story.rows()).toEqual([
            {
                kind: 'banner',
                actionId: 'a2',
                banner: Banner.DarkestSecret,
                toId: 'bea',
                fromId: undefined,
                mobSide: false,
                toMob: false,
                how: { kind: 'recovered', paid: 2 }
            }
        ])
    })

    it('a banner taken with the Conspiracy, or given by a card or an offer', () => {
        const story = afterMyTurn()
            .act(
                {
                    type: ActionType.SearchResolve,
                    playerId: 'bea',
                    conspiracy: {
                        targetPlayerId: 'dana',
                        take: { kind: 'banner', banner: Banner.PeoplesFavor }
                    },
                    metadata: { playedCardId: 'denizen.discord.conspiracy' }
                },
                (state) => {
                    state.banners[Banner.PeoplesFavor].holderPlayerId = 'bea'
                }
            )
            .act(
                {
                    type: ActionType.UseActionPower,
                    playerId: 'bea',
                    cardId: 'denizen.nomad.ancient-pact',
                    powerIndex: 0,
                    metadata: { summary: '' }
                },
                (state) => {
                    state.banners[Banner.DarkestSecret].holderPlayerId = 'dana'
                }
            )
            .rest('bea', 'dana')
            .act({
                type: ActionType.OfferCitizenship,
                playerId: 'dana',
                exilePlayerId: 'rhys',
                reliquarySlotId: 'reliquary-0'
            })
            .act(
                {
                    type: ActionType.ResolveCitizenshipOffer,
                    playerId: 'rhys',
                    granted: true,
                    metadata: { granted: true, givenBanners: [Banner.DarkestSecret] }
                },
                (state) => {
                    player(state, 'rhys').status = PlayerStatus.Citizen
                    state.banners[Banner.DarkestSecret].holderPlayerId = 'rhys'
                }
            )
            .rest('dana', 'me')
        const how = story
            .rows()
            .flatMap((row) => (row.kind === 'banner' ? [[row.banner, row.toId, row.how]] : []))
        expect(how).toEqual([
            [Banner.PeoplesFavor, 'bea', { kind: 'conspiracy' }],
            [Banner.DarkestSecret, 'dana', { kind: 'card', cardId: 'denizen.nomad.ancient-pact' }],
            [Banner.DarkestSecret, 'rhys', { kind: 'offer', offererId: 'dana' }]
        ])
    })

    it('the title: who took it from whom, and the goal they meet (R-2.11)', () => {
        expect(fullScene().rows()[3]).toEqual({
            kind: 'title',
            actionId: 'a8',
            toId: 'rhys',
            fromId: 'dana',
            goal: 'peoplesFavor',
            tie: undefined,
            sideAgain: false
        })
    })

    it('the title on a tie: the holder chose, and the seat tied with the taker (R-2.11.b)', () => {
        const story = afterMyTurn(
            table({ oathType: OathType.Supremacy, oathkeeperPlayerId: 'rhys' })
        )
            .act(
                {
                    type: ActionType.CampaignResolveVictory,
                    playerId: 'bea',
                    metadata: { bannersSeized: [], relicsTaken: [] }
                },
                (state) => {
                    state.pendingOathkeeperChoice = {
                        holderPlayerId: 'rhys',
                        candidates: ['bea', 'me'],
                        resumeMachineState: state.machineState
                    }
                }
            )
            .act(
                { type: ActionType.ResolveOathkeeper, playerId: 'rhys', chosenPlayerId: 'bea' },
                (state) => {
                    state.pendingOathkeeperChoice = undefined
                    state.oathkeeperPlayerId = 'bea'
                }
            )
            .rest('bea', 'me')
        expect(story.rows().filter((row) => row.kind === 'title')).toEqual([
            {
                kind: 'title',
                actionId: 'a3',
                toId: 'bea',
                fromId: 'rhys',
                goal: 'mostSites',
                tie: { tiedWithIds: ['me'], chooserId: 'rhys' },
                sideAgain: false
            }
        ])
    })

    it('the title taken from a Usurper turns back to its Oathkeeper side; under Supremacy the Empire holds it', () => {
        const story = afterMyTurn(
            table({
                oathType: OathType.Supremacy,
                oathkeeperPlayerId: 'rhys',
                oathkeeperIsUsurper: true
            })
        )
            .act({ type: ActionType.EndActPhase, playerId: 'bea' })
            .rest('bea', 'dana')
            .title('rhys', 'dana')
            .rest('dana', 'me')
        expect(story.rows()).toContainEqual(
            expect.objectContaining({
                kind: 'title',
                toId: 'dana',
                fromId: 'rhys',
                goal: 'empireSites',
                sideAgain: true
            })
        )
    })

    it('the Usurper flip at another seat’s Wake (R-4.1.3)', () => {
        const story = afterMyTurn(table({ oathkeeperPlayerId: 'bea' }))
            .act(
                {
                    type: ActionType.ResolveWake,
                    playerId: 'bea',
                    favorSteps: [],
                    metadata: { flippedToUsurper: true }
                },
                (state) => {
                    state.oathkeeperIsUsurper = true
                }
            )
            .rest('bea', 'me')
        expect(story.rows()[0]).toEqual({ kind: 'usurper', actionId: 'a2', playerId: 'bea' })
    })

    it('a Citizen made by an accepted offer names the offerer (R-6.6.1)', () => {
        expect(fullScene().rows()[1]).toEqual({
            kind: 'citizen',
            actionId: 'a5',
            playerId: 'bea',
            how: { kind: 'offer', offererId: 'dana' }
        })
    })

    it('a Citizen made by a card names the card', () => {
        const story = afterMyTurn()
            .act(
                {
                    type: ActionType.SearchResolve,
                    playerId: 'bea',
                    metadata: { playedCardId: 'denizen.beast.long-lost-heir' }
                },
                (state) => {
                    player(state, 'bea').status = PlayerStatus.Citizen
                }
            )
            .rest('bea', 'me')
        expect(story.rows()).toEqual([
            {
                kind: 'citizen',
                actionId: 'a2',
                playerId: 'bea',
                how: { kind: 'card', cardId: 'denizen.beast.long-lost-heir' }
            }
        ])
    })

    it('a Citizen made by a battle plan names the plan from the battle’s note, the attacker’s or the defender’s', () => {
        const madeBy = (playerId: string) =>
            afterMyTurn()
                .act(
                    {
                        type: ActionType.CampaignSacrifice,
                        playerId: 'bea',
                        sacrifice: 0,
                        metadata: {
                            attack: 3,
                            defense: 4,
                            sacrificed: 0,
                            attackerVictorious: playerId === 'bea',
                            planNotes: [
                                `Martial Culture: ${playerId} became a Citizen (2 warbands became Imperial); Supply refreshed`
                            ]
                        }
                    },
                    (state) => {
                        player(state, playerId).status = PlayerStatus.Citizen
                    }
                )
                .rest('bea', 'me')
                .rows()
        for (const playerId of ['bea', 'rhys']) {
            expect(madeBy(playerId)).toEqual([
                {
                    kind: 'citizen',
                    actionId: 'a2',
                    playerId,
                    how: { kind: 'card', cardId: 'denizen.order.martial-culture' }
                }
            ])
        }
    })

    it('a Citizen made by Land Warden’s second card names that card, not the first', () => {
        const story = afterMyTurn()
            .act(
                {
                    type: ActionType.SearchResolve,
                    playerId: 'bea',
                    metadata: {
                        playedCardId: 'denizen.hearth.wayside-inn',
                        secondPlayedCardId: 'denizen.arcane.bewitch',
                        secondWhenPlayed:
                            'Bewitch: became a Citizen (2 warbands became Imperial); Supply refreshed, Act Phase over'
                    }
                },
                (state) => {
                    player(state, 'bea').status = PlayerStatus.Citizen
                }
            )
            .rest('bea', 'me')
        expect(story.rows()).toEqual([
            {
                kind: 'citizen',
                actionId: 'a2',
                playerId: 'bea',
                how: { kind: 'card', cardId: 'denizen.arcane.bewitch' }
            }
        ])
    })

    it('a banner taken with the Conspiracy the Inquisitor found reads as the Conspiracy’s take', () => {
        const story = afterMyTurn()
            .act(
                {
                    type: ActionType.AnswerQuestion,
                    playerId: 'bea',
                    answer: {
                        kind: PowerQuestionKind.PlayOrDiscardConspiracy,
                        play: true,
                        conspiracy: {
                            targetPlayerId: 'dana',
                            take: { kind: 'banner', banner: Banner.PeoplesFavor }
                        }
                    }
                },
                (state) => {
                    state.banners[Banner.PeoplesFavor].holderPlayerId = 'bea'
                }
            )
            .rest('bea', 'me')
        const how = story
            .rows()
            .flatMap((row) => (row.kind === 'banner' ? [[row.banner, row.toId, row.how]] : []))
        expect(how).toEqual([[Banner.PeoplesFavor, 'bea', { kind: 'conspiracy' }]])
    })

    it('an Exile: exiled by the Scepter’s holder, or by their own choice, with the favor that moved (R-6.7, R-6.8)', () => {
        const start = table()
        player(start.state, 'me').status = PlayerStatus.Citizen
        player(start.state, 'bea').status = PlayerStatus.Citizen
        const story = afterMyTurn(start)
            .act(
                {
                    type: ActionType.SelfExile,
                    playerId: 'bea',
                    metadata: { favorGiven: 3, scepterHolderId: 'dana' }
                },
                (state) => {
                    player(state, 'bea').status = PlayerStatus.Exile
                }
            )
            .rest('bea', 'dana')
            .act(
                {
                    type: ActionType.ExileCitizen,
                    playerId: 'dana',
                    citizenPlayerId: 'me',
                    metadata: { favorGiven: 3 }
                },
                (state) => {
                    player(state, 'me').status = PlayerStatus.Exile
                }
            )
            .rest('dana', 'me')
        expect(story.rows().filter((row) => row.kind === 'exile')).toEqual([
            {
                kind: 'exile',
                actionId: 'a2',
                playerId: 'bea',
                how: { kind: 'self', favor: 3, toId: 'dana' }
            },
            {
                kind: 'exile',
                actionId: 'a4',
                playerId: 'me',
                how: { kind: 'exiled', byId: 'dana', favor: 3 }
            }
        ])
    })

    it('Next to win, read just before the viewer’s Rest and now, when its winner or kind differs', () => {
        const last = fullScene().rows().at(-1)
        expect(last).toEqual({
            kind: 'nextWin',
            before: {
                when: 'endDie',
                playerId: 'dana',
                kind: WinKind.StableRegime,
                round: 5,
                threshold: 6
            },
            now: { when: 'wakeAfterNext', playerId: 'rhys' }
        })
    })
})

describe('the order and the window', () => {
    it('lists the rows as they happened, Next to win last', () => {
        expect(
            fullScene()
                .rows()
                .map((row) => row.kind)
        ).toEqual(['vision', 'citizen', 'banner', 'title', 'nextWin'])
    })

    it('lists every move, so a banner taken and taken back is four rows and no Next to win', () => {
        const story = afterMyTurn()
        seize(story, 'bea', Banner.PeoplesFavor).title('dana', 'bea').rest('bea', 'dana')
        story
            .act(
                {
                    type: ActionType.Recover,
                    playerId: 'dana',
                    target: { kind: RecoverTargetKind.Banner, banner: Banner.PeoplesFavor },
                    metadata: { supplySpent: 1, amountPaid: 2 }
                },
                (state) => {
                    state.banners[Banner.PeoplesFavor] = {
                        holderPlayerId: 'dana',
                        value: 2,
                        mobSide: false
                    }
                }
            )
            .title('bea', 'dana')
            .rest('dana', 'me')
        expect(
            story
                .rows()
                .map((row) => [
                    row.kind,
                    row.kind === 'banner' || row.kind === 'title' ? row.toId : undefined
                ])
        ).toEqual([
            ['banner', 'bea'],
            ['title', 'bea'],
            ['banner', 'dana'],
            ['title', 'dana']
        ])
    })

    it('leaves out a title move the viewer’s own Rest caused, since they saw it', () => {
        const story = table()
            .act({ type: ActionType.EndActPhase, playerId: 'me' })
            .rest('me', 'bea')
            .title('dana', 'me')
            .act({ type: ActionType.EndActPhase, playerId: 'bea' })
            .rest('bea', 'me')
        expect(story.rows().filter((row) => row.kind === 'title')).toEqual([])
    })

    it('leaves out what the viewer did in this turn', () => {
        const story = fullScene().act(
            { type: ActionType.SelfExile, playerId: 'bea', metadata: { favorGiven: 1 } },
            (state) => {
                player(state, 'bea').status = PlayerStatus.Exile
            }
        )
        expect(story.rows().map((row) => row.kind)).toEqual([
            'vision',
            'citizen',
            'banner',
            'title',
            'nextWin'
        ])
    })

    it('behind an action with no undo patch, keeps what the records say and hides what reads the table, never throwing', () => {
        const story = fullScene()
        story.actions[2] = { ...story.actions[2], undoPatch: undefined }
        // The Search's own price comes from its record; the anchor, and so Next to win, is out of reach.
        expect(story.rows().map((row) => row.kind)).toEqual([
            'vision',
            'citizen',
            'banner',
            'title'
        ])
        expect(story.rows()[0]).toEqual({
            kind: 'vision',
            actionId: 'a2',
            drawerId: 'bea',
            visionsDrawn: 1
        })

        story.actions[9] = { ...story.actions[9], undoPatch: undefined }
        expect(story.rows()).toEqual([
            { kind: 'vision', actionId: 'a2', drawerId: 'bea', visionsDrawn: 1 }
        ])
    })
})

describe('on a game the engine played', () => {
    it('reads the recorded states: the banner recovered, the title it carried, and the new next winner', () => {
        const start = testState(
            [
                testPlayer({ playerId: 'me', color: Color.Red, siteId: 'c1', favor: 5 }),
                testPlayer({
                    playerId: 'ann',
                    color: Color.Purple,
                    status: PlayerStatus.Chancellor,
                    siteId: 'c1',
                    favor: 6
                })
            ],
            {
                machineState: MachineState.RestPhase,
                chancellorPlayerId: 'ann',
                oathType: OathType.ThePeople,
                oathkeeperPlayerId: 'me',
                oathRevision: OathRevision.TurnFlow,
                round: 4,
                banners: {
                    ...testBanners(),
                    [Banner.PeoplesFavor]: { value: 2, mobSide: false, holderPlayerId: 'me' }
                }
            }
        )
        start.turnManager.turnOrder = ['me', 'ann']
        openTurn(start, 'me')
        start.activePlayerIds = ['me']
        start.vault = testVaultWithRelics({})
        const envelope = { gameId: start.gameId, source: ActionSource.User }
        const game = played(tableOf(start), [
            createAction(CompleteRest, { ...envelope, playerId: 'me' }),
            createAction(Recover, {
                ...envelope,
                playerId: 'ann',
                target: { kind: RecoverTargetKind.Banner, banner: Banner.PeoplesFavor },
                amountPaid: 3,
                redistributeFrom: Suit.Arcane
            }),
            // With nothing to do at Rest the engine completes it, and the viewer's Wake resolves itself.
            createAction(EndActPhase, { ...envelope, playerId: 'ann' })
        ])
        expect(game.state.turnManager.series.at(-1)).toEqual({
            type: 'turn',
            playerId: 'me',
            start: 6
        })
        const news = turnNews({
            viewerId: 'me',
            state: game.state,
            actions: game.actions,
            hydrate: (state) => new HydratedOathGameState(state)
        })
        expect(news?.rows).toEqual([
            expect.objectContaining({
                kind: 'banner',
                toId: 'ann',
                fromId: 'me',
                how: { kind: 'recovered', paid: 3 }
            }),
            expect.objectContaining({
                kind: 'title',
                toId: 'ann',
                fromId: 'me',
                goal: 'peoplesFavor',
                sideAgain: false
            }),
            {
                kind: 'nextWin',
                before: { when: 'wakeAfterNext', playerId: 'me' },
                now: expect.objectContaining({ when: 'endDie', playerId: 'ann', round: 5 })
            }
        ])
    })
})
