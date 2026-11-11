// @vitest-environment node
import { render } from 'svelte/server'
import { describe, expect, it } from 'vitest'
import {
    ActionCards,
    Charters,
    HydratedFeudumGameState,
    Mandates,
    RegionTiles,
    type ActionCardKind,
    type WritId
} from '@tabletop/feudum'
import { seatOrder, seatPanelOf, type SeatPanelView } from '$lib/model/seatPanel.js'
import { writName } from '$lib/model/writLabels.js'
import { FeudumHost } from '$lib/testing/sessionHarness.js'
import {
    buildFeudum,
    emptySpace,
    giveBead,
    giveSeal,
    giveTile,
    ruleTown
} from '$lib/testing/turnTable.js'
import { fillBarrel, holdWrit } from '$lib/testing/followUpTable.js'
import SeatPanelOnTable from '$lib/testing/SeatPanelOnTable.svelte'
import SeatPanel from './seat/SeatPanel.svelte'

const paint = {
    fill: 'var(--feudum-map-ink)',
    ink: 'var(--feudum-text)',
    edge: 'var(--feudum-map-ink)',
    owner: "Bram's"
}
const Owner = 'p2'
const Other = 'p1'
const Played = 'move'
const HiddenCards: readonly ActionCardKind[] = ['tax', 'conquer']
const OtherHiddenCards: readonly ActionCardKind[] = ['harvest', 'improve']
const [HeldWrit, OtherHeldWrit] = Mandates
const [SealedWrit, OtherSealedWrit] = Charters

function nameOf(playerId: string): string {
    return `Name of ${playerId}`
}

/** Every field a Local game or Host View holds: the perspective alone may hide them. */
function fullTable(
    hand: readonly ActionCardKind[] = HiddenCards,
    writ: WritId = HeldWrit.id,
    sealed: WritId = SealedWrit.id
): HydratedFeudumGameState {
    const host = new FeudumHost(3)
    host.edit((state) => {
        const player = state.getPlayerState(Owner)
        holdWrit(state, Owner, writ)
        holdWrit(state, Owner, sealed)
        player.writs = [writ]
        player.sealedCharters = [sealed]
        player.sealedCharterCount = 1
        player.deckKnowledge = [
            { slot: 40, writId: Mandates[5].id },
            { slot: 41, writId: Mandates[6].id }
        ]
        player.hand = [...hand]
        player.handCount = hand.length
        player.played = [{ kind: Played, use: 'regular' }]
        player.pouch = undefined
    })
    return new HydratedFeudumGameState(structuredClone(host.state))
}

function viewOf(
    state: HydratedFeudumGameState,
    viewerId: string | undefined,
    playerId = Owner,
    hostView = false
): SeatPanelView {
    return seatPanelOf({ state, playerId, viewerId, hostView, nameOf })
}

function markupOf(view: SeatPanelView): string {
    return render(SeatPanelOnTable, { props: { view, paint } }).body
}

