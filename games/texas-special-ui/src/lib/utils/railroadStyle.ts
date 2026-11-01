import { RailroadId } from '@tabletop/texas-special'

export type RailroadStyle = { fill: string; text: string; dark: string; light: string }

// SAR's colours follow the name blocks printed along its board's bottom edge, Texas
// Special's the railroads' logos, and Frontier and Keystone Railroads' their names.
export const RAILROAD_STYLE: Record<RailroadId, RailroadStyle> = {
    [RailroadId.CMRC]: { fill: '#c8231f', text: '#ffffff', dark: '#7d1411', light: '#e9655f' },
    [RailroadId.CTRD]: { fill: '#2f4fa8', text: '#ffffff', dark: '#1b2f66', light: '#6f8bd6' },
    [RailroadId.CSAR]: { fill: '#3d7d2f', text: '#ffffff', dark: '#234a1a', light: '#78b366' },
    [RailroadId.NRC]: { fill: '#85501f', text: '#ffffff', dark: '#4f2d0f', light: '#c08a55' },
    [RailroadId.ZASM]: { fill: '#f0d21b', text: '#2a2208', dark: '#9b8506', light: '#f8e87a' },
    [RailroadId.CdFM]: { fill: '#232323', text: '#ffffff', dark: '#000000', light: '#5c5c5c' },
    [RailroadId.MKT]: { fill: '#1d7f6e', text: '#ffffff', dark: '#0f4a3f', light: '#5fb8a6' },
    [RailroadId.MP]: { fill: '#1f2d5a', text: '#f2c14e', dark: '#0f1730', light: '#5a6aa0' },
    [RailroadId.SP]: { fill: '#5b3f8f', text: '#ffffff', dark: '#35234f', light: '#9a82c4' },
    [RailroadId.GHH]: { fill: '#e8681c', text: '#ffffff', dark: '#8a3a09', light: '#f4a26a' },
    [RailroadId.SLSF]: { fill: '#c8232b', text: '#ffffff', dark: '#7a1218', light: '#e9656b' },
    [RailroadId.TP]: { fill: '#262626', text: '#ffffff', dark: '#000000', light: '#8a8a8a' },
    [RailroadId.Red]: { fill: '#c8231f', text: '#ffffff', dark: '#7d1411', light: '#e9655f' },
    [RailroadId.Blue]: { fill: '#2f4fa8', text: '#ffffff', dark: '#1b2f66', light: '#6f8bd6' },
    [RailroadId.Green]: { fill: '#3d7d2f', text: '#ffffff', dark: '#234a1a', light: '#78b366' },
    [RailroadId.Brown]: { fill: '#85501f', text: '#ffffff', dark: '#4f2d0f', light: '#c08a55' },
    [RailroadId.Yellow]: { fill: '#f0d21b', text: '#2a2208', dark: '#9b8506', light: '#f8e87a' },
    [RailroadId.Black]: { fill: '#232323', text: '#ffffff', dark: '#000000', light: '#5c5c5c' }
}
