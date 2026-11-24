// @vitest-environment node
import { render } from 'svelte/server'
import type { Color, UserPreferences } from '@tabletop/common'
import { FeudumColors } from '@tabletop/feudum'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import KnightGoods from '$lib/components/guilds/KnightGoods.svelte'
import WineBarrels from '$lib/components/tracks/WineBarrels.svelte'
import { FeudumHost } from '$lib/testing/sessionHarness.js'
import type { FeudumGameSession } from './session.svelte.js'

let host: FeudumHost | undefined

beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
})

afterEach(() => {
    host?.close()
    host = undefined
    vi.restoreAllMocks()
})

function preferring(colours: readonly Color[], colorBlindPalette = false): UserPreferences {
    return {
        preventWebNotificationPrompt: true,
        preferredColorsEnabled: colours.length > 0,
        preferredColors: [...colours],
        colorBlindPalette
    }
}

/** Every seat piece the markup names, by its accessible name, with the fill it is drawn in. */
function namedPieces(html: string): { name: string; fill: string }[] {
    return [...html.matchAll(/aria-label="([^"]+)"[\s\S]*?fill="(#[0-9a-fA-F]+)"/g)].map(
        ([, name, fill]) => ({ name, fill })
    )
}

/** The Knight rows and the wine barrels as the board draws them for this seat. */
function drawn(session: FeudumGameSession) {
    const props = {
        state: session.gameState,
        paintOf: session.paintOf,
        colourPaintOf: session.colourPaintOf
    }
    return {
        rows: namedPieces(render(KnightGoods, { props }).body),
        barrels: namedPieces(render(WineBarrels, { props: { ...props, printed: false } }).body)
    }
}

/** Each seat's pieces are named for it and drawn in the fill its paint shows, whatever its lane. */
function expectSeatsNamed(session: FeudumGameSession) {
    const pieces = drawn(session)
    for (const { playerId } of session.gameState.players) {
        const { owner, fill } = session.paintOf(playerId)
        for (const kind of [pieces.rows, pieces.barrels]) {
            const own = kind.filter(({ name }) => name.startsWith(owner))
            expect(own.length, `${owner} pieces`).toBeGreaterThan(0)
            expect(new Set(own.map((piece) => piece.fill))).toEqual(new Set([fill]))
        }
    }
    return pieces
}

async function seated(preferences: (table: FeudumHost, seat: Color) => UserPreferences) {
    const table = (host = new FeudumHost(3))
    const [me, other] = table.state.players
    const session = await table.openSeat(me.playerId, preferences(table, me.color))
    return { session, me, other, table }
}

const unplayed = (table: FeudumHost) =>
    FeudumColors.filter((colour) => !table.state.players.some(({ color }) => color === colour))

describe("DESIGN.md colour-safe identity: the platform's GameColors with a viewer's preferences", () => {
    it('S71 a preferred colour that is another seat’s swaps the two displays, never whose pieces are whose', async () => {
        const { session, me, other } = await seated((table) => {
            const [, second] = table.state.players
            return preferring([second.color])
        })

        expect(session.colors.getPlayerColor(me.playerId)).toBe(other.color)
        expect(session.colors.getPlayerColor(other.playerId)).toBe(me.color)
        expect(session.paintOf(me.playerId).fill).toBe(session.colors.getUiColor(other.color))
        expect(session.paintOf(other.playerId).fill).toBe(session.colors.getUiColor(me.color))
        expect(session.paintOf(me.playerId).owner).toBe(`${session.getPlayerName(me.playerId)}'s`)
        expectSeatsNamed(session)
    })

    it('R-1.4-H1 a preferred colour no seat plays takes no dummy row’s look: a row no seat owns keeps a colour no seat shows', async () => {
        const { session, me, table } = await seated((table) => preferring([unplayed(table)[0]]))
        const preferred = unplayed(table)[0]

        expect(session.colors.getPlayerColor(me.playerId)).toBe(preferred)
        const seatFills = session.gameState.players.map(
            ({ playerId }) => session.paintOf(playerId).fill
        )
        for (const colour of unplayed(table)) {
            expect(seatFills).not.toContain(session.colourPaintOf(colour).fill)
        }
        const { rows } = expectSeatsNamed(session)
        const seatNames = session.gameState.players.map(
            ({ playerId }) => session.paintOf(playerId).owner
        )
        const unowned = rows.filter(({ name }) => !seatNames.some((one) => name.startsWith(one)))
        expect(unowned.length).toBeGreaterThan(0)
        for (const { fill } of unowned) {
            expect(seatFills).not.toContain(fill)
        }
    })

    it('S71 the colour-blind palette repaints every seat from its colours and names each the same', async () => {
        const plain = await seated(() => preferring([]))
        const before = plain.session.gameState.players.map(({ playerId }) =>
            plain.session.paintOf(playerId)
        )
        host?.close()
        const { session } = await seated(() => preferring([], true))

        expect(session.colors.colorBlind).toBe(true)
        const after = session.gameState.players.map(({ playerId }) => session.paintOf(playerId))
        expect(after.map(({ owner }) => owner)).toEqual(before.map(({ owner }) => owner))
        expect(after.map(({ fill }) => fill)).not.toEqual(before.map(({ fill }) => fill))
        for (const { playerId } of session.gameState.players) {
            expect(session.paintOf(playerId).fill).toBe(
                session.colors.getUiColor(session.colors.getPlayerColor(playerId))
            )
        }
        expect(new Set(after.map(({ fill }) => fill)).size).toBe(after.length)
        expectSeatsNamed(session)
    })
})
