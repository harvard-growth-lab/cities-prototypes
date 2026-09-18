import type { ComponentType } from 'react'

/** One visual explainer: a card on the gallery and the page it opens.
 *  Adding an explainer means adding an entry here — the gallery and the
 *  /explainers/$id route both read this list. (Pattern from tz-prototypes-2.) */
export interface Explainer {
  /** the URL segment under /explainers/ — a shared link, so keep it stable */
  id: string
  title: string
  read: string
  desc: string
  Thumb: ComponentType
  Page: ComponentType
}

export const EXPLAINERS: Explainer[] = []

export const explainerById = (id: string): Explainer | undefined =>
  EXPLAINERS.find((e) => e.id === id)
