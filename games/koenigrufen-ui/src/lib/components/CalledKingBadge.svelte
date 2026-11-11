<script lang="ts">
    // The called King as a small card-coloured chip, so every player can spot it at a glance.
    import { FourthKing, isRed, type CalledKing } from '@tabletop/koenigrufen'
    import { calledKingName } from '$lib/utils/actionDescription.js'

    let { king }: { king: CalledKing } = $props()

    const red = $derived(king !== FourthKing && isRed(king))
    const spoken = $derived(king === FourthKing ? 'the fourth King' : `the King of ${king}`)
</script>

<span class="called">
    called <span class="king" class:red aria-label={spoken}>{calledKingName(king)}</span>
</span>

<style>
    .called {
        white-space: nowrap;
    }

    .king {
        display: inline-block;
        margin-left: 2px;
        padding: 1px 7px;
        border: 1px solid #b9ae95;
        border-radius: 5px;
        background: #f7f3ec;
        box-shadow: 0 1px 0 rgb(0 0 0 / 0.45);
        color: #1b1b1b;
        font-size: 1.1em;
        font-weight: 800;
        line-height: 1.2;
    }

    .king.red {
        color: #c62828;
    }
</style>
