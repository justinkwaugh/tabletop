<script lang="ts">
    import { getContext } from 'svelte'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import { Button } from 'flowbite-svelte'
    import { AuctionRecipient, MachineState } from '@tabletop/estates'
    let gameSession = getContext('gameSession') as EstatesGameSession

    async function chooseRecipient(recipient: AuctionRecipient) {
        await gameSession.chooseRecipient(recipient)
    }
</script>

<div class="flex flex-row justify-center items-center gap-x-2 z-30">
    <Button onclick={() => chooseRecipient(AuctionRecipient.Auctioneer)} size="xs" color="light"
        >Yes</Button
    >
    <Button onclick={() => chooseRecipient(AuctionRecipient.HighestBidder)} size="xs" color="light"
        >No</Button
    >
</div>
