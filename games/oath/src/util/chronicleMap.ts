import { assert, assertExists } from '@tabletop/common'
import type { HydratedOathGameState, RelicSlot } from '../model/gameState.js'
import { CardKind, Region } from '../model/oathEnums.js'
import {
    ChronicleKeptFor,
    type ChronicleMapRecord,
    type ChronicleMove,
    type ChronicleRuin
} from '../model/chronicle.js'
import { discardOnto, drawSites } from '../model/vault.js'
import { OBSIDIAN_CAGE_ID } from '../data/relics.js'
import { chronicleWinnerOf } from './chronicleChoices.js'
import { ChronicleShuffle, chronicleShuffles } from './chronicleRandom.js'
import { rulesSite } from './rule.js'
import { forestTempleKeepsSite } from './persistent.js'
import { killWarbands, returnWarbandsOnCardToBanks } from './force.js'
import { warbandEntries } from './warbands.js'
import { forgetRelicSlots, forgetSitePeeks, renameRelicSlots } from './knowledge.js'

/** R-2.1.1 — the regions, top of the map first. */
const REGIONS = [Region.Cradle, Region.Provinces, Region.Hinterland] as const

/**
 * R-8.3.2 to R-8.3.5 — the map cleaned up and refilled. Afterwards the eight slots, each with its
 * facing, are the stack R-8.7.1 saves: positional, facedown slots included.
 */
export function cleanUpMap(state: HydratedOathGameState): ChronicleMapRecord {
    const discarded = discardSites(state)
    const { ruins, setAside } = ruinAndSetAside(state)
    clearMap(state)
    return { ...discarded, ruins, ...fillSlots(state, setAside) }
}

/**
 * R-8.3.2 — keep the sites the winner rules (R-10.21 with R-6.6.3, and the Bandit Crown's
 * answers), those with an intact edifice, and those Forest Temple keeps, all read on the map as
 * given; shuffle every other site into the site deck. Its denizens go to the Cradle's pile, its
 * relics to the relic deck, and a ruin there back to the Archive.
 */
export function discardSites(
    state: HydratedOathGameState
): Pick<
    ChronicleMapRecord,
    'kept' | 'keptFor' | 'discarded' | 'discardedFacedown' | 'denizensDiscarded'
> {
    const vault = state.requireVault()
    const winnerId = chronicleWinnerOf(state)
    const keeps = new Map<string, ChronicleKeptFor>()
    for (const slotId of state.allSiteIds()) {
        const reason = rulesSite(state, winnerId, slotId)
            ? ChronicleKeptFor.Ruled
            : hasIntactEdifice(state, slotId)
              ? ChronicleKeptFor.Edifice
              : forestTempleKeepsSite(state, slotId)
                ? ChronicleKeptFor.ForestTemple
                : undefined
        if (reason) keeps.set(slotId, reason)
    }
    const kept: string[] = []
    const keptFor: Record<string, ChronicleKeptFor> = {}
    const discarded: string[] = []
    let discardedFacedown = 0
    let denizensDiscarded = 0
    for (const slotId of state.allSiteIds()) {
        const faceupCardId = state.siteCardAt(slotId)
        const keptBecause = keeps.get(slotId)
        if (keptBecause) {
            assertExists(faceupCardId, `R-8.3.2 — a site kept at ${slotId} is faceup`)
            kept.push(faceupCardId)
            keptFor[faceupCardId] = keptBecause
            continue
        }
        let siteCardId = faceupCardId
        if (siteCardId === undefined) {
            siteCardId = vault.siteFacedown[slotId]
            assertExists(siteCardId, `R-9.4 — the vault holds the facedown site at ${slotId}`)
            delete vault.siteFacedown[slotId]
            discardedFacedown += 1
        } else {
            delete state.siteCards[slotId]
            discarded.push(siteCardId)
        }
        clearPiecesOn(state, siteCardId)
        vault.siteDeck.push(siteCardId)

        const cards = state.denizensAt(slotId)
        const denizens = cards.filter((cardId) => !state.isEdifice(cardId))
        for (const cardId of cards) {
            clearPiecesOn(state, cardId)
            // A ruin goes back to the Archive, where every edifice waits intact side up (R-8.3.1).
            if (state.isEdifice(cardId)) state.setEdificeRuined(cardId, false)
        }
        delete state.denizensBySite[slotId]
        discardToCradlePile(state, denizens)
        denizensDiscarded += denizens.length

        const relicSlotIds = state.relicSlotsAt(slotId).map((slot) => slot.slotId)
        for (const relicSlotId of relicSlotIds) {
            const relicCardId = vault.relicFacedown[relicSlotId]
            assertExists(relicCardId, `R-9.4 — the vault holds the relic at ${relicSlotId}`)
            delete vault.relicFacedown[relicSlotId]
            vault.relicDeck.push(relicCardId)
        }
        forgetRelicSlots(state, relicSlotIds)
        delete state.relicsBySite[slotId]
        // Salt the Earth — the capacity is the site card's, so it leaves with it.
        delete state.siteCapacityOverrides[slotId]
    }
    chronicleShuffles.shuffle(state, ChronicleShuffle.SiteDeck, vault.siteDeck)
    return { kept, keptFor, discarded, discardedFacedown, denizensDiscarded }
}

