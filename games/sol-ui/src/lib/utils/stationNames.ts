import { StationType } from '@tabletop/sol'

export const StationNames: Record<StationType, string> = {
    [StationType.EnergyNode]: 'energy node',
    [StationType.SundiverFoundry]: 'sundiver foundry',
    [StationType.TransmitTower]: 'transmit tower'
}

export const StationNameArticles: Record<StationType, string> = {
    [StationType.EnergyNode]: 'an',
    [StationType.SundiverFoundry]: 'a',
    [StationType.TransmitTower]: 'a'
}