describe('Seat panel: others see no hidden thing (S57, S58)', () => {
    describe('what the derivation returns for another seat', () => {
        const view = viewOf(fullTable(), Other)
        const held = JSON.stringify(view)

        it('R-3.1, R-5.1 hand backs with a count; no face, and no set-aside, of an unplayed card', () => {
            expect(view.cards.handBacks).toBe(HiddenCards.length)
            expect(view.cards.unplayed).toEqual([])
            for (const kind of ActionCards.map((card) => card.kind).filter((k) => k !== Played)) {
                expect(JSON.stringify(view.cards)).not.toContain(`"${kind}"`)
            }
        })

        it('R-3.2 cards played stand face up for all', () => {
            expect(view.cards.played).toMatchObject([{ kind: Played, mark: 'regular' }])
        })

        it('R-4.4.4 writs and sealed charters as counted backs; no writ id anywhere', () => {
            expect(view.writs).toMatchObject({
                backs: 1,
                sealedBacks: 1,
                faces: [],
                sealedFaces: []
            })
            expect(held).not.toContain('writ.')
            expect(held).not.toContain(HeldWrit.id)
            expect(held).not.toContain(SealedWrit.id)
        })

        it('R-4.4.1 no deck knowledge, not even a count', () => {
            expect(view.writs.deckNote).toBeUndefined()
            expect(held).not.toContain('under the deck')
            expect(held).not.toContain('"slot"')
        })

        it('R-5.1 a spectator reads what another seat reads', () => {
            expect(viewOf(fullTable(), undefined)).toEqual(view)
        })
    })

    it('R-5.1 Change every hidden field a seat holds: nothing changes for another seat, in the derivation or the DOM', () => {
        const first = viewOf(fullTable(), Other)
        const changed = fullTable(OtherHiddenCards, OtherHeldWrit.id, OtherSealedWrit.id)
        changed.getPlayerState(Owner).deckKnowledge = []

        expect(viewOf(changed, Other)).toEqual(first)
        expect(markupOf(viewOf(changed, Other))).toBe(markupOf(first))
    })

    it('R-5.1 The same change does reach the seat itself, so the check above can fail', () => {
        const changed = fullTable(OtherHiddenCards, OtherHeldWrit.id, OtherSealedWrit.id)
        expect(markupOf(viewOf(changed, Owner))).not.toBe(markupOf(viewOf(fullTable(), Owner)))
    })

    describe('what the rendered DOM holds for another seat', () => {
        const markup = markupOf(viewOf(fullTable(), Other))

        it('R-3.1, R-5.1 backs with their count; no hidden card, and nothing named set-aside', () => {
            expect(markup).toContain('data-hand-backs="2"')
            expect(markup).toContain('×2')
            expect(markup).toContain(`data-seat-card="${Played}"`)
            for (const kind of HiddenCards) {
                const { printedName } = ActionCards.find((card) => card.kind === kind) ?? {}
                expect(markup).not.toContain(`data-seat-card="${kind}"`)
                expect(markup).not.toContain(`${printedName}`)
                expect(markup).not.toContain(`card.action.${kind}`)
            }
            expect(markup).not.toContain('data-set-aside')
            expect(markup).not.toContain('set aside')
        })

        it('R-4.4.4 no writ name, id or art; a back is one crowned writ', () => {
            expect(markup).not.toContain('data-writ-face')
            for (const { id } of [HeldWrit, SealedWrit]) {
                expect(markup).not.toContain(id)
                expect(markup).not.toContain(writName(id))
            }
            expect(markup.match(/data-writ-back/g)).toHaveLength(2)
            expect(markup.match(/data-writ-back="sealed"/g)).toHaveLength(1)
        })

        it('R-4.4.1 no deck note', () => {
            expect(markup).not.toContain('under the deck')
            expect(markup).not.toContain('data-deck-note')
        })
    })
})

