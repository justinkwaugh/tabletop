<script lang="ts">
    import type { CompanyId } from '@tabletop/railheads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import CompanyCharter from './CompanyCharter.svelte'

    const gameSession = getGameSession()

    const buildChoices = $derived(
        gameSession.placements.length === 0
            ? gameSession.firstCompanyOptions.length > 1
                ? gameSession.firstCompanyOptions
                : gameSession.secondCompanyOptions
            : gameSession.secondCompanyOptions
    )

    function choiceFor(companyId: CompanyId): (() => void) | undefined {
        if (
            gameSession.issuableCompanies.length > 1 &&
            gameSession.issuableCompanies.includes(companyId)
        ) {
            return () => gameSession.selectIssueCompany(companyId)
        }
        if (buildChoices.includes(companyId)) {
            return () => gameSession.chooseTrackCompany(companyId)
        }
        return undefined
    }

    function isSelected(companyId: CompanyId): boolean {
        return (
            gameSession.issueCompany === companyId ||
            gameSession.firstCompany === companyId ||
            gameSession.secondCompany === companyId ||
            gameSession.gameState.shareAuction?.companyId === companyId
        )
    }
</script>

<section class="companies" aria-label="Railroad companies">
    {#each gameSession.gameState.companies as company (company.id)}
        <CompanyCharter
            companyId={company.id}
            choose={choiceFor(company.id)}
            selected={isSelected(company.id)}
        />
    {/each}
</section>

<style>
    .companies {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
</style>
