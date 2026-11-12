// @vitest-environment node
import { render } from 'svelte/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    Goods,
    HydratedFeudumGameState,
    LandscapeKinds,
    MonsterIds,
    RegionTiles,
    Routes,
    Spaces,
    StartingSpaceIds,
    type MonsterId,
    type SpaceId
} from '@tabletop/feudum'
import { RegionOutlines, plateSlot, spaceGeometry } from '$lib/utils/boardGeometry.js'
import { atPlayingCards, addPawn, type TurnTable } from '$lib/testing/turnTable.js'
import { everyAssetSupplied } from '$lib/testing/fakeArt.js'
import WritFace from '$lib/components/pieces/WritFace.svelte'
import { PlainChrome, type BoardChrome } from '$lib/model/boardChrome.js'
import { pawnTarget, spaceTarget, type BoardTarget } from '$lib/model/boardOffer.js'
import { spaceLabel } from '$lib/model/cardFlows.js'
import MapLayers from './MapLayers.svelte'

const folder = vi.hoisted(() => {
    const files: Record<string, string> = {}
    return { files }
})
vi.mock('$lib/art/suppliedFiles.js', () => ({
    get suppliedFiles() {
        return folder.files
    }
}))

const paintOf = (playerId: string) => ({
    fill: `seat-${playerId}`,
    ink: 'var(--feudum-text)',
    edge: 'var(--feudum-map-ink)',
    owner: "Ana's"
})

function markup(state: TurnTable['host']['state'], chrome?: BoardChrome) {
    return render(MapLayers, {
        props: {
            state: new HydratedFeudumGameState(structuredClone(state)),
            paintOf,
            ...(chrome ? { chrome } : {})
        }
    }).body
}

/** The markup of one placed piece, up to the next piece. */
function pieceMarkup(html: string, piece: string) {
    const start = html.indexOf(`data-world="${piece}"`)
    expect(start, piece).toBeGreaterThan(-1)
    const end = html.indexOf('data-world=', start + 1)
    return html.slice(start, end === -1 ? undefined : end)
}

function count(html: string, text: string) {
    return html.split(text).length - 1
}

/** A space with nothing on it yet, so each spec reads only what it puts there. */
function bareSpace(state: HydratedFeudumGameState): SpaceId {
    const bare = Spaces.find(({ id }) => {
        const space = state.spaces[id]
        const pawnHere = state.players.some(({ pawns }) =>
            pawns.some(({ spaceId }) => spaceId === id)
        )
        return !space.ruler && !space.serf && !space.landscape && !pawnHere
    })
    if (!bare) {
        throw new Error('Every space is taken')
    }
    return bare.id
}

function clearMonsters(state: HydratedFeudumGameState, keep: readonly MonsterId[] = []) {
    for (const monster of MonsterIds) {
        if (!keep.includes(monster)) {
            delete state.monsters[monster].spaceId
        }
    }
}

let table: TurnTable

beforeEach(async () => {
    folder.files = {}
    table = await atPlayingCards(['tax'])
})

describe('the ground and the routes', () => {
    it('R-1.2.1 our own terrain fills and hatches each region with no art at all', () => {
        const html = markup(table.host.state)
        expect(html).not.toContain('<image')
        for (const region of Object.keys(RegionOutlines)) {
            expect(html).toContain(`fill="var(--feudum-terrain-${region})"`)
            expect(html).toContain(`url(#feudum-hatch-${region})`)
        }
    })

    it('R-1.2.2 draws each route with its medium line and a glyph', () => {
        const html = markup(table.host.state)
        for (const route of Routes) {
            expect(html).toContain(`data-route="${route.id}"`)
        }
        for (const medium of ['ship', 'submersible', 'flying-machine', 'ferry']) {
            expect(count(html, `data-glyph="${medium}"`)).toBe(
                Routes.filter((route) => route.medium === medium).length
            )
        }
        expect(html).toContain('stroke-dasharray="1 11"')
        expect(html).toContain('stroke-dasharray="16 7 2 7"')
        expect(html).toContain('stroke-dasharray="2 14"')
        expect(html).toContain('stroke-dasharray="12 6"')
    })

    it('R-4.2.3 a ferry shows its fare', () => {
        const html = markup(table.host.state)
        expect(count(html, 'data-fare')).toBe(
            Routes.filter(({ medium }) => medium === 'ferry').length
        )
    })

    it('R-1.2.1 the printed map replaces our terrain, routes and letters, and the discs stay', () => {
        folder.files = everyAssetSupplied()
        const html = markup(table.host.state)
        expect(html).toContain('href="/art/board.map.webp"')
        expect(html).not.toContain('data-route')
        expect(html).not.toContain('data-terrain')
        expect(html).not.toContain('data-letters')
        expect(count(html, 'data-world="disc:')).toBe(Spaces.length)
    })
})

