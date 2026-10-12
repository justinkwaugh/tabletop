import { ANOMALIES, type AnomalyDefinition } from './anomalyCatalog.js'

export { ANOMALIES, AnomalyChallenge, type AnomalyDefinition } from './anomalyCatalog.js'

export function anomalyDefinition(anomalyId: string): AnomalyDefinition {
    const anomaly = ANOMALIES.find((candidate) => candidate.id === anomalyId)
    if (!anomaly) {
        throw new Error(`Unknown anomaly ${anomalyId}`)
    }
    return anomaly
}