/**
 * R-8.3.3 — flip the intact edifices at sites the winner does not rule and discard the denizens
 * there; then set aside every site with a ruin, both those just flipped and the winner's own
 * unrepaired ones, top Cradle slot first. A set-aside site keeps its slot's records until R-8.3.5
 * places it.
 */
export function ruinAndSetAside(state: HydratedOathGameState): {
    ruins: ChronicleRuin[]
    setAside: string[]
} {
    const winnerId = chronicleWinnerOf(state)
    const ruins: ChronicleRuin[] = []
    for (const slotId of state.faceupSiteIds()) {
        if (rulesSite(state, winnerId, slotId)) continue
        const intact = state
            .denizensAt(slotId)
            .filter((cardId) => state.isEdifice(cardId) && !state.isRuined(cardId))
        if (intact.length === 0) continue
        for (const edificeId of intact) state.setEdificeRuined(edificeId, true)
        const denizens = state.denizensAt(slotId).filter((cardId) => !state.isEdifice(cardId))
        for (const cardId of denizens) clearPiecesOn(state, cardId)
        state.denizensBySite[slotId] = state
            .denizensAt(slotId)
            .filter((cardId) => state.isEdifice(cardId))
        discardToCradlePile(state, denizens)
        const siteCardId = state.siteCardAt(slotId)
        assertExists(siteCardId, `${slotId} is faceup`)
        for (const edificeId of intact)
            ruins.push({ edificeId, siteCardId, denizensDiscarded: denizens.length })
    }
    const setAside = state
        .faceupSiteIds()
        .filter((slotId) => state.denizensAt(slotId).some((cardId) => state.isRuined(cardId)))
    return { ruins, setAside }
}

/**
 * R-8.3.4 — every pawn, favor, secret and warband leaves the map, the Obsidian Cage's warbands
 * with them: warbands to their banks, favor to the supply. Secrets have no supply (R-9.3).
 */
export function clearMap(state: HydratedOathGameState): void {
    for (const slotId of state.allSiteIds()) {
        for (const [owner, count] of warbandEntries(state.warbandsBySite[slotId] ?? {}))
            killWarbands(state, owner, count)
        const siteCardId = state.siteCardAt(slotId)
        if (siteCardId !== undefined) clearPiecesOn(state, siteCardId)
        for (const cardId of state.denizensAt(slotId)) clearPiecesOn(state, cardId)
    }
    state.warbandsBySite = {}
    returnWarbandsOnCardToBanks(state, OBSIDIAN_CAGE_ID)
    for (const player of state.players) delete player.siteId
}

/** What a faceup site carries when R-8.3.5 moves it. */
interface SiteCards {
    siteCardId: string
    denizens: string[]
    relics: RelicSlot[]
    capacity: number | undefined
}

/** A region's slots, top first, each holding the slot its site came from. */
type Column = (string | undefined)[]

