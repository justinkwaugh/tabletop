import { assertExists } from '@tabletop/common'
import { flushSync, mount, unmount } from 'svelte'
import { dev } from '$app/environment'
import GameTable from '$lib/components/GameTable.svelte'
import type { FeudumGameSession } from '$lib/model/session.svelte.js'
import { fixtureNamed, forfeitRound } from './fixtures.js'
import { tableMarkupProblems } from './renderedMarkup.js'
import { settled, type FeudumHost } from './sessionHarness.js'

export interface FixturePage {
    readonly host: FeudumHost
    readonly seat: string
    show(playerId: string): Promise<void>
    settled(): Promise<void>
    /** R-3.2 Every seat plays out its cards by forfeit, and the round ends by the real roll. */
    forfeitRound(): Promise<void>
    /** Contract, Palette and S71: what the shown table's own markup breaks. */
    markupProblems(): string[]
}

/** Served by the dev server alone: no route and no other file of the package imports it. */
export async function openFixture(name: string): Promise<void> {
    if (!dev) {
        throw new Error('Fixtures open on the dev server only')
    }
    const { host, seat } = await fixtureNamed(name).build()
    const target = document.createElement('div')
    target.dataset.gameUi = 'feudum'
    target.style.height = '100vh'
    document.body.replaceChildren(target)

    const sessions = new Map<string, FeudumGameSession>()
    let table: ReturnType<typeof mount> | undefined
    let showing: FeudumGameSession | undefined

    async function show(playerId: string) {
        const session = sessions.get(playerId) ?? (await host.openSeat(playerId))
        sessions.set(playerId, session)
        if (table) {
            await unmount(table)
        }
        await settled(session)
        showing = session
        Object.assign(window, { feudumSession: session })
        table = mount(GameTable, { target, props: { gameSession: session } })
        flushSync()
    }

    await show(seat)
    const page: FixturePage = {
        host,
        seat,
        show,
        settled: async () => {
            if (showing) {
                await settled(showing)
            }
        },
        forfeitRound: () => forfeitRound(host),
        markupProblems: () => {
            assertExists(showing, 'A table is shown')
            return tableMarkupProblems(target, showing.colors)
        }
    }
    Object.assign(window, { feudumFixture: page })
}
