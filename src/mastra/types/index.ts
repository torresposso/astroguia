export interface NatalInput {
  date: string
  time?: string
  lat: number
  lon: number
  timezone?: string
  house_system?: 'placidus' | 'whole_sign' | 'koch'
}

export interface ProvenanceBlock {
  houseSystemRequested: string
  houseSystemActual: string
  birthStatus: 'exact' | 'approximate' | 'unknown'
}

export interface CaelusAtom {
  id: string
  data: unknown
}

export interface CollectedData {
  chartFacts: unknown
  firdaria: unknown
  profections: unknown
  provenance: ProvenanceBlock
}

export interface AnalysisSection {
  id: string
  body: string
  citations: string[]
}

export interface Analysis {
  sections: AnalysisSection[]
}

export interface SynthesisOutput {
  openingNarrative: string
  synthesisBody: string
  synthesisCitations: string[]
}
