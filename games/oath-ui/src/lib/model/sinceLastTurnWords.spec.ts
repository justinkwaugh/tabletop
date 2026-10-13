import { describe, expect, it } from 'vitest'
import { Banner, WinKind } from '@tabletop/oath'
import { newsWords, type NewsWords } from './sinceLastTurnWords.js'
import type { NewsRow } from './sinceLastTurn.js'

/** A row's words as one line of text: the label, the line (the strong run in asterisks), the how. */
function said(words: NewsWords): string {
    const line = words.line.map((run) => (run.strong ? `*${run.text}*` : run.text)).join('')
    const how = [words.how, words.danger].filter((part) => part !== undefined).join(' · ')
    return [words.label?.toUpperCase(), line, how || undefined]
        .filter((part) => part !== undefined)
        .join(' / ')
}

function say(row: NewsRow, viewerId = 'ann'): string {
    return said(newsWords(row, viewerId))
}

describe('the rows’ words (seats by id, each drawn as its chip; the viewer is ann)', () => {
    it('a Vision seen, by a world-deck Search or a power, and by the viewer', () => {
        expect(say({ kind: 'vision', actionId: 'a', drawerId: 'bea', visionsDrawn: 1 })).toBe(
            'bea has seen a Vision / World-deck Search · the Search now costs 3 Supply'
        )
        expect(
            say({
                kind: 'vision',
                actionId: 'a',
                drawerId: 'bea',
                powerCardId: 'denizen.nomad.oracle',
                visionsDrawn: 3
            })
        ).toBe('bea has seen a Vision / With Oracle · the Search now costs 4 Supply')
        expect(say({ kind: 'vision', actionId: 'a', drawerId: 'ann' })).toBe(
            'ann have seen a Vision / World-deck Search'
        )
    })

    it('a banner: seized to its Mob side, recovered, taken, given, or taken when nobody held it', () => {
        const banner = (fields: Partial<Extract<NewsRow, { kind: 'banner' }>>): NewsRow => ({
            kind: 'banner',
            actionId: 'a',
            banner: Banner.PeoplesFavor,
            toId: 'rhys',
            fromId: 'dana',
            mobSide: false,
            toMob: false,
            ...fields
        })
        expect(say(banner({ mobSide: true, toMob: true, how: { kind: 'seized' } }))).toBe(
            'rhys took *the People’s Favor* from dana / Seized in a Campaign · now on its Mob side'
        )
        expect(
            say(banner({ toId: 'dana', fromId: 'bea', how: { kind: 'recovered', paid: 2 } }))
        ).toBe('dana took *the People’s Favor* from bea / Recovered for 2 favor')
        expect(
            say(
                banner({
                    banner: Banner.DarkestSecret,
                    toId: 'bea',
                    fromId: 'dana',
                    how: { kind: 'recovered', paid: 4 }
                })
            )
        ).toBe('bea took *the Darkest Secret* from dana / Recovered for 4 secrets')
        expect(say(banner({ how: { kind: 'conspiracy' } }))).toBe(
            'rhys took *the People’s Favor* from dana / Taken with the Conspiracy'
        )
        expect(
            say(
                banner({
                    banner: Banner.DarkestSecret,
                    toId: 'dana',
                    fromId: 'bea',
                    how: { kind: 'card', cardId: 'denizen.nomad.ancient-pact' }
                })
            )
        ).toBe('dana took *the Darkest Secret* from bea / Given with Ancient Pact')
        expect(say(banner({ toId: 'bea', how: { kind: 'offer', offererId: 'dana' } }))).toBe(
            'bea took *the People’s Favor* from dana / Given in dana’s offer'
        )
        expect(say(banner({ banner: Banner.DarkestSecret, fromId: undefined }))).toBe(
            'rhys took *the Darkest Secret*'
        )
    })

    it('the title: the goal met, a tie and who chose, its Oathkeeper side again, and nobody left holding it', () => {
        const title = (fields: Partial<Extract<NewsRow, { kind: 'title' }>>): NewsRow => ({
            kind: 'title',
            actionId: 'a',
            toId: 'rhys',
            fromId: 'dana',
            goal: 'peoplesFavor',
            sideAgain: false,
            ...fields
        })
        expect(say(title({}))).toBe(
            'rhys took the Oathkeeper title from dana / Holds the People’s Favor'
        )
        expect(
            say(
                title({
                    toId: 'bea',
                    fromId: 'rhys',
                    goal: 'mostSites',
                    tie: { tiedWithIds: ['ann'], chooserId: 'rhys' }
                })
            )
        ).toBe('bea took the Oathkeeper title from rhys / Most sites, tied with ann · rhys chose')
        expect(say(title({ toId: 'dana', fromId: 'rhys', sideAgain: true }))).toBe(
            'dana took the Oathkeeper title from rhys / Holds the People’s Favor · Oathkeeper side again'
        )
        expect(say(title({ toId: 'dana', fromId: 'rhys', goal: 'empireSites' }))).toBe(
            'dana took the Oathkeeper title from rhys / The Empire rules the most sites'
        )
        expect(say(title({ goal: 'darkestSecret' }))).toContain('/ Holds the Darkest Secret')
        expect(say(title({ goal: 'mostRelicsAndBanners' }))).toContain(
            '/ Holds the most relics and banners'
        )
        expect(say(title({ toId: undefined, goal: undefined }))).toBe(
            'dana lost the Oathkeeper title / Nobody holds it'
        )
    })

    it('the Usurper flip', () => {
        expect(say({ kind: 'usurper', actionId: 'a', playerId: 'rhys' })).toBe(
            'rhys is now the Usurper / Flipped at their Wake · wins at the next if they keep it'
        )
    })

    it('a Citizen made by an offer or a card, and an Exile, exiled or by their own choice', () => {
        expect(
            say({
                kind: 'citizen',
                actionId: 'a',
                playerId: 'bea',
                how: { kind: 'offer', offererId: 'dana' }
            })
        ).toBe('bea became a Citizen / Accepted dana’s offer')
        expect(
            say({
                kind: 'citizen',
                actionId: 'a',
                playerId: 'bea',
                how: { kind: 'card', cardId: 'denizen.beast.long-lost-heir' }
            })
        ).toBe('bea became a Citizen / With Long-Lost Heir')
        expect(
            say({
                kind: 'exile',
                actionId: 'a',
                playerId: 'ann',
                how: { kind: 'exiled', byId: 'dana', favor: 3 }
            })
        ).toBe('ann became an Exile / Exiled by dana · got 3 favor')
        expect(
            say({
                kind: 'exile',
                actionId: 'a',
                playerId: 'bea',
                how: { kind: 'self', favor: 3, toId: 'dana' }
            })
        ).toBe('bea became an Exile / Self-exile · 3 favor to dana')
    })

    it('Next to win, with the reading before under it', () => {
        expect(
            say({
                kind: 'nextWin',
                now: { when: 'wakeAfterNext', playerId: 'rhys' },
                before: {
                    when: 'endDie',
                    playerId: 'dana',
                    kind: WinKind.StableRegime,
                    round: 5,
                    threshold: 6
                }
            })
        ).toBe(
            'NEXT TO WIN / rhys becomes the Usurper at their next Wake and wins at the one after / Before: dana, as the Oathkeeper, if the end die ended the game after round 5'
        )
        expect(
            say({
                kind: 'nextWin',
                now: { when: 'wake', playerId: 'ann', kind: WinKind.Visionary },
                before: { when: 'finalRound', playerId: 'dana', kind: WinKind.StableRegime }
            })
        ).toBe(
            'NEXT TO WIN / ann win with your Vision at your next Wake / Before: dana, as the Oathkeeper, when round 8 ends'
        )
        expect(
            say({
                kind: 'nextWin',
                now: undefined,
                before: { when: 'wake', playerId: 'ann', kind: WinKind.Visionary }
            })
        ).toBe(
            'NEXT TO WIN / Nobody is set to win as the table stands / Before: ann, with your Vision, at your next Wake'
        )
        expect(
            say({
                kind: 'nextWin',
                now: { when: 'wakeAfterNext', playerId: 'rhys' },
                before: undefined
            })
        ).toContain('/ Before: nobody was set to win')
    })
})
