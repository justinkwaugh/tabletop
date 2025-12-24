<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import { EffectType } from '@tabletop/sol'
    import ConvertPicker from '$lib/components/pickers/ConvertPicker.svelte'
    import CardPicker from '$lib/components/pickers/CardPicker.svelte'
    import { fade } from 'svelte/transition'
    import { CardPickerAnimator } from '$lib/animators/cardPickerAnimator.js'
    import SuitPicker from '$lib/components/pickers/SuitPicker.svelte'
    import HatchPicker from '$lib/components/pickers/HatchPicker.svelte'
    import AccelerationPicker from '$lib/components/pickers/AccelerationPicker.svelte'
    import MovementPicker from '$lib/components/pickers/MovementPicker.svelte'
    import MetamorphosisPicker from '$lib/components/pickers/MetamorphosisPicker.svelte'
    import ChainSundiverPicker from '$lib/components/pickers/ChainSundiverPicker.svelte'
    import ClusterPicker from '$lib/components/pickers/ClusterPicker.svelte'
    import TeleportPicker from '$lib/components/pickers/TeleportPicker.svelte'

    let gameSession = getContext('gameSession') as SolGameSession

    const cardPickerAnimator = new CardPickerAnimator(gameSession)
    cardPickerAnimator.register()

    const chainEntryWithoutDiver = $derived(gameSession.chain?.find((entry) => !entry.sundiverId))
</script>

{#if gameSession.isHatching && gameSession.hatchLocation && !gameSession.hatchTarget}
    <HatchPicker />
{:else if gameSession.isAccelerating && !gameSession.accelerationAmount}
    <AccelerationPicker />
{:else if gameSession.isMetamorphosizing && !gameSession.metamorphosisType}
    <MetamorphosisPicker />
{:else if (gameSession.isSolarFlares || gameSession.isChoosingCard || gameSession.isDrawingCards) && gameSession.drawnCards.length > 0}
    <CardPicker animator={cardPickerAnimator} />
{:else if gameSession.isMoving && (gameSession.chosenSource || gameSession.chosenMothership) && !gameSession.chosenNumDivers && !gameSession.juggernautStationId}
    <MovementPicker coords={gameSession.chosenSource ?? { row: 0, col: 0 }} />
{:else if gameSession.isConverting && !gameSession.chosenConvertType}
    <div in:fade={{ duration: 200, delay: 100 }} out:fade={{ duration: 100 }}>
        <ConvertPicker />
    </div>
{:else if gameSession.gameState.activeEffect === EffectType.Pillar && !gameSession.pillarGuess}
    <div in:fade={{ duration: 200, delay: 100 }} out:fade={{ duration: 100 }}>
        <SuitPicker />
    </div>
{:else if gameSession.isChaining && chainEntryWithoutDiver}
    <ChainSundiverPicker coords={chainEntryWithoutDiver.coords} />
{/if}
{#if gameSession.shouldPickCluster}
    <ClusterPicker />
{/if}
{#if gameSession.shouldPickTeleport}
    <TeleportPicker />
{/if}
