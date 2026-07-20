import { StoryAct, type ActStep } from "./StoryAct";
import { SKY_H, SKY_W, drawSkyline, BOOM, NIGHT, type SkyScene } from "./skyline";
import { ST_H, ST_W, drawStreet, type StScene } from "./street";

/**
 * "How to Read a City" — a Pudding-style scrollytelling feature for a
 * general audience. Three full-bleed acts over one pixel town: the lights
 * and the moving trucks (people vote with their feet), the docks and Main
 * Street (exports are the city's oxygen), and the boom/bust skyline with
 * the two-dial diagnosis (population × wages). All pixels, no datasets —
 * the graphics run on the pixel lab's language.
 */

/* ————— Act I · the lights and the bridge ————— */

const ACT1: ActStep<SkyScene>[] = [
  {
    state: NIGHT,
    kind: "title",
    render: (
      <div className="story-hero">
        <div className="eyebrow">A pixel field guide to how cities work</div>
        <h1>How to Read a City</h1>
        <p className="lede">
          Lit windows, moving trucks, cranes, dark storefronts — a city
          announces exactly how it&rsquo;s doing, all the time, to anyone who
          knows the code. No spreadsheets required. Scroll to learn it.
        </p>
        <div className="story-credit">
          Adapted from <em>Doing Growth Diagnostics in Cities</em> · Harvard
          Growth Lab
        </div>
        <div className="story-cue">Scroll ↓</div>
      </div>
    ),
  },
  {
    state: { ...NIGHT, hour: 21.8 },
    align: "left",
    title: "Start with the lights.",
    body: [
      "It's just past nine in Anyville, and every lit window up there is a small decision: somebody chose to live in this city tonight — to keep paying its rent, working its jobs, walking its streets.",
      "A census is just this picture, counted carefully.",
    ],
  },
  {
    state: { ...NIGHT, hour: 22.5, flow: 0.2 },
    align: "right",
    title: "Here's the thing: nobody has to stay.",
    body: [
      "Countries have borders, visas, paperwork. Cities have none of that. Anyone in Anyville could be fifty miles up the road by Friday, no questions asked.",
      "Which means a city never stops auditioning. Every resident, every day, is quietly comparing the deal here — pay, rent, schools, streets — against the deal somewhere else.",
    ],
  },
  {
    state: { ...NIGHT, hour: 7.4, flow: 1, occ: 0.95, harbor: 0.65 },
    align: "left",
    title: "When the deal is good, you can watch it arrive.",
    body: [
      "Word gets out — the pay is decent, the rent is sane, life is livable — and nobody files a report about it. They just come. Watch the bridge: every truck is a household voting yes.",
      "Economists call the moving van the most honest instrument in the discipline. People can say anything; feet tell the truth.",
    ],
  },
  {
    state: { ...NIGHT, hour: 18.5, flow: -1, occ: 0.55, factory: 0.35, harbor: 0.4 },
    align: "right",
    title: "And when it sours, feet talk first.",
    body: [
      "Better pay somewhere else, or cheaper rent, or safer streets — and the same bridge runs in reverse. The windows go dark one lease at a time.",
      "Detroit lost over half its people. Not because they were trapped there — because they weren't.",
    ],
  },
  {
    state: { ...NIGHT, hour: 19.7, flow: -0.15, occ: 0.78, factory: 0.7 },
    align: "left",
    title: "So population is the score.",
    body: [
      "This is why city diagnosticians check people before anything else — before income, before GDP, before the mayor's slide deck. If your city is gaining people slower than its peers — or losing them — something in the deal is broken.",
      "The next question is what makes the deal good in the first place. For that, we need to go down to the water.",
    ],
  },
];

/* ————— Act II · the docks and Main Street ————— */

const DOCKS: StScene = {
  hour: 8.4,
  factory: 1,
  ship: 1,
  shops: 0.92,
  workers: 0.6,
  tourists: 0.25,
  gold: 0,
};