describe('the locations', () => {
    it.each([false, true])('R-1.2.1 start rings stay in map ink (art %s)', (art) => {
        folder.files = art ? everyAssetSupplied() : {}
        const html = markup(table.host.state)
        const rings = html.match(/<circle[^>]*r="45"[^>]*>/g) ?? []
        expect(rings).toHaveLength(StartingSpaceIds.length)
        expect(rings.every((ring) => ring.includes('var(--feudum-map-ink)'))).toBe(true)
    })
})

describe('what lies on a space', () => {
    it('R-4.1.2 a ruler, a subject beside them and a serf below, in seat paint', () => {
        const { host, seat, other } = table
        let id: SpaceId = Spaces[0].id
        host.edit((state) => {
            id = bareSpace(state)
            state.spaces[id].ruler = { playerId: seat, subject: true }
            state.spaces[id].serf = { playerId: other }
        })
        const html = markup(host.state)
        expect(pieceMarkup(html, `marker:${id}:ruler`)).toContain(`seat-${seat}`)
        expect(pieceMarkup(html, `marker:${id}:subject`)).toContain(`seat-${seat}`)
        expect(pieceMarkup(html, `marker:${id}:serf`)).toContain(`seat-${other}`)
    })

    it('R-3.14.2 an immunity seal lies under the marker it guards, and only there', () => {
        const { host, seat, other } = table
        let id: SpaceId = Spaces[0].id
        host.edit((state) => {
            id = bareSpace(state)
            state.spaces[id].ruler = { playerId: seat, subject: true, subjectImmune: true }
            state.spaces[id].serf = { playerId: other, immune: true }
        })
        const html = markup(host.state)
        expect(pieceMarkup(html, `marker:${id}:ruler`)).not.toContain('data-immune')
        for (const role of ['subject', 'serf']) {
            const piece = pieceMarkup(html, `marker:${id}:${role}`)
            expect(piece.indexOf('data-immune')).toBeGreaterThan(-1)
            expect(piece.indexOf('data-immune')).toBeLessThan(piece.indexOf('data-role'))
        }
    })

    it('R-1.1 goods group by kind on one plate, a token each, with a count badge past one', () => {
        const { host } = table
        let id: SpaceId = Spaces[0].id
        host.edit((state) => {
            id = bareSpace(state)
            state.spaces[id].goods.iron = 4
            state.spaces[id].goods.wood = 1
        })
        const html = markup(host.state)
        expect(count(html, `data-goods-plate="${id}"`)).toBe(1)
        expect(count(html, `data-world="good:${id}:iron"`)).toBe(1)
        expect(count(html, `data-world="good:${id}:wood"`)).toBe(1)
        expect(pieceMarkup(html, `good:${id}:iron`)).toMatch(/data-good-count[\s\S]*?<text[^>]*>4</)
        expect(pieceMarkup(html, `good:${id}:wood`)).not.toContain('data-good-count')
        const { plate } = spaceGeometry(id)
        for (const [index, good] of ['iron', 'wood'].entries()) {
            const { x, y } = plateSlot(plate, index)
            expect(html).toContain(
                `<g transform="translate(${x} ${y})" data-world="good:${id}:${good}"`
            )
        }
    })

    it('R-1.1 a space with no goods draws no plate', () => {
        const { host } = table
        let id: SpaceId = Spaces[0].id
        host.edit((state) => {
            id = bareSpace(state)
            for (const good of Goods) {
                state.spaces[id].goods[good] = 0
            }
        })
        expect(markup(host.state)).not.toContain(`data-goods-plate="${id}"`)
    })

    it('R-4.1 a disc with nothing lit on it opens its site card on a press, and a lit one does not', () => {
        const { host } = table
        const opened: SpaceId[] = []
        const hovered: (SpaceId | undefined)[] = []
        const [lit, plain] = [Spaces[0].id, Spaces[1].id]
        const html = markup(host.state, {
            ...PlainChrome,
            offer: {
                targets: new Map([[spaceTarget(lit), { role: 'lit' as const }]]),
                dimsRest: true
            },
            press: () => {},
            openSite: (id) => opened.push(id),
            hoverSite: (id) => hovered.push(id)
        })
        expect(html).toContain(`data-open-site="${plain}"`)
        expect(html).toContain(`aria-label="What is at ${spaceLabel(plain)}"`)
        expect(html).not.toContain(`data-open-site="${lit}"`)
        expect(markup(host.state)).not.toContain('data-open-site')
    })

    it('R-4.2.2 abandoned vessels lie on the space, with a count past one', () => {
        const { host } = table
        let id: SpaceId = Spaces[0].id
        host.edit((state) => {
            id = bareSpace(state)
            state.spaces[id].vessels.ship = 1
            state.spaces[id].vessels.submersible = 2
        })
        const html = markup(host.state)
        expect(pieceMarkup(html, `vessel:${id}:ship`)).not.toContain('role="img" aria-label="count')
        expect(pieceMarkup(html, `vessel:${id}:submersible`)).toContain('count 2')
    })

    it('R-4.1.3 a landscape shows its face and what it holds', () => {
        const { host } = table
        let id: SpaceId = Spaces[0].id
        host.edit((state) => {
            id = bareSpace(state)
            const tileId = RegionTiles[0].id
            state.tileLandscapes[tileId] = LandscapeKinds[0]
            state.spaces[id].landscape = { tileId, amount: 2 }
        })
        expect(pieceMarkup(markup(host.state), `landscape:${id}`)).toContain('count 2')
    })
})

