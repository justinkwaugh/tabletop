<script lang="ts">
    // A pact as everyone may see it: its target, each partner's pledged ships and share, and
    // who has accepted. The viewer's own lines read in the second person.
    import type { Snippet } from 'svelte'
    import { PlayerName } from '@tabletop/frontend-components'
    import { shipDefinition, type Pact } from '@tabletop/stellar-horizons-2'
    import { pactTargetName, shareText } from '$lib/utils/pacts.js'
    import { systemName } from '$lib/utils/presentation.js'

    let {
        pact,
        viewerId,
        status,
        children
    }: { pact: Pact; viewerId?: string; status: string; children?: Snippet } = $props()

    function partnerShare(playerId: string): string {
        if (pact.terms.keeperId !== undefined) {
            return pact.terms.keeperId === playerId ? 'keeps the tile' : 'nothing'
        }
        return shareText(pact.terms.shares[playerId])
    }
</script>

<section class="pact" class:agreed={pact.agreed}>
    <div class="title">
        Pact on {pactTargetName(pact.terms)} at {systemName(pact.systemId)}
        <span class="status">{status}</span>
    </div>
    <ul>
        {#each pact.terms.partnerIds as playerId (playerId)}
            <li>
                <PlayerName {playerId} />
                {playerId === viewerId ? 'pledge' : 'pledges'}
                {(pact.terms.pledges[playerId] ?? [])
                    .map((shipId) => shipDefinition(shipId).name)
                    .join(', ')}; {partnerShare(playerId)}
                {#if pact.acceptedIds.includes(playerId) && !pact.agreed}
                    <span class="accepted">accepted</span>
                {/if}
            </li>
        {/each}
    </ul>
    {@render children?.()}
</section>

<style>
    .pact {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 8px 10px;
        border: 1px solid #6b4a80;
        border-radius: 8px;
        background: #1a1427;
    }

    .pact.agreed {
        border-color: #3f8f5a;
        background: #12241b;
    }

    .title {
        font-weight: 700;
        color: #e8f1ff;
    }

    .status {
        margin-left: 8px;
        font-size: 12.5px;
        font-weight: 400;
        color: #c9b6e8;
    }

    .agreed .status {
        color: #7fe08a;
    }

    ul {
        font-size: 13px;
        color: #c9d6ea;
    }

    li {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px;
    }

    .accepted {
        font-size: 11.5px;
        color: #7fe08a;
    }
</style>
