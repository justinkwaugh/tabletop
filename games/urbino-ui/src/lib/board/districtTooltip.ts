import { BOARD_SQUARES, getDistrictFrom, getDistrictInfo } from '@tabletop/urbino'
import type { UrbinoGameSession } from '$lib/model/session.svelte.js'

// Portaled to document.body to escape ScalingWrapper's CSS transform
export function createDistrictTooltip(session: UrbinoGameSession, pos: number): HTMLDivElement {
    const state = session.gameState
    const info = getDistrictInfo(state.board, pos, state.monumentsVariant)
    const district = getDistrictFrom(state.board, pos)

    let minTop = Infinity, minLeft = Infinity, maxRight = -Infinity, maxBottom = -Infinity
    for (const dPos of district) {
        const el = document.querySelector(`[data-board-pos="${dPos}"]`)
        if (!el) continue
        const rect = el.getBoundingClientRect()
        minTop = Math.min(minTop, rect.top)
        minLeft = Math.min(minLeft, rect.left)
        maxRight = Math.max(maxRight, rect.right)
        maxBottom = Math.max(maxBottom, rect.bottom)
    }
    const centerX = isFinite(minLeft) ? (minLeft + maxRight) / 2 : 0
    const districtCenterY = isFinite(minTop) ? (minTop + maxBottom) / 2 : 0
    const boardTop = document.querySelector('[data-board-pos="0"]')?.getBoundingClientRect().top ?? 0
    const boardBottom =
        document.querySelector(`[data-board-pos="${BOARD_SQUARES - 1}"]`)?.getBoundingClientRect().bottom ??
        window.innerHeight
    const aboveDistrict = districtCenterY > (boardTop + boardBottom) / 2

    const container = document.createElement('div')
    Object.assign(container.style, {
        position: 'fixed',
        zIndex: '9999',
        background: '#fbf6ec',
        border: '1px solid #d8c4a0',
        borderRadius: '6px',
        padding: '8px 10px',
        fontSize: '12px',
        lineHeight: '1.6',
        boxShadow: '0 4px 14px rgba(40,20,0,0.25)',
        pointerEvents: 'none',
        left: `${centerX}px`,
        top: aboveDistrict ? `${minTop}px` : `${maxBottom}px`,
        transform: aboveDistrict ? 'translate(-50%, calc(-100% - 6px))' : 'translate(-50%, 6px)'
    })

    const header = document.createElement('div')
    Object.assign(header.style, { fontWeight: '600', color: '#7a5a3a', marginBottom: '4px' })
    header.textContent = info.contested ? 'District' : 'District (uncontested)'
    container.appendChild(header)

    const sorted = [...info.playerStats.entries()].sort((a, b) => b[1].total - a[1].total)
    for (const [pid, stats] of sorted) {
        const isWinner = pid === info.winner
        const row = document.createElement('div')
        Object.assign(row.style, { display: 'flex', alignItems: 'center', gap: '6px', fontWeight: isWinner ? '600' : '400' })

        const dot = document.createElement('div')
        Object.assign(dot.style, {
            width: '10px', height: '10px', borderRadius: '2px',
            border: '1px solid #8a6a48',
            background: session.colors.getPlayerUiColor(pid),
            flexShrink: '0'
        })

        const label = document.createElement('span')
        label.style.color = '#2c1810'
        const name = pid === session.myPlayer?.id ? 'You' : (session.getPlayerName(pid) ?? 'Player')
        const suffix = isWinner ? ' ★' : (info.contested ? '' : ' (no points)')
        label.textContent = `${name}: ${stats.total} pt${stats.total !== 1 ? 's' : ''}${suffix}`

        row.appendChild(dot)
        row.appendChild(label)
        container.appendChild(row)
    }

    return container
}