describe('pawns and monsters', () => {
    it('R-4.2.2 a pawn stands on its vessel, in seat paint', () => {
        const { host, seat } = table
        let id: SpaceId = Spaces[0].id
        let key = ''
        host.edit((state) => {
            clearMonsters(state)
            id = bareSpace(state)
            addPawn(state, seat, 'knight', id)
            const pawn = state.getPlayerState(seat).pawns.find(({ spaceId }) => spaceId === id)
            if (!pawn) {
                throw new Error('R-1.1 The pawn stands on the space')
            }
            pawn.vessel = 'ship'
            key = `pawn:${seat}:${pawn.n}`
        })
        const piece = pieceMarkup(markup(host.state), key)
        expect(piece).toContain(`seat-${seat}`)
        expect(piece).toMatch(/aria-label="[^"]*ship/i)
    })

    it('R-3.6, R-4.2.2 a lit pawn is pressed by where it stands, and says when it rides a vessel', () => {
        const { host, seat } = table
        let afoot: SpaceId = Spaces[0].id
        let aboard: SpaceId = Spaces[0].id
        const targets = new Map<BoardTarget, { role: 'lit' }>()
        host.edit((state) => {
            clearMonsters(state)
            afoot = bareSpace(state)
            addPawn(state, seat, 'knight', afoot)
            aboard = bareSpace(state)
            addPawn(state, seat, 'monk', aboard)
            for (const pawn of state.getPlayerState(seat).pawns) {
                if (pawn.spaceId === aboard) {
                    pawn.vessel = 'flying-machine'
                }
                if (pawn.spaceId) {
                    targets.set(pawnTarget(seat, pawn.n), { role: 'lit' })
                }
            }
        })
        const html = markup(host.state, {
            ...PlainChrome,
            offer: { targets, dimsRest: true },
            press: () => {}
        })
        expect(html).toContain(`aria-label="Knight at ${spaceLabel(afoot)}"`)
        expect(html).toContain(`aria-label="Monk at ${spaceLabel(aboard)}, on a flying machine"`)
    })

    it("R-4.2.4 a controlled monster wears its master's collar; a wild one none", () => {
        const { host, seat } = table
        const [tamed, wild] = MonsterIds
        let id: SpaceId = Spaces[0].id
        host.edit((state) => {
            clearMonsters(state)
            id = bareSpace(state)
            state.monsters[tamed] = { playerId: seat, spaceId: id }
            state.monsters[wild] = { spaceId: id }
        })
        const html = markup(host.state)
        expect(pieceMarkup(html, `monster:${tamed}`)).toContain(`seat-${seat}`)
        expect(pieceMarkup(html, `monster:${wild}`)).not.toContain('seat-')
    })

    it('R-4.1 up to four pieces sit in slots, and more show as a count', () => {
        const { host, seat, other } = table
        let id: SpaceId = Spaces[0].id
        host.edit((state) => {
            clearMonsters(state)
            id = bareSpace(state)
            for (const playerId of [seat, other]) {
                addPawn(state, playerId, 'knight', id)
                addPawn(state, playerId, 'merchant', id)
            }
        })
        const four = markup(host.state)
        expect(four).not.toContain('count +')
        host.edit((state) => {
            state.monsters[MonsterIds[0]].spaceId = id
        })
        expect(markup(host.state)).toContain('count +1')
    })

    it('R-4.1 keeps world placement and the motion wrapper on separate nodes', () => {
        const { host, seat } = table
        let id: SpaceId = Spaces[0].id
        host.edit((state) => {
            id = bareSpace(state)
            addPawn(state, seat, 'knight', id)
        })
        const html = markup(host.state)
        const worlds = html.match(/<g transform="translate[^>]*data-world="[^"]*"[^>]*>/g) ?? []
        const motions = html.match(/<g data-motion="[^"]*"[^>]*>/g) ?? []
        expect(worlds.length).toBeGreaterThan(Spaces.length)
        expect(motions).toHaveLength(worlds.length)
        expect(motions.some((node) => node.includes('transform'))).toBe(false)
    })
})

describe('the Kingdom charter', () => {
    it('R-4.4.3 its small map dots its qualifying spaces when no card file is there', () => {
        const html = render(WritFace, {
            props: { faceShown: true, writId: 'writ.charter.northern-kingdom' }
        }).body
        expect(html).toContain('data-charter-map')
        expect(count(html, 'data-qualifying=')).toBeGreaterThan(0)
        expect(html.match(/<circle[^>]*r="38"/g)).toHaveLength(Spaces.length)
    })
})
