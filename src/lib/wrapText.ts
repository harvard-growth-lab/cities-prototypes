import type { BaseType, Selection } from "d3-selection";

/** Classic d3 word-wrap: re-flows each <text> node in the selection into
 *  <tspan> lines no wider than `width`, keeping the element's own x so
 *  text-anchor still decides the alignment. Call it once the text content
 *  is set. */
export function wrapText<Datum, PElement extends BaseType, PDatum>(
  sel: Selection<SVGTextElement, Datum, PElement, PDatum>,
  width: number,
  lineHeight = 1.25,
) {
  sel.each(function () {
    const words = (this.textContent ?? "").split(/\s+/).filter(Boolean).reverse();
    const x = this.getAttribute("x") ?? "0";
    const dy = parseFloat(this.getAttribute("dy") ?? "0");
    this.textContent = null;

    let line: string[] = [];
    let lineNumber = 0;
    let tspan = appendTspan(this, x, dy);

    for (let word = words.pop(); word !== undefined; word = words.pop()) {
      line.push(word);
      tspan.textContent = line.join(" ");
      if (tspan.getComputedTextLength() > width && line.length > 1) {
        line.pop();
        tspan.textContent = line.join(" ");
        line = [word];
        tspan = appendTspan(this, x, ++lineNumber * lineHeight + dy);
        tspan.textContent = word;
      }
    }
  });
}

function appendTspan(node: SVGTextElement, x: string, dy: number) {
  const tspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
  tspan.setAttribute("x", x);
  tspan.setAttribute("dy", `${dy}em`);
  node.appendChild(tspan);
  return tspan;
}
