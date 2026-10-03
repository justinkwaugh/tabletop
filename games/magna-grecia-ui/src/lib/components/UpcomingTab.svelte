<script lang="ts">
    import type { ActionCard } from '@tabletop/magna-grecia'
    import FolderTab from './FolderTab.svelte'
    import UpcomingRound from './UpcomingRound.svelte'

    let { card }: { card: ActionCard } = $props()
</script>

<FolderTab side="right" label="Upcoming round">
    <UpcomingRound {card} />
</FolderTab>
