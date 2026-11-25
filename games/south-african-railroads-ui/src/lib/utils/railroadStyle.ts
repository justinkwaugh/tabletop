import { RailroadId } from '@tabletop/south-african-railroads'

export type RailroadStyle = { fill: string; text: string; dark: string; light: string }

// South African Railroads' colours follow the name blocks printed along its board's bottom edge
// (Veld Railroads shares them), Texas Special's and Pennsylvania Railroad's the railroads' logos,
// Pampas Railroads' the lines of its redrawn board's auction order.
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
    [RailroadId.PRR]: { fill: '#c8231f', text: '#ffffff', dark: '#7d1411', light: '#e9655f' },
    [RailroadId.BO]: { fill: '#2f4fa8', text: '#ffffff', dark: '#1b2f66', light: '#6f8bd6' },
    [RailroadId.BM]: { fill: '#3d7d2f', text: '#ffffff', dark: '#234a1a', light: '#78b366' },
    [RailroadId.CO]: { fill: '#85501f', text: '#ffffff', dark: '#4f2d0f', light: '#c08a55' },
    [RailroadId.PLE]: { fill: '#f0d21b', text: '#2a2208', dark: '#9b8506', light: '#f8e87a' },
    [RailroadId.NYC]: { fill: '#232323', text: '#ffffff', dark: '#000000', light: '#5c5c5c' },
    [RailroadId.BAGS]: { fill: '#e8a417', text: '#2a1d04', dark: '#8f6206', light: '#f4cd78' },
    [RailroadId.NA]: { fill: '#2f6fb8', text: '#ffffff', dark: '#1a3f6b', light: '#79a6dc' },
    [RailroadId.BAP]: { fill: '#232323', text: '#ffffff', dark: '#000000', light: '#5c5c5c' },
    [RailroadId.BAW]: { fill: '#c8231f', text: '#ffffff', dark: '#7d1411', light: '#e9655f' },
    [RailroadId.CA]: { fill: '#3d7d2f', text: '#ffffff', dark: '#234a1a', light: '#78b366' },
    [RailroadId.CR]: { fill: '#9a6a3c', text: '#ffffff', dark: '#5a3b1d', light: '#cfa47a' }
}
