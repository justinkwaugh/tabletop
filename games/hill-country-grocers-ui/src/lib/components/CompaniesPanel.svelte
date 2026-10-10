<script lang="ts">
    import { COMPANIES, type CompanyId } from '@tabletop/hill-country-grocers'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import CompanyCard from './CompanyCard.svelte'

    const gameSession = getGameSession()

    const buildChoices = $derived(
        gameSession.buildCompanyOptions.length > 1 ? gameSession.buildCompanyOptions : []
    )

    function choiceFor(companyId: CompanyId): 'build' | 'auction' | undefined {
        if (buildChoices.includes(companyId)) {
            return 'build'
        }
        return gameSession.auctionCompanyOptions.includes(companyId) ? 'auction' : undefined
    }

    function isSelected(companyId: CompanyId): boolean {
        return (
            (buildChoices.length > 0 && gameSession.buildCompany === companyId) ||
            gameSession.auctionCompany === companyId ||
            gameSession.gameState.auction?.companyId === companyId
        )
    }
</script>

<section class="companies" aria-label="Companies">
    {#each COMPANIES as company (company.id)}
        <CompanyCard
            companyId={company.id}
            choice={choiceFor(company.id)}
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
