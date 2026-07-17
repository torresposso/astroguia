export interface QATestCase {
  id: string
  label: string
  question: string
  expectedFirstTool: string
  expectedDrillDownTool?: string
  expectsTiming?: boolean
}

export const QA_FIXTURES: QATestCase[] = [
  {
    id: 'qa-01',
    label: 'Current astrological situation — timing + chart_facts',
    question:
      '¿Cómo está mi carta astrológica actualmente? ¿Qué está pasando con Plutón y el Nodo Norte ahora?',
    expectedFirstTool: 'chart_facts',
    expectsTiming: true,
  },
  {
    id: 'qa-02',
    label: 'Natal Pluto placement',
    question: '¿En qué signo y casa está mi Plutón natal?',
    expectedFirstTool: 'chart_facts',
  },
  {
    id: 'qa-03',
    label: 'Current transits',
    question:
      '¿Qué tránsitos tengo activos ahorita y cómo me están afectando?',
    expectedFirstTool: 'chart_facts',
    expectedDrillDownTool: 'transits',
    expectsTiming: true,
  },
  {
    id: 'qa-04',
    label: 'Firdaria period',
    question:
      '¿En qué período de firdaria estoy y qué significa para mi vida ahora?',
    expectedFirstTool: 'chart_facts',
    expectedDrillDownTool: 'firdaria',
    expectsTiming: true,
  },
  {
    id: 'qa-05',
    label: 'Saturn return timing',
    question:
      '¿Estoy en mi retorno de Saturno? ¿Cuándo fue la última vez que Saturno volvió a mi posición natal?',
    expectedFirstTool: 'chart_facts',
    expectedDrillDownTool: 'returns',
    expectsTiming: true,
  },
  {
    id: 'qa-06',
    label: 'Lunar phase',
    question:
      '¿Cuál es mi fase lunar natal y qué significa evolutivamente?',
    expectedFirstTool: 'chart_facts',
  },
  {
    id: 'qa-07',
    label: 'Aspect patterns',
    question:
      '¿Tengo una cuadratura en T en mi carta? ¿Qué aspectos tensos tengo?',
    expectedFirstTool: 'chart_facts',
    expectedDrillDownTool: 'aspect_patterns',
  },
  {
    id: 'qa-08',
    label: 'Dignities and planetary strength',
    question:
      '¿Qué tan fuerte está mi Saturno? ¿Está en dignidad o en detrimento?',
    expectedFirstTool: 'chart_facts',
    expectedDrillDownTool: 'dignities',
  },
  {
    id: 'qa-09',
    label: 'Profections lord of the year',
    question:
      '¿Quién es el señor del año en mi carta ahora? ¿Qué casa está activada por profección?',
    expectedFirstTool: 'chart_facts',
    expectedDrillDownTool: 'profections',
    expectsTiming: true,
  },
  {
    id: 'qa-10',
    label: 'Cosmic weather no chart needed',
    question:
      '¿Qué está pasando astrológicamente hoy en el cielo?',
    expectedFirstTool: 'chart_facts',
    expectsTiming: true,
  },
]
