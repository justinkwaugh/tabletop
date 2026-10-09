import { assertExists } from '@tabletop/common'
import { ActionType, MachineState, PlayerStatus } from '@tabletop/oath'
import { setupSites, type BoardPick, type SiteFavor } from './actionOffers.js'
import { START_HERE } from './offerText.js'
import type { OathGameSession } from './session.svelte.js'

/**
 * R-1.19 to R-1.23.3 — the pawn's site and the adviser kept, in either order (R-1.20 deals the
 * hand before R-1.23 places the pawn), then the order of the discards, which waits for the site
 * because R-10.5 sends them one region along from it, and for a short bank's whole split
 * (R-1.16); the last tap sends.
 */
export class SetupDraft {
    constructor(private readonly session: OathGameSession) {}

    private get playerId(): string | undefined {
        const session = this.session
        return session.gameState.machineState === MachineState.Setup &&
            session.validActionTypes.includes(ActionType.SetupChoice)
            ? session.liveTurnSeatId
            : undefined
    }

    get hand(): string[] {
        const playerId = this.playerId
        if (!playerId) return []
        const hand = this.session.gameState.getPlayerState(playerId).handIds
        assertExists(hand, 'A seat is shown its own hand')
        return hand
    }

    private value<S extends 'siteFavor' | 'site' | 'card' | 'discardOrder'>(stage: S) {
        const selection = this.session.selection
        return selection.action === ActionType.SetupChoice ? selection.value(stage) : undefined
    }

    /** R-1.16 — the sites whose favor the bank cannot cover, when the Chancellor must split it. */
    get pendingSiteFavor(): { siteCardId: string; wanted: number }[] {
        const playerId = this.playerId
        const state = this.session.gameState
        return playerId && state.getPlayerState(playerId).status === PlayerStatus.Chancellor
            ? (state.pendingSiteFavor ?? [])
            : []
    }

    // Map order fills first until the player moves favor between sites; the fill is the whole bank.
    private get mapOrderFill(): SiteFavor[] | undefined {
        const pending = this.pendingSiteFavor
        if (pending.length === 0) return undefined
        let left = this.session.gameState.favorSupply
        return pending.map(({ siteCardId, wanted }) => {
            const favor = Math.min(wanted, left)
            left -= favor
            return { siteCardId, favor }
        })
    }

    get siteFavor(): SiteFavor[] | undefined {
        const stored = this.value('siteFavor')
        return this.mapOrderFill?.map(({ siteCardId, favor }) => ({
            siteCardId,
            favor: stored?.[siteCardId] ?? favor
        }))
    }

    get siteFavorPlaced(): number {
        return (this.siteFavor ?? []).reduce((n, s) => n + s.favor, 0)
    }

    /** R-1.16 — every favor the bank holds is placed, or no split is asked for. */
    get splitWhole(): boolean {
        return (
            this.siteFavor === undefined ||
            this.siteFavorPlaced === this.session.gameState.favorSupply
        )
    }

    // The split comes before the card in the flow, so a card kept while it was short is set again.
    setSiteFavor(siteCardId: string, favor: number): void {
        const site = this.pendingSiteFavor.find((p) => p.siteCardId === siteCardId)
        const split = this.siteFavor
        if (!site || !split) return
        const kept = this.adviserCardId
        this.session.selection.autoSelect('action', ActionType.SetupChoice)
        this.session.selection.set('siteFavor', {
            ...Object.fromEntries(split.map((s) => [s.siteCardId, s.favor])),
            [siteCardId]: Math.max(0, Math.min(favor, site.wanted))
        })
        if (kept !== undefined) this.session.selection.set('card', kept)
    }

    // R-1.23.1 — the site is checked against a whole bank, so a split being made never moves it.
    get sites(): string[] {
        const playerId = this.playerId
        return playerId
            ? setupSites(this.session.gameState, playerId, this.hand, this.mapOrderFill)
            : []
    }

    get siteId(): string | undefined {
        const sites = this.sites
        const manual = this.value('site')
        if (manual !== undefined && sites.includes(manual)) return manual
        return sites.length === 1 ? sites[0] : undefined
    }

    get adviserCardId(): string | undefined {
        const manual = this.value('card')
        return manual !== undefined && this.hand.includes(manual) ? manual : undefined
    }

    get others(): string[] {
        const adviserCardId = this.adviserCardId
        return adviserCardId === undefined ? [] : this.hand.filter((id) => id !== adviserCardId)
    }

    get ordering(): boolean {
        return this.siteId !== undefined && this.adviserCardId !== undefined && this.splitWhole
    }

    get tapped(): string[] {
        return this.ordering ? (this.value('discardOrder') ?? []) : []
    }

    get boardPick(): BoardPick | undefined {
        const sites = this.sites
        if (sites.length === 0 || this.siteId !== undefined) return undefined
        return { sites, label: START_HERE }
    }

    // The site stage comes before the card in the flow, so a card kept first is set again.
    chooseSite(siteId: string): void {
        if (!this.sites.includes(siteId)) return
        const kept = this.adviserCardId
        this.session.selection.autoSelect('action', ActionType.SetupChoice)
        this.session.selection.set('site', siteId)
        if (kept !== undefined) this.session.selection.set('card', kept)
    }

    async chooseAdviser(cardId: string): Promise<void> {
        if (!this.hand.includes(cardId)) return
        this.session.selection.autoSelect('action', ActionType.SetupChoice)
        this.session.selection.set('card', cardId)
        if (this.ordering && this.others.length <= 1) await this.send(this.others)
    }

    async tapDiscard(cardId: string): Promise<void> {
        const others = this.others
        const tapped = this.tapped
        if (!this.ordering || !others.includes(cardId) || tapped.includes(cardId)) return
        const next = [...tapped, cardId]
        this.session.selection.set('discardOrder', next)
        if (next.length >= others.length - 1) {
            await this.send([...next, ...others.filter((id) => !next.includes(id))])
        }
    }

    private async send(discardOrder: string[]): Promise<void> {
        const siteId = this.siteId
        const adviserCardId = this.adviserCardId
        assertExists(siteId, 'The discards are ordered after the site is chosen')
        assertExists(adviserCardId, 'The discards are ordered after the adviser is kept')
        await this.session.resolveSetup(siteId, adviserCardId, discardOrder, this.siteFavor)
    }
}
