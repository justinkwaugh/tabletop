import { flushSync, mount, unmount } from 'svelte'
import { dev } from '$app/environment'
import GameTable from '$lib/components/GameTable.svelte'
import type { FeudumGameSession } from '$lib/model/session.svelte.js'
import { fixtureNamed, forfeitRound } from './fixtures.js'
import { settled, type FeudumHost } from './sessionHarness.js'

/** What a browser spec reaches on a fixture's page: the game's server, and any seat's browser. */
export interface FixturePage {
    readonly host: FeudumHost
    readonly seat: string
    /** This seat's browser shows, on what that seat receives. */
    show(playerId: string): Promise<void>
    /** Whatever the last press or send set off has finished, on the seat that shows. */
    settled(): Promise<void>
    /** R-3.2 Every seat plays out its cards by forfeit, and the round ends by the real roll. */
    forfeitRound(): Promise<void>
}

/**
 * A named fixture's real table on a browser's page, its session on the host of a spec. The dev server
 * alone serves this file: no route and no other file of the package's imports it, and a fixture's
 * spec holds that. A name that is no fixture throws, naming those that are. A person opens one from the
 * dev server's console: `import('/src/lib/testing/fixtureTablePage.ts').then((m) => m.openFixture('setup-goods'))`.
 */
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
        forfeitRound: () => forfeitRound(host)
    }
    Object.assign(window, { feudumFixture: page })
}
