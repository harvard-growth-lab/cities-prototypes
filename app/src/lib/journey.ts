/* The Learning Journey's memory: which beats the reader has seen, how they
   answered the checkpoints, what they wrote. localStorage behind a tiny
   external store so any component can subscribe (useSyncExternalStore) and
   every write is one persisted snapshot. Keys carry the metro id: a beat
   read for Boston is not a beat read for Chicago. */
import { useSyncExternalStore } from 'react'
import { sectionBySlug, type SectionSlug } from './sections'

export interface Insight {
  section: SectionSlug
  city: string
  text: string
  /** ISO timestamp */
  at: string
}

export interface JourneyState {
  /** `${metroId}/${section}/${beat}` → true */
  visited: Record<string, true>
  /** `${metroId}/${section}/${qIndex}` → the option index chosen */
  answered: Record<string, number>
  insights: Insight[]
  exploredMetros: string[]
}

export type SectionStatus = 'not-started' | 'in-progress' | 'completed'

const KEY = 'cities:journey:v1'
const EMPTY: JourneyState = { visited: {}, answered: {}, insights: [], exploredMetros: [] }

function load(): JourneyState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return EMPTY
    const parsed = JSON.parse(raw) as Partial<JourneyState>
    return {
      visited: parsed.visited ?? {},
      answered: parsed.answered ?? {},
      insights: parsed.insights ?? [],
      exploredMetros: parsed.exploredMetros ?? [],
    }
  } catch {
    return EMPTY
  }
}

let state: JourneyState = typeof localStorage === 'undefined' ? EMPTY : load()
const listeners = new Set<() => void>()

function set(next: JourneyState) {
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* private mode / quota: the session still works, it just forgets */
  }
  for (const l of listeners) l()
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
const getSnapshot = () => state

export const useJourney = () => useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

export const visitKey = (metroId: string, section: SectionSlug, beat: string) =>
  `${metroId}/${section}/${beat}`
export const answerKey = (metroId: string, section: SectionSlug, q: number) =>
  `${metroId}/${section}/${q}`

export function markVisited(metroId: string, section: SectionSlug, beat: string) {
  const k = visitKey(metroId, section, beat)
  if (state.visited[k]) return
  set({ ...state, visited: { ...state.visited, [k]: true } })
}

export function answer(metroId: string, section: SectionSlug, q: number, choice: number) {
  const k = answerKey(metroId, section, q)
  if (state.answered[k] === choice) return
  set({ ...state, answered: { ...state.answered, [k]: choice } })
}

export function saveInsight(insight: Omit<Insight, 'at'>) {
  set({ ...state, insights: [...state.insights, { ...insight, at: new Date().toISOString() }] })
}

export function addExploredMetro(metroId: string) {
  if (state.exploredMetros.includes(metroId)) return
  set({ ...state, exploredMetros: [...state.exploredMetros, metroId] })
}

export function clearJourney() {
  set(EMPTY)
}

/** Completed once every beat of the section has been seen for this metro. */
export function sectionStatus(s: JourneyState, metroId: string, section: SectionSlug): SectionStatus {
  const beats = sectionBySlug(section)?.beats ?? []
  const seen = beats.filter((b) => s.visited[visitKey(metroId, section, b.id)]).length
  if (seen === 0) return 'not-started'
  return seen === beats.length ? 'completed' : 'in-progress'
}

export const isVisited = (s: JourneyState, metroId: string, section: SectionSlug, beat: string) =>
  Boolean(s.visited[visitKey(metroId, section, beat)])
