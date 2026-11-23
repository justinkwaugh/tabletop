import {
    type ActionCardKind,
    ActionType,
    collectTopTile,
    type Epoch,
    fillLandscape,
    type HydratedFeudumGameState,
    MachineState,
    nourishOffer,
    placeMarker,
    RegionIds,
    stackTop,
    type SunrayId
} from '@tabletop/feudum'
import { assertExists } from '@tabletop/common'
import type { FeudumGameSession } from '$lib/model/session.svelte.js'
import { settled, type FeudumHost } from './sessionHarness.js'
import { atPlayingCards, emptySpaces } from './turnTable.js'
import { showOnStacks, type StackShowing } from '@tabletop/feudum/testing'

export interface RoundEndTable {
    readonly host: FeudumHost
    readonly seat: string
    readonly other: string
    readonly sessions: readonly FeudumGameSession[]
    readonly session: FeudumGameSession
}

/** R-4.12 The printed number of an epoch a round can trigger. */
export type DawnEpoch = Exclude<Epoch, 1>

/** R-4.11.2 Tops that trigger the epoch with no legal tile for the die, so no roll disturbs them. */
const Triggers: Readonly<
    Record<DawnEpoch, { readonly from: SunrayId; readonly tops: readonly StackShowing[] }>
> = {
    2: { from: 'track.epoch.i', tops: [2, 2, 2, 2, 2, 2] },
    3: { from: 'track.epoch.ii', tops: [3, 3, 3, 3, 3, 3] },
    4: { from: 'track.epoch.iii', tops: [4, 4, 4, 4, 4, 4] },
    5: { from: 'track.epoch.iv', tops: ['V', 4, 4, 4, 4, 4] }
}

/** R-4.3.4, R-4.12.3 `serf` tends a filled landscape under `ruler`: the dawn asks it to collect. */
export function tendLandscape(state: HydratedFeudumGameState, ruler: string, serf: string): void {
    const region = RegionIds.find((id) => stackTop(state, id)?.epoch === 1)
    assertExists(region, 'A stack shows a first-epoch tile')
    const spaceId = emptySpaces(state, 'farm')[0]
    placeMarker(state, ruler, spaceId)
    placeMarker(state, serf, spaceId)
    const { id } = collectTopTile(state, ruler, region).tile
    const holder = state.getPlayerState(ruler)
    holder.regionTiles = holder.regionTiles.filter((held) => held !== id)
    state.spaces[spaceId].landscape = { tileId: id, amount: 0 }
    fillLandscape(state, spaceId)
    state.recomputeRanks()
}

/** R-3.2, R-4.11, R-4.12 Every seat forfeits its last card, so the roll and any dawn come. */
export async function playOutRound(
    epoch: DawnEpoch | undefined,
    arrange?: (state: HydratedFeudumGameState, table: { seat: string; other: string }) => void,
    tops?: readonly StackShowing[],
    beforeForfeits?: (host: FeudumHost, seat: string) => Promise<void>
): Promise<RoundEndTable> {
    const { host, seat, other } = await atPlayingCards(['move'], { otherCards: ['move'] })
    host.edit((state) => {
        arrange?.(state, { seat, other })
        if (epoch) {
            showOnStacks(state, tops ?? Triggers[epoch].tops)
            state.epoch = Triggers[epoch].from
        } else if (tops) {
            showOnStacks(state, tops)
        }
    })
    const sessions: FeudumGameSession[] = []
    for (const id of host.order) {
        sessions.push(await host.openSeat(id))
    }
    const session = sessions[host.order.indexOf(seat)]
    for (const seen of sessions) {
        await settled(seen)
    }
    await beforeForfeits?.(host, seat)
    while (session.gameState.machineState === MachineState.PlayingCards) {
        const [asked] = session.gameState.activePlayerIds
        let kind: ActionCardKind | undefined
        host.edit((state) => {
            kind = state.getPlayerState(asked).hand?.[0]
        })
        assertExists(kind, 'R-3.2 The seat asked holds a card')
        await host.send(asked, { type: ActionType.ForfeitCard, kind })
        for (const seen of sessions) {
            await settled(seen)
        }
    }
    while (session.gameState.machineState === MachineState.Nourishing) {
        const [asked] = session.gameState.activePlayerIds
        const own = sessions[host.order.indexOf(asked)]
        const feeding = nourishOffer(own.gameState, asked)?.preselected
        assertExists(feeding, 'R-4.10-H4 The seat nourishing waits on decides its feeding')
        await host.send(asked, { type: ActionType.Nourish, ...feeding })
        for (const seen of sessions) {
            await settled(seen)
        }
    }
    return { host, seat, other, sessions, session }
}
