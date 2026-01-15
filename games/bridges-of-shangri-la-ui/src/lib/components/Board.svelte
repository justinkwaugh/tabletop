<script lang="ts">
import type { BridgesGameSession } from '$lib/model/BridgesGameSession.svelte'
    import Village from '$lib/components/Village.svelte'
    import Bridge from '$lib/components/Bridge.svelte'
    import boardImg from '$lib/images/board.jpg'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'
    let gameSession = getGameSession() as BridgesGameSession

    const locationsForVillages: string[] = [
        'top-[125px] left-[143px]',
        'top-[117px] left-[628px]',
        'top-[161px] left-[1009px]',
        'top-[566px] left-[233px]',
        'top-[380px] left-[485px]',
        'top-[348px] left-[818px]',
        'top-[932px] left-[143px]',
        'top-[794px] left-[530px]',
        'top-[605px] left-[789px]',
        'top-[623px] left-[1060px]',
        'top-[1117px] left-[432px]',
        'top-[1099px] left-[820px]',
        'top-[864px] left-[977px]'
    ]

    function hasConnection(village: number, otherVillage: number) {
        const board = gameSession.gameState.board
        if (!board.hasVillage(village)) {
            return false
        }

        return board.villages[village].neighbors.includes(otherVillage)
    }
</script>

<div class="relative w-[1280px] h-[1322px]">
    <div class="absolute top left w-[1280px] h-[1322px]">
        <img src={boardImg} alt="game board" />
    </div>
    {#each gameSession.gameState.board.villages as village, i (i)}
        <div class="absolute {locationsForVillages[i]}">
            <Village {village} index={i} />
        </div>
    {/each}
    <Bridge
        location="top-[511px] left-[46px]"
        rotation="rotate-[20deg]"
        visible={hasConnection(0, 6)}
    />
    <Bridge
        location="top-[403px] left-[193px]"
        rotation="rotate-[-15deg]"
        visible={hasConnection(0, 3)}
    />
    <Bridge
        location="top-[272px] left-[360px]"
        rotation="rotate-[105deg]"
        visible={hasConnection(0, 4)}
    />
    <Bridge
        location="top-[80px] left-[420px]"
        rotation="rotate-[60deg]"
        visible={hasConnection(0, 1)}
    />
    <Bridge
        location="top-[225px] left-[838px]"
        rotation="rotate-[0deg]"
        visible={hasConnection(1, 5)}
    />
    <Bridge
        location="top-[50px] left-[892px]"
        rotation="rotate-[70deg]"
        visible={hasConnection(1, 2)}
    />
    <Bridge
        location="top-[398px] left-[1070px]"
        rotation="rotate-[52deg]"
        visible={hasConnection(2, 5)}
    />
    <Bridge
        location="top-[432px] left-[1173px]"
        rotation="rotate-[-10deg]"
        visible={hasConnection(2, 9)}
    />
    <Bridge
        location="top-[812px] left-[219px]"
        rotation="rotate-[63deg]"
        visible={hasConnection(3, 6)}
    />
    <Bridge
        location="top-[880px] left-[358px]"
        rotation="rotate-[12deg]"
        visible={hasConnection(3, 10)}
    />
    <Bridge
        location="top-[620px] left-[517px]"
        rotation="rotate-[20deg]"
        visible={hasConnection(3, 4)}
    />
    <Bridge
        location="top-[634px] left-[600px]"
        rotation="rotate-[-13deg]"
        visible={hasConnection(4, 7)}
    />
    <Bridge
        location="top-[323px] left-[705px]"
        rotation="rotate-[61deg]"
        visible={hasConnection(4, 5)}
    />
    <Bridge
        location="top-[528px] left-[767px]"
        rotation="rotate-[7deg]"
        visible={hasConnection(5, 8)}
    />
    <Bridge
        location="top-[1208px] left-[179px]"
        rotation="rotate-[-38deg]"
        visible={hasConnection(6, 10)}
    />
    <Bridge
        location="top-[990px] left-[490px]"
        rotation="rotate-[8deg]"
        visible={hasConnection(7, 10)}
    />
    <Bridge
        location="top-[992px] left-[732px]"
        rotation="rotate-[-49deg]"
        visible={hasConnection(7, 11)}
    />
    <Bridge
        location="top-[815px] left-[770px]"
        rotation="rotate-[55deg]"
        visible={hasConnection(7, 8)}
    />
    <Bridge
        location="top-[785px] left-[912px]"
        rotation="rotate-[20deg]"
        visible={hasConnection(8, 12)}
    />
    <Bridge
        location="top-[528px] left-[990px]"
        rotation="rotate-[63deg]"
        visible={hasConnection(8, 9)}
    />
    <Bridge
        location="top-[820px] left-[1217px]"
        rotation="rotate-[0deg]"
        visible={hasConnection(9, 12)}
    />
    <Bridge
        location="top-[1207px] left-[675px]"
        rotation="rotate-[108deg]"
        visible={hasConnection(10, 11)}
    />
    <Bridge
        location="top-[1140px] left-[1098px]"
        rotation="rotate-[15deg]"
        visible={hasConnection(11, 12)}
    />
</div>