/**
 * R-8.3.5 — the seven steps in the Law's order, each site moving with its denizens, intact
 * edifice and relics. Facedown sites are dealt into the empty slots in deal order, and the top
 * site of a region with no faceup site is flipped with no reveal prompt (R-8.3.5-H1): R-8.6.2
 * gives it its relics.
 */
export function fillSlots(
    state: HydratedOathGameState,
    setAside: readonly string[]
): Pick<ChronicleMapRecord, 'moved' | 'dealt' | 'flipped'> {
    const vault = state.requireVault()
    assert(
        Object.keys(vault.siteFacedown).length === 0,
        'R-8.3.2 — every facedown site went back to the site deck'
    )
    const columns = Object.fromEntries(
        REGIONS.map((region): [Region, Column] => [
            region,
            state.map[region].map((slotId) =>
                state.isSiteFaceup(slotId) && !setAside.includes(slotId) ? slotId : undefined
            )
        ])
    )
    const cradle = columns[Region.Cradle]
    const provinces = columns[Region.Provinces]
    const hinterland = columns[Region.Hinterland]
    // 1 to 3 — push each region's sites up, then move sites in from the regions below, top first.
    fillTopDown(cradle, [provinces, hinterland])
    fillTopDown(provinces, [hinterland])
    fillTopDown(hinterland, [])
    // 4 and 5 — the reverse order: the lowest set-aside site into the lowest empty slot.
    const waiting = [...setAside]
    fillBottomUp(hinterland, waiting)
    fillBottomUp(provinces, waiting)
    assert(waiting.length === 0, 'R-8.3.3 — every set-aside site fits the Provinces and Hinterland')

    const carried = new Map(
        state.faceupSiteIds().map((slotId): [string, SiteCards] => {
            const siteCardId = state.siteCardAt(slotId)
            assertExists(siteCardId, `${slotId} is faceup`)
            return [
                slotId,
                {
                    siteCardId,
                    denizens: state.denizensAt(slotId),
                    relics: state.relicSlotsAt(slotId),
                    capacity: state.siteCapacityOverrides[slotId]
                }
            ]
        })
    )
    state.siteCards = {}
    state.denizensBySite = {}
    state.relicsBySite = {}
    state.siteCapacityOverrides = {}

    const moved: ChronicleMove[] = []
    const dealt: string[] = []
    const renames = new Map<string, string>()
    for (const region of REGIONS) {
        for (const [index, slotId] of state.map[region].entries()) {
            const from = columns[region][index]
            if (from === undefined) {
                // 6
                const [siteCardId] = drawSites(vault, 1)
                assertExists(
                    siteCardId,
                    'R-8.3.2 — the site deck holds a site for every empty slot'
                )
                vault.siteFacedown[slotId] = siteCardId
                dealt.push(slotId)
                continue
            }
            const site = carried.get(from)
            assertExists(site, `R-8.3.5 — the site from ${from} was on the map`)
            state.siteCards[slotId] = site.siteCardId
            if (site.denizens.length > 0) state.denizensBySite[slotId] = site.denizens
            if (site.relics.length > 0) {
                state.relicsBySite[slotId] = site.relics.map((relic, at) => {
                    const relicSlotId = relicSlotIdAt(slotId, at)
                    renames.set(relic.slotId, relicSlotId)
                    return { slotId: relicSlotId }
                })
            }
            if (site.capacity !== undefined) state.siteCapacityOverrides[slotId] = site.capacity
            if (from !== slotId) {
                moved.push({
                    siteCardId: site.siteCardId,
                    from,
                    to: slotId,
                    fromRegion: state.regionOf(from),
                    toRegion: region
                })
            }
        }
    }
    renameRelicSlots(state, renames)
    forgetSitePeeks(state)

    // 7
    const flipped = REGIONS.flatMap((region) => {
        const slots = state.map[region]
        if (slots.some((slotId) => state.isSiteFaceup(slotId))) return []
        const [top] = slots
        const siteCardId = vault.siteFacedown[top]
        assertExists(siteCardId, `R-8.3.5 — step 6 dealt a site to ${top}`)
        delete vault.siteFacedown[top]
        state.siteCards[top] = siteCardId
        return [{ slotId: top, siteCardId }]
    })
    return { moved, dealt, flipped }
}

