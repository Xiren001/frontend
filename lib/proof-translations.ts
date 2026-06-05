// Static translation maps extracted from the Excel "Read Me First" sheets.
// ES sheet labels are Spanish; DE sheet labels are Hungarian (the DE proofreader's UI).

function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

const SEVERITY: Record<string, string> = {
  // Spanish (ES)
  'critico':  'Critical',
  'critical': 'Critical',
  'medio':    'Medium',
  'mediano':  'Medium',
  'medium':   'Medium',
  'menor':    'Minor',
  'minor':    'Minor',
  'low':      'Minor',
  // Hungarian (DE sheet)
  'kritikus': 'Critical',
  'kozepes':  'Medium',
  'apro':     'Minor',
}

const ISSUE_TYPE: Record<string, string> = {
  // Spanish (ES)
  'gramatica / ortografia':          'Grammar / spelling',
  'gramatica/ortografia':            'Grammar / spelling',
  'error de traduccion':             'Mistranslation',
  'suena traducido / no nativo':     'Awkward / not local',
  'tono incorrecto':                 'Tone wrong for market',
  'tratamiento (tu / usted)':        'Formality (tú vs usted)',
  'adecuacion cultural':             'Cultural fit',
  'marca / numero / unidad':         'Brand / number / unit',
  'otro':                            'Other',
  // Hungarian (DE sheet)
  'nyelvtan / helyesiras':           'Grammar / spelling',
  'felreforditas':                   'Mistranslation',
  'idegen hangzasu':                 'Awkward / not local',
  'nem megfelelő hangnem':           'Tone wrong for market',
  'nem megfelelő hangnemet':         'Tone wrong for market',
  'tegezes / magazas':               'Formality (du vs Sie)',
  'kulturalis illeszkedés':          'Cultural fit',
  'markanev / szam / mertekegyseg':  'Brand / number / unit',
  'egyeb':                           'Other',
}

const PDP_SECTION: Record<string, string> = {
  // Spanish
  'titulo del producto':  'Product title',
  'subtitulo':            'Subtitle',
  'vinetas / puntos':     'Bullet points',
  'descripcion':          'Description',
  'especificaciones':     'Specifications',
  'faq':                  'FAQ',
  'resenas':              'Reviews',
  'cta / botones':        'CTA / buttons',
  'envio y devoluciones': 'Shipping & returns',
  'otro':                 'Other',
  // Hungarian
  'termekcim':                  'Product title',
  'alcim':                      'Subtitle',
  'felsorolas / pontok':        'Bullet points',
  'leiras':                     'Description',
  'muszaki adatok':             'Specifications',
  'gyik':                       'FAQ',
  'velemenyek':                 'Reviews',
  'cta / gombok':               'CTA / buttons',
  'szallitas es visszakuldés':  'Shipping & returns',
  'egyeb':                      'Other',
}

export function translateSeverity(s: string | null): string | null {
  if (!s) return s
  return SEVERITY[norm(s)] ?? s
}

export function translateIssueType(s: string | null): string | null {
  if (!s) return s
  return ISSUE_TYPE[norm(s)] ?? s
}

export function translateLocation(s: string | null): string | null {
  if (!s) return s
  return PDP_SECTION[norm(s)] ?? s
}
