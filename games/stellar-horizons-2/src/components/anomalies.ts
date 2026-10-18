import { ANOMALIES, type AnomalyDefinition } from './anomalyCatalog.js'

export {
    ANOMALIES,
    AnomalyBackKind,
    AnomalyChallenge,
    CardDeck,
    type AnomalyBack,
    type AnomalyDefinition,
    type AnomalyReward,
    type BaseEffects
} from './anomalyCatalog.js'

export function anomalyDefinition(anomalyId: string): AnomalyDefinition {
    const anomaly = ANOMALIES.find((candidate) => candidate.id === anomalyId)
    if (!anomaly) {
        throw new Error(`Unknown anomaly ${anomalyId}`)
    }
    return anomaly
}