/** R-8.3.5 steps 1 to 3 — push the column's sites up, then take the top site of each source in turn. */
function fillTopDown(column: Column, sources: readonly Column[]): void {
    const own = column.filter((from) => from !== undefined)
    column.splice(0, column.length, ...column.map((_, at) => own[at]))
    for (const source of sources) {
        for (const [at, from] of column.entries()) {
            if (from !== undefined) continue
            const top = source.findIndex((candidate) => candidate !== undefined)
            if (top < 0) break
            column[at] = source[top]
            source[top] = undefined
        }
    }
}

/** R-8.3.5 steps 4 and 5 — empty slots from the bottom, set-aside sites from the bottom. */
function fillBottomUp(column: Column, waiting: string[]): void {
    for (let at = column.length - 1; at >= 0 && waiting.length > 0; at--) {
        if (column[at] === undefined) column[at] = waiting.pop()
    }
}

/** R-2.8.2 — relic slots are named by their site's slot and place, so a site's next relic never reuses a name. */
export function relicSlotIdAt(siteSlotId: string, at: number): string {
    return `${siteSlotId}.relic.${at}`
}

/** R-8.6.1 — a relic left the site: the ones still there are renamed by place. */
export function renameRelicSlotsAt(state: HydratedOathGameState, siteSlotId: string): void {
    const renames = new Map<string, string>()
    state.relicsBySite[siteSlotId] = state.relicSlotsAt(siteSlotId).map((relic, at) => {
        const relicSlotId = relicSlotIdAt(siteSlotId, at)
        renames.set(relic.slotId, relicSlotId)
        return { slotId: relicSlotId }
    })
    renameRelicSlots(state, renames)
}

function hasIntactEdifice(state: HydratedOathGameState, slotId: string): boolean {
    return state
        .denizensAt(slotId)
        .some((cardId) => state.isEdifice(cardId) && !state.isRuined(cardId))
}

/**
 * R-8.3.4, R-8.5, R-8.8 — a card leaving the map or play in the chronicle takes no piece with it:
 * its favor goes to the supply, its warbands to their banks, and its secrets have no supply (R-9.3).
 */
export function clearPiecesOn(state: HydratedOathGameState, cardId: string): void {
    state.favorSupply += state.tokensOn(cardId).favor
    delete state.cardTokens[cardId]
    returnWarbandsOnCardToBanks(state, cardId)
}

/** R-8.3.2, R-8.3.3 — the Cradle's pile for every discard here (the pile changes nothing: R-8.5 shuffles them all). */
export function discardToCradlePile(
    state: HydratedOathGameState,
    cardIds: readonly string[]
): void {
    if (cardIds.length === 0) return
    discardOnto(state.requireVault(), Region.Cradle, [...cardIds])
    state.discardPileCounts[Region.Cradle] += cardIds.length
    state.discardTopBackType = { ...state.discardTopBackType, [Region.Cradle]: CardKind.Denizen }
}

/** R-8.7.1 — the map is the saved stack: one site in every slot, a faceup one in every region, no ruin in the Cradle. */
export function assertSavedMap(state: HydratedOathGameState): void {
    const vault = state.requireVault()
    for (const slotId of state.allSiteIds()) {
        assert(
            state.isSiteFaceup(slotId) !== (vault.siteFacedown[slotId] !== undefined),
            `R-8.7.1 — ${slotId} holds one site`
        )
    }
    for (const region of REGIONS) {
        assert(
            state.map[region].some((slotId) => state.isSiteFaceup(slotId)),
            `R-8.3.5 — the ${region} has a faceup site`
        )
    }
    assert(
        state.map[Region.Cradle].every(
            (slotId) => !state.denizensAt(slotId).some((cardId) => state.isRuined(cardId))
        ),
        'R-8.3.5 — ruins come back only to the Provinces and the Hinterland'
    )
}
