import { Ability, RailroadId } from '@tabletop/preussische-ostbahn'

export type RailroadStyle = {
    fill: string
    text: string
    initial: string
}

const PAPER = [0xf7, 0xf2, 0xe4]

export function homeTint(fill: string): string {
    const channels = [1, 3, 5].map((start) => parseInt(fill.slice(start, start + 2), 16))
    const mixed = channels.map((value, index) => Math.round(value * 0.45 + PAPER[index] * 0.55))
    return `#${mixed.map((value) => value.toString(16).padStart(2, '0')).join('')}`
}

export const RAILROAD_STYLES: Record<RailroadId, RailroadStyle> = {
    [RailroadId.Ostbahn]: { fill: '#232323', text: '#f4efe0', initial: 'PO' },
    [RailroadId.Niederschlesische]: { fill: '#6e3b1e', text: '#f4efe0', initial: 'NS' },
    [RailroadId.Saechsische]: { fill: '#e07a1f', text: '#26170a', initial: 'SÄ' },
    [RailroadId.Bayerische]: { fill: '#2f6db5', text: '#f4efe0', initial: 'BY' },
    [RailroadId.MainWeser]: { fill: '#e8c51e', text: '#2b2418', initial: 'MW' },
    [RailroadId.Badische]: { fill: '#c4302b', text: '#f4efe0', initial: 'BD' },
    [RailroadId.KolnMindener]: { fill: '#5a3d8f', text: '#f4efe0', initial: 'KM' },
    [RailroadId.BerlinHamburger]: { fill: '#2e7d4a', text: '#f4efe0', initial: 'BH' }
}

export const ABILITY_LABELS: Record<Ability, string> = {
    [Ability.FourTrack]: '4 Track',
    [Ability.NoCityPenalty]: 'No City Penalty',
    [Ability.TwoTrack]: '2 Track',
    [Ability.CheaperTrack]: '−1 Cost',
    [Ability.DoubleCity]: 'Double City',
    [Ability.FreeRural]: 'Free Rural',
    [Ability.FiveDollarMax]: '$5 Max',
    [Ability.MustConnect]: 'Must Connect'
}
