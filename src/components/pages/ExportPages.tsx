import { ASSETS } from "../../data/content";
import { VizActions } from "./VizActions";

export function ExportBasketPage({ cityShort }: { cityShort: string }) {
  return (
    <section className="page" id="page-export-basket">
      <div className="page-head">
        <h2>Your exports matter</h2>
      </div>
      <p className="lede">
        A city’s size tracks the size of its <strong>export sector</strong> — what it sells to
        people outside the region. No city makes everything it consumes (the beef, the chips, the
        software), so to buy from outside it has to sell outside. The export base is what a metro
        can ultimately support. Below is the {cityShort} MSA’s industrial composition — every
        industry sized by employment and shaded by its economic complexity.
      </p>
      <div className="viz-controls">
        <div className="ctl">
          <span className="ctl-label">Year</span>
          <select>
            <option>2024</option>
            <option>2019</option>
            <option>2014</option>
          </select>
        </div>
        <div className="ctl">
          <span className="ctl-label">Color by</span>
          <select>
            <option>Sector</option>
            <option>Complexity</option>
            <option>Growth</option>
          </select>
        </div>
        <VizActions />
      </div>
      <img className="viz-big" alt="Export basket treemap" src={ASSETS.treemap} />
    </section>
  );
}

export function ExportComplexityPage() {
  return (
    <section className="page" id="page-export-complexity">
      <div className="page-head">
        <h2>Lorem Ipsum</h2>
      </div>
      <p className="lede">
        Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut
        labore et dolore magna aliqua. Proin tortor purus platea sit eu id nisi litora libero. Neque
        vulputate consequat ac amet augue blandit maximus aliquet congue.
      </p>
      <div className="viz-controls">
        <div className="ctl">
          <span className="ctl-label">Y-Axis</span>
          <select style={{ minWidth: 250 }}>
            <option>Wage growth (mean-wage CAGR)</option>
            <option>Employment growth</option>
            <option>Complexity index</option>
          </select>
        </div>
        <span className="hint">Drag to zoom into a region.</span>
        <button className="reset">Reset zoom</button>
        <VizActions />
      </div>
      <img
        className="viz-big"
        alt="Population growth × wage growth scatter plot"
        src={ASSETS.scatter}
      />
    </section>
  );
}
