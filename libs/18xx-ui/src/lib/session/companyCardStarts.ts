import { assert, assertExists } from '@tabletop/common'
import { sameOwner, type Owner } from '@tabletop/18xx'
import type { CompanyAuctionModule } from './companyAuctionModule.svelte.js'
import type { StockModule } from './stockModule.svelte.js'

export type CompanyCardStartKind = 'start' | 'auction'

export class CompanyCardStarts {
    constructor(
        private readonly stock: Pick<
            StockModule,
            | 'cardStarts'
            | 'selectCompanyStart'
            | 'chooseStartBuyer'
            | 'selectedStartCompany'
            | 'awaitingStartHome'
            | 'availableMenus'
            | 'openMenu'
            | 'chooseMenu'
            | 'start'
        >,
        private readonly auction: Pick<
            CompanyAuctionModule,
            'companies' | 'selectedCompanyId' | 'selectCompany' | 'clearOpening' | 'homePositions'
        >
    ) {}

    kind(companyId: string): CompanyCardStartKind | undefined {
        if (this.stock.cardStarts(companyId).length) return 'start'
        if (
            this.stock.availableMenus.some((choice) => choice.menu === 'auction') &&
            this.auction.companies.some((company) => company.id === companyId)
        )
            return 'auction'
        return undefined
    }
    get stagedCompanyId(): string | undefined {
        return this.stock.selectedStartCompany?.companyId ?? this.auction.selectedCompanyId
    }
    selected(companyId: string): boolean {
        return this.stagedCompanyId === companyId
    }
    get awaitingHome(): boolean {
        return this.stock.awaitingStartHome || this.auction.homePositions.length > 0
    }
    buyers(companyId: string): Owner[] {
        return this.stock
            .cardStarts(companyId)
            .map((choice) => choice.request.buyer)
            .toSorted((a, b) => Number(b.kind === 'player') - Number(a.kind === 'player'))
    }
    /** A Start or Auction menu left open would show the card's start a second time. */
    open(companyId: string): void {
        const kind = this.kind(companyId)
        assert(kind, 'Start a company its card offers')
        if (this.stock.openMenu === 'start' || this.stock.openMenu === 'auction')
            this.stock.chooseMenu(undefined)
        if (kind === 'auction') {
            this.stock.start.clear()
            this.auction.selectCompany(companyId)
            return
        }
        this.auction.clearOpening()
        this.stock.selectCompanyStart(this.startBy(companyId, this.buyers(companyId)[0]).request)
    }
    chooseBuyer(companyId: string, buyer: Owner): void {
        this.stock.chooseStartBuyer(this.startBy(companyId, buyer).request)
    }
    close(companyId: string): void {
        if (this.stock.selectedStartCompany?.companyId === companyId) this.stock.start.clear()
        if (this.auction.selectedCompanyId === companyId) this.auction.clearOpening()
    }
    private startBy(companyId: string, buyer: Owner) {
        const choice = this.stock
            .cardStarts(companyId)
            .find((candidate) => sameOwner(candidate.request.buyer, buyer))
        assertExists(choice, 'Start the company as an owner who may')
        return choice
    }
}
