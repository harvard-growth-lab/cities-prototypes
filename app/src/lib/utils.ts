import { createCn } from 'cn/config'

/* The type roles in src/styles/index.css (text-note, text-h3, text-hero…)
   are font sizes, but a merge engine that doesn't know them reads `text-h3`
   as a colour and drops it beside `text-ink`. Teach it the scale. */
export const cn = createCn({
  extend: {
    classGroups: {
      'font-size': [{ text: ['xs', 'sm', 'note', 'base', 'title', 'h3', 'h2', 'q', 'hero'] }],
    },
  },
})