describe('Seat panel: the seat itself and Host View (S57)', () => {
    const state = fullTable()

    it('R-3.1, R-5.1 The owner sees the hand and, dimmed, the set-aside cards; no backs', () => {
        const { cards } = viewOf(state, Owner)
        expect(cards.handBacks).toBe(0)
        expect(cards.unplayed.filter(({ setAside }) => !setAside).map(({ kind }) => kind)).toEqual([
            'tax',
            'conquer'
        ])
        // The eleven, each once: R-3.5's order for those not played.
        expect(cards.unplayed).toHaveLength(10)
        expect(cards.unplayed.map(({ number }) => number)).toEqual(
            cards.unplayed.map(({ number }) => number).toSorted((a, b) => a - b)
        )
        const markup = markupOf(viewOf(state, Owner))
        expect(markup.match(/data-set-aside/g)).toHaveLength(8)
    })

    it('R-4.4.3, R-4.4.4 The owner sees writ faces, sealed charters dimmed and marked, and the note', () => {
        const { writs } = viewOf(state, Owner)
        expect(writs).toMatchObject({
            backs: 0,
            sealedBacks: 0,
            faces: [HeldWrit.id],
            sealedFaces: [SealedWrit.id],
            deckNote: 'you know 2 under the deck'
        })
        const markup = markupOf(viewOf(state, Owner))
        expect(markup).toContain(`data-writ-face="${HeldWrit.id}"`)
        expect(markup).toContain(`data-writ-face="${SealedWrit.id}"`)
        expect(markup).toContain('data-writ-sealed')
        expect(markup).toContain('you know 2 under the deck')
    })

    it('S57 In Host View the faces show; the note stays the owner\'s, since it says "you"', () => {
        const view = viewOf(state, Other, Owner, true)
        expect(view.cards.handBacks).toBe(0)
        expect(view.writs.faces).toEqual([HeldWrit.id])
        expect(view.writs.sealedFaces).toEqual([SealedWrit.id])
        expect(view.writs.deckNote).toBeUndefined()
    })

    it('R-3.1 Before a hand is chosen nothing is set aside: the owner holds all eleven, others no backs', () => {
        const host = new FeudumHost(3)
        const fresh = new HydratedFeudumGameState(structuredClone(host.state))
        const mine = viewOf(fresh, Owner).cards
        expect(mine.unplayed).toHaveLength(11)
        expect(mine.unplayed.some(({ setAside }) => setAside)).toBe(false)
        expect(viewOf(fresh, Other).cards).toMatchObject({ handBacks: 0, unplayed: [] })
    })
})

describe('Seals and beads (S58, R-5-H1)', () => {
    function table() {
        const host = new FeudumHost(3)
        host.edit((state) => {
            giveSeal(state, Owner)
            giveSeal(state, Owner)
            giveBead(state, Owner)
        })
        return new HydratedFeudumGameState(structuredClone(host.state))
    }

    it('R-5-H1 Held seals are a count to everyone, the holder included; no seal id or value', () => {
        const mine = viewOf(table(), Owner).supply
        const theirs = viewOf(table(), Other).supply
        expect(mine.seals).toBe(2)
        expect(theirs).toEqual(mine)
        expect(JSON.stringify(mine)).not.toContain('seal.')
        const markup = markupOf(viewOf(table(), Owner))
        expect(markup).toContain('data-seals="2"')
        expect(markup).toContain("king's seal")
    })

    it('R-3.11.1 A bead shows its value to all at once', () => {
        const state = table()
        const [value] = viewOf(state, Owner).supply.beads
        expect(viewOf(state, Other).supply.beads).toEqual([value])
        expect(markupOf(viewOf(state, Other))).toContain(`bead +${value}`)
    })
})

