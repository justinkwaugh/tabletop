import { RAILROADS, REPAIRS_EVENT, type RailroadId } from '@tabletop/promontory-point'
import type { DescriptionPart } from '$lib/utils/actionDescription.js'
import type { RepairsDraftView } from './repairsDraft.js'
import { RAILROAD_TAGS } from './railroadTags.js'

export type RepairsPrompt = {
    lead: string
    parts: DescriptionPart[]
    note: string
}

export type RepairsEntryView = {
    railroadId: RailroadId
    name: string
    holding: string
    // The phone's one-button entry: "SP ×5 · +$3 each".
    short: string
    priceLine: { price: string; proceeds: string }
    sellLabel: string
    stagedNote: string | undefined
    locked: boolean
}

export type RepairsPanel = {
    prompt: RepairsPrompt
    entries: RepairsEntryView[]
    runningLine: string
    enough: boolean
    // R-4.3-H1: the bill stays as fixed though the seat sells the railroad that caused it.
    billNote: string | undefined
    // R-4.3-H3: short after every sale, so one press sells them all.
    everySaleNote: string | undefined
    send: { label: string; ready: boolean }
}

// R-4.3, R-4.3-H1 to H3: the deciding short seat's panel, from its Repairs draft.
export function repairsPanel(
    draft: RepairsDraftView,
    placingPlayerId: string,
    viewerId: string
): RepairsPanel {
    const tag = RAILROAD_TAGS[draft.railroadId]
    const billed = draft.entries.find((entry) => entry.railroadId === draft.railroadId)
    const why =
        billed === undefined
            ? ''
            : ` (${billed.held} ${tag} ${billed.held === 1 ? 'share' : 'shares'} × $${REPAIRS_EVENT.dollarsPerShare})`
    const placer: DescriptionPart[] =
        placingPlayerId === viewerId
            ? [{ kind: 'text', text: 'You' }]
            : [{ kind: 'player', playerId: placingPlayerId }]
    return {
        prompt: {
            lead: `Repairs on ${RAILROADS[draft.railroadId].name}.`,
            parts: [
                ...placer,
                {
                    kind: 'text',
                    text: ` placed ${tag} on a Repairs town. You owe $${draft.owed}${why} and have $${draft.money}.`
                }
            ],
            note:
                draft.entries.length === 0
                    ? 'You hold no shares to sell: pay what you have and the rest is forgiven.'
                    : 'Sell shares at half price, rounded down, one at a time, until you can pay.'
        },
        entries: draft.entries.map((entry) => ({
            railroadId: entry.railroadId,
            name: RAILROADS[entry.railroadId].name,
            holding: `you hold ${entry.held}`,
            short: `${RAILROAD_TAGS[entry.railroadId]} ×${entry.held}`,
            priceLine: { price: `$${entry.price}`, proceeds: `$${entry.proceedsEach}` },
            sellLabel: `+$${entry.proceedsEach}`,
            stagedNote: entry.staged > 0 ? `${entry.staged} picked` : undefined,
            locked: entry.locked
        })),
        runningLine: draft.runningLine,
        enough: draft.enough,
        billNote: draft.holdsBilledRailroad
            ? `Selling ${tag} does not lower the bill. The other rows lock once you can pay.`
            : undefined,
        everySaleNote:
            draft.shortAfterEverySale && draft.entries.length > 0
                ? 'Selling every share still leaves you short: one press sells them all.'
                : undefined,
        send: { label: draft.send.label, ready: draft.send.ready }
    }
}
