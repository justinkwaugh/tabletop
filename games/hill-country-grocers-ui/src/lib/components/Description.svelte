<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import type { Description } from '$lib/utils/describeAction.js'
    import CompanyBadge from './CompanyBadge.svelte'

    let { description }: { description: Description } = $props()
</script>

{#each description as segment, index (index)}
    {#if typeof segment === 'string'}<span>{segment}</span>{:else if 'playerId' in segment}<PlayerName
            playerId={segment.playerId}
        />{:else}<CompanyBadge companyId={segment.companyId} />{/if}
{/each}