describe('One derivation of the seat (contract: Seat panel)', () => {
    const SeatA = 'p1'

    it('R-2.2.5, R-5.3 The ribbon: name, score, numeral, the start-player crown, the turn pulse', () => {
        const host = new FeudumHost(3)
        host.edit((state) => {
            state.getPlayerState(SeatA).score = 12
            state.activePlayerIds = [SeatA]
        })
        const state = new HydratedFeudumGameState(structuredClone(host.state))
        const [first, second] = state.turnManager.turnOrder
        expect(viewOf(state, Other, first).ribbon).toMatchObject({
            name: nameOf(first),
            turnNumeral: 1,
            startPlayer: true
        })
        expect(viewOf(state, Other, second).ribbon).toMatchObject({
            turnNumeral: 2,
            startPlayer: false
        })
        expect(viewOf(state, Other, SeatA).ribbon).toMatchObject({ score: 12, deciding: true })
        const asleep = state.turnManager.turnOrder.find((id) => id !== SeatA) ?? ''
        expect(viewOf(state, Other, asleep).ribbon.deciding).toBe(false)
    })

    it('R-2.2.5 The panels keep their places when the marker passes; the numerals and crown move', () => {
        const state = new HydratedFeudumGameState(structuredClone(new FeudumHost(3).state))
        const before = seatOrder(state)
        const was = viewOf(state, Other, before[0]).ribbon
        state.passStartingPlayer()
        expect(seatOrder(state)).toEqual(before)
        expect(viewOf(state, Other, before[0]).ribbon.turnNumeral).not.toBe(was.turnNumeral)
    })

    it('R-3.2 Each use of a card is marked', () => {
        const host = new FeudumHost(3)
        host.edit((state) => {
            state.getPlayerState(Owner).played = [
                { kind: 'move', use: 'regular' },
                { kind: 'tax', use: 'special' },
                { kind: 'conquer', use: 'forfeited' },
                { kind: 'defend', use: 'defend-flip' },
                { kind: 'repeat', use: 'regular', replayedKind: 'influence' }
            ]
        })
        const state = new HydratedFeudumGameState(structuredClone(host.state))
        expect(viewOf(state, Other).cards.played.map(({ mark }) => mark)).toEqual([
            'regular',
            'special',
            'forfeited',
            'flipped as Defend',
            'replayed Influence'
        ])
        state.getPlayerState(Owner).played = [
            { kind: 'repeat', use: 'regular', replayedKind: 'explore', dejaVu: true }
        ]
        expect(viewOf(state, Other).cards.played[0].mark).toBe('Déjà Vu Explore')
        expect(markupOf(viewOf(state, Other))).toContain('Déjà Vu Explore')
    })

    describe('R-3.3 The pouch', () => {
        function pouchTable(edit: (state: HydratedFeudumGameState) => void) {
            const host = new FeudumHost(3)
            host.edit(edit)
            return new HydratedFeudumGameState(structuredClone(host.state))
        }
        const choosing = (state: HydratedFeudumGameState) => {
            state.flow.selection = { playerId: Owner, finalised: [] }
        }

        it('Before it is finalised: "choosing" for others, the drafted good for the owner', () => {
            const state = pouchTable(choosing)
            expect(viewOf(state, Other).pouch).toEqual({ status: 'choosing' })
            expect(viewOf(state, Owner).pouch).toEqual({ status: 'choosing' })
            expect(
                seatPanelOf({
                    state,
                    playerId: Owner,
                    viewerId: Owner,
                    nameOf,
                    draftedPouch: 'saltpeter'
                }).pouch
            ).toEqual({ status: 'drafted', good: 'saltpeter' })
            // Another seat's draft stays with that seat's session.
            expect(
                seatPanelOf({
                    state,
                    playerId: Owner,
                    viewerId: Other,
                    nameOf,
                    draftedPouch: 'saltpeter'
                }).pouch
            ).toEqual({ status: 'choosing' })
        })

        it('Finalised without a good: empty for all', () => {
            const state = pouchTable((row) => {
                row.flow.selection = { playerId: Other, finalised: [Owner] }
            })
            expect(viewOf(state, Other).pouch).toEqual({ status: 'empty' })
        })

        it('Finalised: named to all, and spent once used', () => {
            const state = pouchTable((row) => {
                const player = row.getPlayerState(Owner)
                row.supply.haversack.sulfur -= 1
                player.pouch = 'sulfur'
            })
            expect(viewOf(state, Other).pouch).toEqual({
                status: 'finalised',
                good: 'sulfur',
                note: 'sequential',
                spent: false
            })
            state.getPlayerState(Owner).sequentialUsed = true
            expect(viewOf(state, Other).pouch).toMatchObject({ spent: true })

            state.getPlayerState(Owner).pouch = 'saltpeter'
            state.getPlayerState(Owner).played = ['move', 'tax', 'harvest', 'guild'].map(() => ({
                kind: 'move',
                use: 'regular'
            }))
            expect(viewOf(state, Other).pouch).toEqual({
                status: 'finalised',
                good: 'saltpeter',
                note: 'extra action',
                spent: false
            })
            state.getPlayerState(Owner).played.push({ kind: 'move', use: 'regular' })
            expect(viewOf(state, Other).pouch).toMatchObject({ spent: true })
        })
    })

    it('R-1.1, R-4.3.3, R-4.10.2, R-5.3 Supply and barrel, as public state has them', () => {
        const host = new FeudumHost(3)
        let tile = ''
        host.edit((state) => {
            tile = giveTile(state, Owner)
            fillBarrel(state, Owner, 2)
            state.voyageTrack[Owner] = 3
            state.militaryService[Owner] = 1
        })
        const state = new HydratedFeudumGameState(structuredClone(host.state))
        const player = state.getPlayerState(Owner)
        const { supply, barrel } = viewOf(state, Other)

        expect(supply.goods.map(({ count }) => count)).toEqual(
            supply.goods.map(({ good }) => player.goods[good])
        )
        expect(supply.shillings).toBe(player.shillings)
        expect(supply.markers).toBe(player.influenceSupply)
        // One voyage disc and one military disc are out of the three shared.
        expect(supply).toMatchObject({ freeDiscs: 1, discsOf: 3 })
        expect(supply.vessels.map(({ vessel }) => vessel)).toEqual([
            'ship',
            'submersible',
            'flying-machine'
        ])
        expect(supply.tiles).toEqual([
            {
                tileId: tile,
                epoch: RegionTiles.find(({ id }) => id === tile)?.epoch,
                region: RegionTiles.find(({ id }) => id === tile)?.region,
                landscape: state.tileLandscapes[tile]
            }
        ])
        expect(barrel).toEqual({ sulfur: 2, capacity: 3 })
    })

    it('R-4.5, R-4.7, R-4.5.2 Crests in ring order, with stars, rank, reeve, and "no marker"', () => {
        const host = new FeudumHost(3)
        host.edit((state) => {
            const space = ruleTown(state, Owner)
            const pawn = state.getPlayerState(Owner).pawns[0]
            pawn.spaceId = space
            pawn.character = 'farmer'
            state.guilds.tracks.farmer = { master: { playerId: Owner, reeve: true } }
            state.guilds.tracks.merchant = { apprentice: { playerId: Owner, reeve: false } }
            const second = state.getPlayerState(Owner).pawns[1]
            second.spaceId = space
            second.character = 'monk'
            // Every marker placed: the monk star has none to stand on the track (R-4.5.2).
            const player = state.getPlayerState(Owner)
            state.supply.influence[player.color] += player.influenceSupply
            player.influenceSupply = 0
        })
        const state = new HydratedFeudumGameState(structuredClone(host.state))
        const { guilds } = viewOf(state, Other)
        expect(guilds.map(({ guild }) => guild)).toEqual([
            'farmer',
            'merchant',
            'alchemist',
            'knight',
            'noble',
            'monk'
        ])
        expect(guilds[0]).toMatchObject({ rank: 'M', reeve: true, noMarker: false })
        expect(guilds[0].stars).toBe(state.statusStars(Owner, 'farmer'))
        expect(guilds[1]).toMatchObject({ rank: 'A', reeve: false, noMarker: false, stars: 0 })
        expect(guilds[2]).toMatchObject({ stars: 0, noMarker: false })
        expect(guilds[2].rank).toBeUndefined()
        expect(guilds[5]).toMatchObject({ noMarker: true })
        expect(guilds[5].stars).toBeGreaterThan(0)
        const markup = markupOf(viewOf(state, Other))
        expect(markup).toContain('data-rank="M"')
        expect(markup).toContain('data-reeve')
        expect(markup).toContain('no marker')
    })

    it('R-4.5.2, R-4.5.3, R-1.4.9 A seat outranked off a full track still holds markers: "outranked", not "no marker"', () => {
        const host = new FeudumHost(3)
        host.edit((state) => {
            const space = ruleTown(state, Owner)
            const pawn = state.getPlayerState(Owner).pawns[1]
            pawn.spaceId = space
            pawn.character = 'monk'
            const others = state.players.filter(({ playerId }) => playerId !== Owner)
            state.guilds.tracks.monk = {
                master: { playerId: others[0].playerId, reeve: false },
                journeyman: { playerId: others[1].playerId, reeve: false }
            }
        })
        const state = new HydratedFeudumGameState(structuredClone(host.state))
        expect(state.getPlayerState(Owner).influenceSupply).toBeGreaterThan(0)
        const view = viewOf(state, Other)
        const monk = view.guilds[5]
        expect(monk.stars).toBeGreaterThan(0)
        expect(monk.rank).toBeUndefined()
        expect(monk).toMatchObject({ noMarker: false, outranked: true })
        expect(view.guilds[0]).toMatchObject({ outranked: false })
        const markup = markupOf(view)
        expect(markup).not.toContain('no marker')
        expect(markup).toContain('data-outranked')
    })

    it('R-3.7.5, R-4.9.2, R-4.9-H2 Service and voyage: discs covered, vassal, the voyage space', () => {
        const host = new FeudumHost(3)
        host.edit((state) => {
            state.militaryService[Owner] = 2
            state.voyageTrack[Owner] = 4
            buildFeudum(state, Owner, emptySpace(state, 'town'))
        })
        const state = new HydratedFeudumGameState(structuredClone(host.state))
        expect(viewOf(state, Other)).toMatchObject({
            service: { covered: 2, of: 3, vassal: true },
            voyage: 4
        })
        expect(viewOf(state, Owner, SeatA).service).toMatchObject({ covered: 0, vassal: false })
        expect(viewOf(state, Owner, SeatA).voyage).toBeUndefined()
        const markup = markupOf(viewOf(state, Other))
        expect(markup).toContain('data-service="2"')
        expect(markup).toContain('data-voyage="4"')
        expect(markup).toContain('vassal')
    })
})

