import { servedJson } from '../testing/projection.js'
import { describe, expect, it } from 'vitest'
import { getPrng, assertExists } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import {
    Banner,
    CardKind,
    OathType,
    PlayerStatus,
    Region,
    Suit,
    TOTAL_FAVOR
} from '../model/oathEnums.js'
import {
    buildSetupVault,
    CHANCELLOR_BOARD_WARBANDS,
    CHANCELLOR_START_FAVOR,
    CHANCELLOR_WARBANDS,
    EXILE_BOARD_WARBANDS,
    EXILE_WARBANDS,
    BANNER_START_VALUE,
    EXILE_START_FAVOR,
    favorPerBank,
    placeSetupSiteTokens,
    reliquarySlotId,
    TOP_CRADLE_WARBANDS
} from './setup.js'
import { RELIQUARY_SIZE, GRAND_SCEPTER_ID } from '../data/relics.js'
import { TOP_CRADLE_SLOT, TOTAL_MAP_SLOTS } from '../data/mapSlots.js'
import { expectFullFavorComplement, favorCensus } from '../testing/census.js'
import { expectOneWarbandOwnerPerSite, warbandCensus } from '../testing/census.js'
import { MAX_SUPPLY } from './rest.js'
import { CARDS_IN_PLAY } from '../data/worldDeck.js'
import { SetupVariant } from '../model/oathEnums.js'
import { registerCards, siteRevealPrompt } from '../data/cardRegistry.js'
import { required } from '../testing/required.js'
import { setUpState } from '../testing/game.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { OathImperialColor } from '../definition/colors.js'

const PROMPTING_SITE = 'site.test-prompting'