const ACT2: ActStep<StScene>[] = [
  {
    state: DOCKS,
    kind: "title",
    eyebrow: "Part two",
    title: "Exports are a city's oxygen",
  },
  {
    state: { ...DOCKS, hour: 9.2 },
    align: "right",
    title: "A city can't feed itself.",
    body: [
      "Almost everything Anyville consumes — the food, the fuel, the phones, the coffee — is made somewhere else. All of it has to be paid for with money earned from somewhere else.",
      "That money comes in through here: the docks, where the city sells what it makes to people who don't live in it.",
    ],
  },
  {
    state: { ...DOCKS, hour: 10.2, gold: 1 },
    align: "right",
    title: "Breathe in, breathe out.",
    body: [
      "Boxes go out; money comes in. Economists call it tradable income, but it behaves exactly like oxygen: invisible while it flows, catastrophic when it stops.",
      "Every gold fleck drifting from the ship to the works is a paycheck that outsiders are funding.",
    ],
  },
  {
    state: { ...DOCKS, hour: 12.2, gold: 0.6, tourists: 1 },
    align: "right",
    title: "An export doesn't need a box.",
    body: [
      "Anything an outsider pays for counts. A hospital treating patients from three counties away is exporting surgery. A university is exporting lectures. That tour boat is exporting a nice Tuesday afternoon.",
      "None of it ships in a container — and all of it is oxygen.",
    ],
  },
  {
    state: { ...DOCKS, hour: 16.6, gold: 1, workers: 1, shops: 1, tourists: 0.4 },
    align: "left",
    title: "One paycheck from outside, two more at home.",
    body: [
      "Follow the shift change. The dockworkers' wages get spent at the bakery, the grocer, the barber — local jobs, funded entirely by export money. The bakery never ships a thing; it still runs on oxygen.",
      "In American cities, each exporting job supports roughly 1.6 to 2.5 local ones. Economists call it the multiplier. The street just calls it Tuesday.",
    ],
  },
  {
    state: { ...DOCKS, hour: 17.9, factory: 0, ship: 0, gold: 0, workers: 0.12, shops: 0.62, tourists: 0.1 },
    align: "left",
    title: "Now hold your breath.",
    body: [
      "Close the plant. No boxes, no ship, no gold. The dockworkers' paychecks vanish first.",
      "But those paychecks were carrying the whole street.",
    ],
  },
  {
    state: { ...DOCKS, hour: 19.6, factory: 0, ship: 0, gold: 0, workers: 0, shops: 0.1, tourists: 0 },
    align: "left",
    title: "The multiplier runs in reverse.",
    body: [
      "Lose the plant, lose the barista. One by one, the shops that lived on those wages go dark, and the FOR RENT signs bloom like weeds. The barber holds on the longest. Then part one kicks in: the moving trucks find the bridge.",
      "This — not the plant closing itself — is how a city empties.",
    ],
  },
  {
    state: { ...DOCKS, hour: 9.0, factory: 0.75, ship: 0.8, shops: 0.72, workers: 0.6, tourists: 0.4, gold: 0.4 },
    align: "left",
    title: "The good news: cities can grow new lungs.",
    body: [
      "Pittsburgh lost steel and learned to export education and surgery instead. The danger isn't having a plant close; it's breathing through a single industry in the first place.",
      "A city with many ways to earn outside money can lose one and keep breathing. A one-industry town is always one bad decade from the scene you just watched.",
    ],
  },
];

/* ————— Act III · boom, bust, and the two dials ————— */

