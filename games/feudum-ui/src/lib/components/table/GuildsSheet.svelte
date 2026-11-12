<script lang="ts">
    import SessionStandings from '$lib/components/standings/SessionStandings.svelte'
    import Scrim from './Scrim.svelte'

    /**
     * A phone's Guilds sheet (contract: Phone layout): the Players tab's guild standings, opened
     * from the seat strip's Guilds chip. It is for looking and holds no target.
     */
    let { onClose }: { onClose: () => void } = $props()

    const SheetShare = 80
</script>

<Scrim label="the guild standings" layer="guilds" {onClose} sheet={SheetShare}>
    <div class="px-2 pb-3 pt-10" data-guilds-sheet>
        <SessionStandings sheet />
    </div>
</Scrim>