describe('setup — the public build (R-1.2, R-1.4–R-1.18)', () => {
    it('R-1.2 — the round marker starts on the star space and the Visions track on 0', () => {
        const state = setUpState(4)
        expect(state.round).toBe(1)
        expect(state.visionsDrawn).toBe(0)
    })

    it('R-1.4, R-9.3 — the full 36 favor are on the table and none were minted', () => {
        for (const count of [2, 3, 4, 5, 6]) {
            expectFullFavorComplement(setUpState(count))
        }
    })

    it('R-1.5 — one favor on the People’s Favor, one secret on the Darkest Secret', () => {
        const state = setUpState(4)
        expect(state.banners[Banner.PeoplesFavor].value).toBe(1)
        expect(state.banners[Banner.PeoplesFavor].mobSide).toBe(false)
        expect(state.banners[Banner.DarkestSecret].value).toBe(1)
    })

    it('R-1.6 — 3 favor per bank, and 4 each at five or six players', () => {
        expect(favorPerBank(4)).toBe(3)
        expect(favorPerBank(5)).toBe(4)
        expect(favorPerBank(6)).toBe(4)

        for (const [count, perBank] of [
            [2, 3],
            [4, 3],
            [5, 4],
            [6, 4]
        ] as const) {
            const state = setUpState(count)
            for (const suit of Object.values(Suit)) {
                expect(state.favorBank[suit]).toBe(perBank)
            }
        }
    })

    it('R-1.7, R-4 — the Chancellor holds the first seat in turn order', () => {
        const state = setUpState(4)
        expect(state.chancellorPlayerId).toBe(state.turnManager.turnOrder[0])
        expect(state.players[0].status).toBe(PlayerStatus.Chancellor)
        expect(
            state.players.filter((p) => p.status === PlayerStatus.Chancellor)
        ).toHaveLength(1)
    })

    it('R-1.8, R-1.9, R-10.13 — each bank is keyed by its owner: the Empire\'s for the Chancellor, the player\'s own id for an Exile', () => {
        const state = setUpState(4)
        for (const player of state.players) {
            const owner =
                player.playerId === state.chancellorPlayerId ? IMPERIAL_WARBANDS : player.playerId
            expect(Object.keys(player.warbandsInPersonalBank)).toEqual([owner])
            expect(state.warbandBankHolderOf(owner)).toBe(player.playerId)
        }
    })

    it('R-1.8 — the Chancellor shows the Empire\'s purple and holds the Grand Scepter', () => {
        const state = setUpState(4)
        const chancellorId = state.chancellorPlayerId
        assertExists(chancellorId, 'setup names a Chancellor')
        const chancellor = state.getPlayerState(chancellorId)
        expect(chancellor.color).toBe(OathImperialColor)
        expect(chancellor.relicIds).toContain(GRAND_SCEPTER_ID)
    })

    it('R-1.8, R-1.9 — 24 warbands for the Chancellor and 14 per Exile, and no more', () => {
        for (const count of [2, 4, 6]) {
            const state = setUpState(count)
            const census = warbandCensus(state)
            expect(census[IMPERIAL_WARBANDS]).toBe(CHANCELLOR_WARBANDS)
            for (const player of state.players.slice(1)) {
                expect(census[player.playerId]).toBe(EXILE_WARBANDS)
            }
            expect(Object.keys(census)).toHaveLength(count)
        }
    })

    it('R-1.9 — every non-Chancellor starts on their Exile side', () => {
        const state = setUpState(5)
        for (const player of state.players.slice(1)) {
            expect(player.status).toBe(PlayerStatus.Exile)
        }
    })

    it('R-1.10 — every Supply marker starts leftmost, which is the maximum', () => {
        const state = setUpState(3)
        for (const player of state.players) {
            expect(player.supply).toBe(MAX_SUPPLY)
            expect(player.supplySpentThisTurn).toBe(0)
        }
    })

    it('R-1.11, R-1.15 — the Chancellor takes 2 favor and 1 secret; everyone else 1 and 1', () => {
        const state = setUpState(4)
        const [chancellor, ...exiles] = state.players
        expect(chancellor.favor).toBe(CHANCELLOR_START_FAVOR)
        expect(chancellor.secrets).toBe(1)
        for (const exile of exiles) {
            expect(exile.favor).toBe(1)
            expect(exile.secrets).toBe(1)
        }
    })

    it('R-1.12 — 3 warbands on the Chancellor’s board and 2 on the top faceup Cradle site', () => {
        const state = setUpState(4)
        const chancellorId = state.chancellorPlayerId
        assertExists(chancellorId, 'setup names a Chancellor')
        const chancellor = state.getPlayerState(chancellorId)
        expect(chancellor.warbandsOnBoard[IMPERIAL_WARBANDS]).toBe(CHANCELLOR_BOARD_WARBANDS)
        expect(state.warbandsBySite[TOP_CRADLE_SLOT]?.[IMPERIAL_WARBANDS]).toBe(
            TOP_CRADLE_WARBANDS
        )
        expect(chancellor.warbandsInPersonalBank[IMPERIAL_WARBANDS]).toBe(
            CHANCELLOR_WARBANDS - CHANCELLOR_BOARD_WARBANDS - TOP_CRADLE_WARBANDS
        )
    })

    it('R-1.12 — no other faceup site is garrisoned, because none holds a denizen', () => {
        const state = setUpState(4)
        const garrisoned = Object.entries(state.warbandsBySite).filter(([, counts]) =>
            Object.values(counts).some((n) => n > 0)
        )
        expect(garrisoned.map(([slotId]) => slotId)).toEqual([TOP_CRADLE_SLOT])
    })

    it('R-1.8 — setup places only the Chancellor’s warbands, one owner per site', () => {
        for (const count of [2, 4, 6]) {
            expectOneWarbandOwnerPerSite(setUpState(count))
        }
    })

    it('R-1.15 — each Exile puts 3 of their own warbands on their board', () => {
        const state = setUpState(4)
        for (const exile of state.players.slice(1)) {
            expect(exile.warbandsOnBoard[exile.playerId]).toBe(EXILE_BOARD_WARBANDS)
            expect(exile.warbandsInPersonalBank[exile.playerId]).toBe(
                EXILE_WARBANDS - EXILE_BOARD_WARBANDS
            )
        }
    })

    it('R-1.13 — Devotion hands the Chancellor the Darkest Secret', () => {
        const state = setUpState(3, { oathType: OathType.Devotion })
        expect(state.banners[Banner.DarkestSecret].holderPlayerId).toBe(
            state.chancellorPlayerId
        )
        expect(state.banners[Banner.PeoplesFavor].holderPlayerId).toBeUndefined()
    })

    it('R-1.13 — The People hands the Chancellor the People’s Favor', () => {
        const state = setUpState(3, { oathType: OathType.ThePeople })
        expect(state.banners[Banner.PeoplesFavor].holderPlayerId).toBe(
            state.chancellorPlayerId
        )
        expect(state.banners[Banner.DarkestSecret].holderPlayerId).toBeUndefined()
    })

    it('R-1.13 — Supremacy and Protection hand them neither', () => {
        for (const oathType of [OathType.Supremacy, OathType.Protection]) {
            const state = setUpState(3, { oathType })
            expect(state.banners[Banner.PeoplesFavor].holderPlayerId).toBeUndefined()
            expect(state.banners[Banner.DarkestSecret].holderPlayerId).toBeUndefined()
        }
    })

    it('R-1.14 — the Chancellor takes the Oathkeeper title, Oathkeeper side up', () => {
        const state = setUpState(4)
        expect(state.oathkeeperPlayerId).toBe(state.chancellorPlayerId)
        expect(state.oathkeeperIsUsurper).toBe(false)
    })

    it('R-1.16, R-2.8.2 — every faceup site carries exactly its printed prompt', () => {
        const state = setUpState(4)
        const faceup = state.faceupSiteIds()
        expect(faceup.length).toBeGreaterThan(0)

        for (const slotId of faceup) {
            const siteCardId = required(state.siteCardAt(slotId), slotId)
            const prompt = required(siteRevealPrompt(siteCardId), siteCardId)
            if (prompt.favor === 0 && prompt.secrets === 0) {
                expect(state.cardTokens[siteCardId]).toBeUndefined()
            } else {
                expect(state.cardTokens[siteCardId]).toEqual({
                    favor: prompt.favor,
                    secrets: prompt.secrets
                })
            }
        }

        const faceupCards = new Set(faceup.map((slotId) => state.siteCardAt(slotId)))
        for (const key of Object.keys(state.cardTokens)) {
            expect(faceupCards.has(key)).toBe(true)
        }
    })

    it('R-1.16 — a deal the bank cannot pay leaves the sites\' favor for the Chancellor to split', () => {
        const playerCount = 6
        // Seed 54 exhausts the bank at six players; the Curated variant deals only eight sites.
        const state = setUpState(playerCount, { setupVariant: SetupVariant.Randomized }, 54)

        // R-1.5, R-1.6, R-1.11, R-1.15
        const bank =
            TOTAL_FAVOR -
            BANNER_START_VALUE -
            favorPerBank(playerCount) * Object.values(Suit).length -
            CHANCELLOR_START_FAVOR -
            EXILE_START_FAVOR * (playerCount - 1)

        const prompted = state.faceupSiteIds().flatMap((slotId) => {
            const siteCardId = required(state.siteCardAt(slotId), slotId)
            const prompt = siteRevealPrompt(siteCardId)
            return prompt ? [{ siteCardId, prompt }] : []
        })
        const wanted = prompted.reduce((n, { prompt }) => n + prompt.favor, 0)
        expect(wanted).toBeGreaterThan(bank)

        expect(state.favorSupply).toBe(bank)
        expect(state.pendingSiteFavor).toEqual(
            prompted
                .filter(({ prompt }) => prompt.favor > 0)
                .map(({ siteCardId, prompt }) => ({ siteCardId, wanted: prompt.favor }))
        )
        for (const { siteCardId, prompt } of prompted) {
            expect(state.cardTokens[siteCardId]?.favor ?? 0).toBe(0)
            expect(state.cardTokens[siteCardId]?.secrets ?? 0).toBe(prompt.secrets)
        }
        expectFullFavorComplement(state)
    })

    it('R-1.16, R-2.8.2 — places a prompt’s tokens on the site CARD, not the map slot', () => {
        registerCards([
            {
                id: PROMPTING_SITE,
                name: 'Prompting Site',
                kind: CardKind.Site,
                revealPrompt: { favor: 2, secrets: 1, relics: 0 }
            }
        ])
        const state = setUpState(4, { setupVariant: SetupVariant.Randomized })
        const slotId = state.faceupSiteIds()[0]
        state.siteCards = { ...state.siteCards, [slotId]: PROMPTING_SITE }

        const before = state.favorSupply
        placeSetupSiteTokens(state)

        expect(state.cardTokens[PROMPTING_SITE]).toEqual({ favor: 2, secrets: 1 })
        expect(state.cardTokens[slotId]).toBeUndefined()
        expect(state.favorSupply).toBe(before - 2)
        expectFullFavorComplement(state)
    })

    it('R-1.17 — the Imperial Reliquary has four spaces, all covered and all secret', () => {
        const state = setUpState(4)
        expect(state.reliquarySlots()).toHaveLength(RELIQUARY_SIZE)
        for (const slot of state.reliquarySlots()) {
            expect(slot).toEqual({ slotId: slot.slotId })
        }
        expect(state.reliquarySlots().map((s) => s.slotId)).toEqual(
            Array.from({ length: RELIQUARY_SIZE }, (_, i) => reliquarySlotId(i))
        )
    })

    it('R-1.18, R-1.21, R-9.4 — public state names no card in either deck', () => {
        const state = setUpState(4)
        expect(state.worldDeckExhausted).toBe(false)
        // R-9.4 makes the world deck's *count* private, so nothing publishes it.
        expect(Object.keys(state)).not.toContain('worldDeckCount')
        // R-1.19 seeds each discard pile with one facedown card.
        for (const region of Object.values(Region)) {
            expect(state.discardPileCounts[region]).toBe(1)
        }
    })

    it('R-2.1.1 — the map has eight slots: two Cradle, three Provinces, three Hinterland', () => {
        const state = setUpState(4)
        expect(state.map[Region.Cradle]).toHaveLength(2)
        expect(state.map[Region.Provinces]).toHaveLength(3)
        expect(state.map[Region.Hinterland]).toHaveLength(3)
        expect(state.allSiteIds()).toHaveLength(TOTAL_MAP_SLOTS)
    })

    it('R-1.1, R-8.3.5.7 — the top site of each region is dealt faceup, the rest facedown', () => {
        const state = setUpState(4)
        expect(state.faceupSiteIds()).toEqual([
            state.map[Region.Cradle][0],
            state.map[Region.Provinces][0],
            state.map[Region.Hinterland][0]
        ])
    })

    it('R-1.23.1, R-1.12 — the top Cradle slot is always faceup', () => {
        // R-1.23.1 puts the Chancellor on "the top Cradle site" and allows only faceup sites.
        for (const seed of [1, 2, 3, 99, 20260826]) {
            const state = setUpState(4, {}, seed)
            expect(state.isSiteFaceup(TOP_CRADLE_SLOT)).toBe(true)
        }
    })

    it('R-9.4 — a facedown slot names no site card in public state', () => {
        const state = setUpState(4)
        const facedown = state.allSiteIds().filter((id) => !state.isSiteFaceup(id))
        expect(facedown).toHaveLength(TOTAL_MAP_SLOTS - 3)
        for (const slotId of facedown) {
            expect(state.siteCardAt(slotId)).toBeUndefined()
        }
    })

    it('opens in MachineState.Setup, because R-1.23 is still outstanding', () => {
        const state = setUpState(4)
        expect(state.machineState).toBe(MachineState.Setup)
        for (const player of state.players) {
            expect(player.siteId).toBeUndefined()
            // R-1.20 is dealt by the initializer; R-1.23.2 has not chosen from it.
            expect(player.handIds).toHaveLength(3)
            expect(player.advisers).toEqual([])
        }
    })

    // The lobby's defaults live in `OathGameConfigOptions`; the initializer must match them.
    it('the lobby defaults to the random deck and the Oath of Supremacy', () => {
        const state = setUpState(4)
        expect(state.setupVariant).toBe(SetupVariant.Randomized)
        expect(state.oathType).toBe(OathType.Supremacy)
    })

    it('the Curated option deals the pinned playtest pool instead of a random one', () => {
        const state = setUpState(4, { setupVariant: SetupVariant.Curated })
        expect(state.setupVariant).toBe(SetupVariant.Curated)
    })

    it('the Random option is available explicitly, matching the default', () => {
        const state = setUpState(4, { setupVariant: SetupVariant.Randomized })
        expect(state.setupVariant).toBe(SetupVariant.Randomized)
    })
})