const ACT3: ActStep<SkyScene>[] = [
  {
    state: BOOM,
    kind: "title",
    eyebrow: "Part three",
    title: "Boom, bust, and how to tell what's wrong",
  },
  {
    state: { ...BOOM, hour: 11.4, crane: 1, build: 0.8, flow: 1, occ: 1.05, harbor: 1 },
    align: "left",
    title: "A boom, answered with cranes.",
    body: [
      "A new export takes off, and money and people pour in. If the city says yes — permits, apartments, floors — the boom becomes population. Rents rise a little; the skyline rises a lot. Watch the empty lot.",
      "A crane is how a city says more of us, please.",
    ],
  },
  {
    state: { ...BOOM, hour: 18.4, crane: 0.04, build: 0.16, fortress: 1, flow: 0, harbor: 1, factory: 0.9 },
    align: "center",
    title: "Now rerun the boom with the door shut.",
    body: [
      "Same jobs, same money — but this time the cranes are banned: height caps, zoning, “neighborhood character.” The new tower freezes a few floors up, right at the legal lid. People still arrive wanting in — watch the trucks reach the bridge, sit a moment, and turn back. There's nowhere to put them.",
      "The boom has to go somewhere, so it goes into prices. The only line still growing is the one outside the letting office. In a fortress city, high wages aren't a boast — they're the premium it takes to survive the rent.",
    ],
  },
  {
    state: { ...BOOM, hour: 12.1, crane: 0.8, build: 0.55, flow: 0.85, harbor: 1, factory: 1, occ: 1 },
    align: "right",
    title: "Two dials tell you which story you're in.",
    body: [
      "City doctors read population and paychecks together, like a pulse and a temperature. Four combinations, four different diseases — here's the tour.",
      "People up, pay up: employers are winning. The jobs machine is pulling people in faster than they can be housed. That's the boom you just watched.",
    ],
    hud: { people: 1, wages: 1, label: "Jobs are pulling people in" },
  },
  {
    state: { ...BOOM, hour: 15.2, crane: 0.95, build: 0.8, flow: 0.8, harbor: 0.45, factory: 0.5, occ: 1.05 },
    align: "right",
    title: "People up, pay down.",
    body: [
      "The city itself got easier to live in — homes got built, the commute got shorter — and newcomers accepted slightly thinner paychecks to be here.",
      "Nothing is wrong with this city. The good life is doing the recruiting instead of the payroll.",
    ],
    hud: { people: 1, wages: -1, label: "Cheaper living is pulling people in" },
  },
  {
    state: { ...BOOM, hour: 20.3, factory: 0.05, harbor: 0.1, flow: -0.9, occ: 0.5, crane: 0.04, build: 0.3 },
    align: "right",
    title: "People down, pay down.",
    body: [
      "The jobs machine is failing — a plant closed, an industry moved, the oxygen thinned. Employers aren't bidding for workers anymore, and workers are leaving to find someone who will.",
      "That's part two's ghost street, seen from across the river.",
    ],
    hud: { people: -1, wages: -1, label: "The jobs are leaving" },
  },
  {
    state: { ...BOOM, hour: 13.2, rain: 1, factory: 0.85, harbor: 0.8, flow: -0.75, occ: 0.7, crane: 0.08, build: 0.3 },
    align: "right",
    title: "And the strangest one: people down, pay up.",
    body: [
      "The jobs are fine. Life isn't — crime, failing schools, a poisoned river — so employers have to pay extra to convince anyone to stay, and people leave anyway. When Flint's water went bad, wages rose while houses emptied.",
      "Rising pay in a shrinking city isn't a bonus. It's a distress signal.",
    ],
    hud: { people: -1, wages: 1, label: "Life is pushing people out" },
  },
  {
    state: {
      hour: 6.6,
      occ: 0.95,
      flow: 0.3,
      factory: 0.7,
      harbor: 0.75,
      crane: 0.5,
      build: 1,
      fortress: 0,
      rain: 0,
    },
    align: "center",
    title: "Now read your own city.",
    body: [
      "Cranes on the skyline: someone is betting on more people. Moving trucks: the vote, live. Dark storefronts: oxygen trouble upstream. Rents climbing with no cranes in sight: a fortress hardening.",
      "No single sign is the whole answer — a diagnosis is a mosaic, not a dipstick. But the city is talking constantly. You just have to look up.",
    ],
  },
];

/* ————— the page ————— */

