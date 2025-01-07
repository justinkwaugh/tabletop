<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import Sundiver from './Sundiver.svelte'

    let gameSession = getContext('gameSession') as SolGameSession
</script>

<div class="flex flex-row flex-wrap justify-center items-center gap-x-2">
    <svg xmlns="http://www.w3.org/2000/svg" width="32px" height="42px" viewBox="0 0 32 42">
        <Sundiver color="green" quantity={1} location={{ x: -640 + 16, y: -640 + 21 }} />
    </svg>
    <svg xmlns="http://www.w3.org/2000/svg" width="32px" height="42px" viewBox="0 0 32 42">
        <Sundiver color="green" quantity={2} location={{ x: -640 + 16, y: -640 + 21 }} />
    </svg>
    <svg xmlns="http://www.w3.org/2000/svg" width="32px" height="42px" viewBox="0 0 32 42">
        <Sundiver color="green" quantity={3} location={{ x: -640 + 16, y: -640 + 21 }} />
    </svg>
    <svg xmlns="http://www.w3.org/2000/svg" width="32px" height="42px" viewBox="0 0 32 42">
        <Sundiver color="green" quantity={4} location={{ x: -640 + 16, y: -640 + 21 }} />
    </svg>
    <svg xmlns="http://www.w3.org/2000/svg" width="32px" height="42px" viewBox="0 0 32 42">
        <Sundiver color="green" quantity={5} location={{ x: -640 + 16, y: -640 + 21 }} />
    </svg>
</div>