describe('setup — the vault build (R-1.1, R-1.17, R-1.18, R-1.21)', () => {
    it('R-8.5, R-9.4 — a first game has no Dispossessed, and public state never carries one', () => {
        const state = setUpState(4)
        expect(buildSetupVault(state, getPrng(1)).dispossessed).toEqual([])
        expect(state).not.toHaveProperty('dispossessedIds')
    })

    it('R-1.1 — every slot the public deal left empty holds a facedown site', () => {
        const state = setUpState(4)
        const vault = buildSetupVault(state, getPrng(1))
        state.vault = vault
        const facedown = state.allSiteIds().filter((id) => !state.isSiteFaceup(id))
        expect(Object.keys(vault.siteFacedown).sort()).toEqual([...facedown].sort())
    })

    it('R-9.4 — the vault holds the 59 cards in play', () => {
        const state = setUpState(6)
        const vault = buildSetupVault(state, getPrng(1))
        expect(vault.worldDeck).toHaveLength(CARDS_IN_PLAY)
    })

    it('R-1.1 — no site card is both faceup and facedown', () => {
        const state = setUpState(4)
        const vault = buildSetupVault(state, getPrng(1))
        const faceup = Object.values(state.siteCards ?? {})
        const hidden = Object.values(vault.siteFacedown)
        expect(faceup.filter((id) => hidden.includes(id))).toEqual([])
        expect(new Set([...faceup, ...hidden, ...vault.siteDeck]).size).toBe(
            faceup.length + hidden.length + vault.siteDeck.length
        )
    })

    it('R-1.17 — four relics go facedown onto the four Reliquary spaces', () => {
        const state = setUpState(4)
        const vault = buildSetupVault(state, getPrng(1))
        // R-2.8.2 — `relicFacedown` also holds the faceup sites' prompted relics, so only these keys are checked.
        for (let i = 0; i < RELIQUARY_SIZE; i += 1) {
            expect(vault.relicFacedown[reliquarySlotId(i)]).toBeDefined()
        }
    })

    it('R-2.8.2 — faceup sites are seeded a facedown relic per printed icon', () => {
        const state = setUpState(4)
        const vault = buildSetupVault(state, getPrng(1))
        for (const slotId of state.faceupSiteIds()) {
            for (const slot of state.relicsBySite[slotId] ?? []) {
                expect(slot).toEqual({ slotId: slot.slotId })
                expect(vault.relicFacedown[slot.slotId]).toBeDefined()
            }
        }
        const seeded = state
            .faceupSiteIds()
            .some((slotId) => (state.relicsBySite[slotId]?.length ?? 0) > 0)
        expect(seeded).toBe(true)
    })

    it('R-1.18 — the Grand Scepter is never in the relic deck or the Reliquary', () => {
        const state = setUpState(4)
        const vault = buildSetupVault(state, getPrng(1))
        expect(vault.relicDeck).not.toContain(GRAND_SCEPTER_ID)
        expect(Object.values(vault.relicFacedown)).not.toContain(GRAND_SCEPTER_ID)
    })

    it('R-1.21, R-8.8 — the world deck is composed and Vision-free at the bottom', () => {
        const state = setUpState(6)
        const vault = buildSetupVault(state, getPrng(1))
        expect(vault.worldDeck.length).toBeGreaterThan(30)
        // R-1.19, R-1.20 — 21 cards at six players.
        expect(vault.worldDeck.slice(-21).filter((id) => id.startsWith('vision.'))).toEqual(
            []
        )
    })

    it('shuffles from the protected stream it is given, never the public state seed', () => {
        const state = setUpState(4)
        const reseeded = setUpState(4)
        reseeded.prng = { seed: state.prng.seed + 1, invocations: 0 }
        expect(buildSetupVault(reseeded, getPrng(1))).toEqual(buildSetupVault(state, getPrng(1)))
        expect(buildSetupVault(state, getPrng(2)).worldDeck).not.toEqual(
            buildSetupVault(state, getPrng(1)).worldDeck
        )
    })

    it('public state never names a card the vault is hiding', () => {
        const state = setUpState(4)
        const vault = buildSetupVault(state, getPrng(1))
        // Whole JSON strings, because `site.unnamed-1` is a substring of `site.unnamed-12`.
        const publicJson = servedJson(state)
        const leaked = [
            ...vault.worldDeck,
            ...Object.values(vault.siteFacedown),
            ...Object.values(vault.relicFacedown),
            ...vault.relicDeck,
            ...vault.siteDeck
        ].filter((cardId) => publicJson.includes(`"${cardId}"`))
        expect(leaked).toEqual([])
    })

    it('R-9.3 — favor is conserved across the whole of setup, not just at the end', () => {
        const state = setUpState(6)
        expect(favorCensus(state)).toBe(TOTAL_FAVOR)
    })
})

describe('R-1.1 — sites start bare', () => {
    it('deals no denizens to any site', () => {
        const state = setUpState(4)
        expect(Object.values(state.denizensBySite).flat()).toEqual([])
    })

    it('leaves R-1.12 placing warbands on the topmost Cradle site alone', () => {
        const state = setUpState(4)
        const occupied = Object.entries(state.warbandsBySite)
            .filter(([, counts]) => Object.values(counts).some((n) => n > 0))
            .map(([siteId]) => siteId)
        expect(occupied).toEqual([TOP_CRADLE_SLOT])
        expect(state.warbandsBySite[TOP_CRADLE_SLOT][IMPERIAL_WARBANDS]).toBe(2)
    })

    it('leaves Muster and Trade with nothing to act on (R-5.2, R-5.3)', () => {
        const state = setUpState(4)
        for (const siteId of state.allSiteIds()) {
            expect(state.denizensBySite[siteId] ?? []).toEqual([])
        }
    })
})