describe('Open a seat and enlarge (S59, contract: Seat panel)', () => {
    const view = viewOf(fullTable(), Other)

    it('R-X.1 The ribbon is one button, and says what it does', () => {
        const opens = render(SeatPanel, {
            props: { view, paint, ribbonLabel: "Open Name's seat", onRibbon: () => {} }
        }).body
        expect(opens.match(/<button/g)).toHaveLength(1)
        expect(opens).toContain('aria-label="Open Name\'s seat"')
    })

    it('R-5.1 The same panel at a larger size: same pieces, bigger', () => {
        const widths = (markup: string) =>
            [...markup.matchAll(/<svg[^>]*\bwidth="([\d.]+)"/g)].map(([, width]) => Number(width))
        const pieces = (markup: string) => markup.match(/data-[a-z-]+(="[^"]*")?/g)
        const column = render(SeatPanelOnTable, { props: { view, paint } }).body
        const reading = render(SeatPanelOnTable, { props: { view, paint, reading: true } }).body

        expect(pieces(reading)).toEqual(pieces(column))
        expect(Math.max(...widths(reading))).toBeGreaterThan(Math.max(...widths(column)))
    })

    it('R-4.4.4, R-5.1 On a table every card, writ, tile and bead is a press; alone, a plain piece', () => {
        const onTable = markupOf(viewOf(fullTable(), Owner))
        expect(onTable).toContain('data-enlarge="Move card"')
        expect(onTable).toContain(`data-enlarge="${writName(HeldWrit.id)}"`)

        const backs = markupOf(view)
        expect(backs).toContain('data-enlarge="card back"')
        expect(backs).toContain('data-enlarge="writ back"')
        expect(backs).toContain('data-enlarge="sealed writ back"')

        const alone = render(SeatPanel, { props: { view, paint } }).body
        expect(alone).not.toContain('data-enlarge')
    })
})