export function ReadCityPage() {
  return (
    <main className="story-page">
      <StoryAct
        w={SKY_W}
        h={SKY_H}
        draw={drawSkyline}
        steps={ACT1}
        ariaLabel="A pixel-art riverfront city seen across the water. As the story scrolls, night turns to dawn, moving trucks stream across the bridge into town or out of it, and the share of lit windows rises and falls with the city's population."
      />

      <div className="story-interlude">
        <div className="prose">
          <p>
            One idea before we go on: because anyone can leave, cities are
            always being pulled toward a strange kind of fairness. If one
            place is obviously a better deal, people move there until
            crowding and rent eat the advantage. Economists call it{" "}
            <span
              className="concept"
              title="The marginal resident is indifferent between cities: wages, rents, and quality of life net out to a similar deal everywhere."
            >
              spatial equilibrium
            </span>
            — no city gets to stay a bargain for long.
          </p>
          <p>
            So what makes a city's deal good in the first place? Wages. And
            to understand wages, you have to find out where the money enters
            town. Let's walk down to the quay.
          </p>
        </div>
      </div>

      <StoryAct
        w={ST_W}
        h={ST_H}
        draw={drawStreet}
        steps={ACT2}
        ariaLabel="Street level in the same pixel city: a container ship and gantry crane at the quay on the left, a factory with smoking stacks behind, and five small shops with striped awnings running down Main Street. As the story scrolls, gold flecks of export money arc from the ship to the factory, workers spend their wages down the street — and when the plant closes, the shops board up one by one."
      />

      <div className="story-interlude">
        <div className="prose">
          <div className="pull-stat">
            “Each additional tradable job in a US city creates 1.6–2.5 jobs
            in local services.”
            <span className="attr">
              Enrico Moretti — the local multiplier, and why the bakery
              should care about the docks
            </span>
          </div>
          <p>
            Exports set what a city can pay. But pay is only half the deal —
            the other half is what the city charges you to stay. Rent. And
            rent turns on a question that sounds bureaucratic and decides
            almost everything: when people show up wanting in,{" "}
            <em>does the city let itself build?</em>
          </p>
        </div>
      </div>

      <StoryAct
        w={SKY_W}
        h={SKY_H}
        draw={drawSkyline}
        steps={ACT3}
        ariaLabel="The wide pixel skyline again. A tower crane raises a new building on the empty lot during the boom; when construction is banned, the half-built tower freezes under a dashed height-cap line, moving trucks reach the bridge and turn back, and a queue forms outside a small letting-office kiosk on the esplanade. In the final scenes a small overlay shows the two diagnostic dials, population and paychecks, rising and falling in the four combinations."
      />

      <div className="story-interlude">
        <div className="prose">
          <p>
            There's one more idea in the toolkit, and it's the one that keeps
            city leaders honest. A city grows like water fills a barrel made
            of staves: the level is set by the <em>shortest</em> stave, not
            the average. Fixing planks that aren't the short one — a shiny
            program here, a ribbon-cutting there — feels productive and
            changes nothing. The craft is finding <em>your</em> shortest
            stave: the housing, the transit, the power, the safety, the
            know-how… whatever is actually holding the water line.
          </p>
          <p>
            That search — reading the lights, the trucks, the cranes, the
            tide line, and then testing which constraint truly binds — is
            what growth diagnosticians do for a living. You now know how to
            read the skyline they start from.
          </p>
          <div className="next-page-card">
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              Keep going
            </div>
            <h3 style={{ fontSize: 24, marginBottom: 8 }}>
              From the picture to the practice
            </h3>
            <p style={{ color: "var(--ink-2)", marginBottom: 14 }}>
              Everything here is the first mile of a real method — the one
              the Growth Lab takes into city halls, where the pixels are
              replaced by census tables, export baskets, and housing permits,
              and the mosaic gets tested constraint by constraint.
            </p>
            <div className="btn-row" style={{ marginTop: 0 }}>
              <a
                className="btn gold"
                style={{ textDecoration: "none" }}
                href="https://growthlab.hks.harvard.edu/"
                target="_blank"
                rel="noreferrer"
              >
                Read the framework →
              </a>
            </div>
          </div>
          <p className="note" style={{ marginTop: 26 }}>
            Anyville is a composite — every scene is drawn, not plotted, and
            no numbers were harmed. The framework is real:{" "}
            <em>Doing Growth Diagnostics in Cities</em>, Harvard Growth Lab
            (2026).
          </p>
        </div>
      </div>
    </main>
  );
}
