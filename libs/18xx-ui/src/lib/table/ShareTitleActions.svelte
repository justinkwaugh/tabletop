<script lang="ts">
    import type { ComponentProps, Snippet } from 'svelte'
    import WaterfallAuctionLots from '../auctions/WaterfallAuctionLots.svelte'
    import OperatingActions from './OperatingActions.svelte'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import CompanyPar from '../stock/CompanyPar.svelte'
    import CompanyShareActions from '../stock/CompanyShareActions.svelte'
    import PendingShareDecision from '../stock/PendingShareDecision.svelte'
    import type { ShareActions } from '../stock/shareActions.svelte.js'

    type ShareSession = EighteenXXSessionView &
        ComponentProps<typeof CompanyShareActions>['session'] &
        ComponentProps<typeof PendingShareDecision>['session'] &
        ComponentProps<typeof OperatingActions>['session'] & {
            readonly shareActions: ShareActions<never>
            readonly stockPanels: { readonly open: string | undefined }
        }

    let {
        session,
        titleDecision,
        operatingPrompt,
        onFocusRoute,
        privateOperationDescription,
        createRouteWorker
    }: {
        session: ShareSession
        /** A decision of the title's own that holds up the turn, shown in place of the rest. */
        titleDecision?: Snippet
        /** What the title adds above the company's operating step. */
        operatingPrompt?: Snippet
        onFocusRoute: ComponentProps<typeof OperatingActions>['onFocusRoute']
        privateOperationDescription: ComponentProps<
            typeof OperatingActions
        >['privateOperationDescription']
        createRouteWorker: ComponentProps<typeof OperatingActions>['createRouteWorker']
    } = $props()
</script>

{#if session.gameState.pendingPar}
    <CompanyPar {session} />
{:else if session.waterfall.model && !session.waterfall.model.auction.completed}
    <WaterfallAuctionLots {session} />
{:else if session.shareActions.pending}
    <PendingShareDecision {session} actions={session.shareActions} />
{:else if titleDecision}
    {@render titleDecision()}
{:else if session.stockPanels.open === 'company'}
    <CompanyShareActions {session} actions={session.shareActions} />
{:else}
    {@render operatingPrompt?.()}
    <OperatingActions {privateOperationDescription} {onFocusRoute} {session} {createRouteWorker} />
{/if}
