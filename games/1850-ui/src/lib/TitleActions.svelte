<script lang="ts">
    import { EdgeTokenPrice, MesabiRights } from '@tabletop/1850'
    import { TitlePrompt } from '@tabletop/18xx-ui'
    import type { Session1850 } from './session.svelte.js'
    let { session }: { session: Session1850 } = $props()
    const money = $derived(session.presentation.money)
</script>

{#if session.mesabiRights.canBuy}
    <TitlePrompt
        text="Buy a Mesabi Range token for {money(MesabiRights.price)}, using a yellow tile lay?"
        answer={{ label: 'buy', onAct: () => session.mesabiRights.buy() }}
    />
{/if}
{#if session.edgeTokenArea}
    <TitlePrompt
        text="Place the edge token in {session.edgeTokenArea} for {money(
            EdgeTokenPrice
        )}, as this turn’s token? It doubles the area for this company."
        answer={{ label: 'place', onAct: () => session.placeEdgeToken() }}
    />
{/if}
