// ===== Fixed-size D3 narrative (NaNs removed, aggregates excluded, dynamic Scene 3 title) =====
let scene = 0;  // 0: global average, 1: top30 bubble (latest year), 2: explore selected country
let data = [];
let selectedCountry = null;

const svg = d3.select("#chart");
const tooltip = d3.select("#tooltip");
const dd = d3.select("#countryDropdown");
const btnNext = d3.select("#next");
const btnPrev = d3.select("#prev");

const margin = { top: 54, right: 36, bottom: 70, left: 140 }; // more left for country names
const width  = +svg.attr("width");
const height = +svg.attr("height");
const innerWidth  = width - margin.left - margin.right;
const innerHeight = height - margin.top - margin.bottom;

btnNext.on("click", () => { scene = Math.min(2, scene + 1); updateSteps(); render(); });
btnPrev.on("click", () => { scene = Math.max(0, scene - 1); updateSteps(); render(); });

// --- Robust numeric parse for co2_per_capita ---
function parseValue(raw){
  const v = (raw ?? "").toString().trim();
  if (!v) return NaN;
  const num = +v;
  return Number.isFinite(num) ? num : NaN;
}

// --- Load dataset (headers: country,year,co2_per_capita) ---
d3.csv("data/co2.csv", d => ({
  country: d.country,
  year: +d.year,
  value: parseValue(d.co2_per_capita)
})).then(rows => {
  // Keep rows with numeric year; value may be NaN (we'll clean per scene)
  data = rows.filter(r => Number.isFinite(r.year));

  // Default country = first with numeric values (else first alphabetically)
  const countriesWithValues = Array.from(
    d3.group(data.filter(d => Number.isFinite(d.value)), d => d.country).keys()
  ).sort();
  const allCountries = Array.from(new Set(data.map(d => d.country))).sort();

  selectedCountry = countriesWithValues[0] || allCountries[0] || null;

  setupDropdown(allCountries);
  updateSteps();
  render();
});

/* ---------------- Utilities ---------------- */
function cleanSeries(series){ return series.filter(d => Number.isFinite(d.value) && Number.isFinite(d.year)); }
function cleanRows(rows){ return rows.filter(d => Number.isFinite(d.value) && Number.isFinite(d.year)); }
function yearExtentClean(arr){ return (!arr.length) ? null : d3.extent(arr, d => d.year); }

// Exclude aggregates/regions (Scene 2 should be real countries only)
function isAggregate(name){
  if (!name) return true;
  if (name.includes("(")) return true; // e.g., "Africa (GCP)"
  const k = name.toLowerCase();
  return [
    "world","europe","asia","africa","americas","north america","south america",
    "oceania","european union","eu","oecd","upper middle income","lower middle income",
    "high income","low income","caribbean","micronesia","melanesia","polynesia",
    "middle east","central asia","eastern europe","western europe","sub-saharan","latin america"
  ].some(term => k.includes(term));
}

/* ---------------- UI wiring ---------------- */
function setupDropdown(countries){
  dd.selectAll("option").data(countries).join("option")
    .attr("value", d => d).text(d => d);

  if (selectedCountry) dd.property("value", selectedCountry);

  // Re-render immediately when the user changes the country (only matters in Scene 3)
  dd.on("change", function(){
    selectedCountry = this.value;
    if (scene === 2) render(); // updates the chart AND the dynamic title
  });
}

function updateSteps(){
  for (let i=0;i<3;i++){
    d3.select(`#step-${i}`).classed("current", i === scene);
  }
  // Dropdown visible & enabled only in Scene 3
  const show = scene === 2;
  dd.style("display", show ? "inline-block" : "none")
    .property("disabled", !show);
}

function setSceneHeader(title, note){
  d3.select("#scene-title").text(title);
  d3.select("#scene-note").text(note);
}

function render(){
  svg.selectAll("*").remove();
  hideTip();

  if (scene === 0) return renderGlobalAverage();
  if (scene === 1) return renderTop30Bubble();
  return renderCountryExplore();
}

function drawAxes(g, x, y, xLabel = "Year", yLabel = "CO₂ per capita (tonnes)"){
  g.append("g").attr("class","axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(8).tickFormat(d3.format("d")));
  g.append("g").attr("class","axis").call(d3.axisLeft(y).ticks(6));

  g.append("text").attr("class","axis-label")
    .attr("x", innerWidth/2).attr("y", innerHeight + 52)
    .attr("text-anchor","middle").text(xLabel);
  g.append("text").attr("class","axis-label")
    .attr("transform","rotate(-90)")
    .attr("x", -innerHeight/2).attr("y", -64)
    .attr("text-anchor","middle").text(yLabel);
}

function showTip(html, event){
  tooltip.html(html)
    .style("left", (event.pageX) + "px")
    .style("top",  (event.pageY - 16) + "px")
    .style("opacity", 1)
    .attr("aria-hidden", "false");
}
function hideTip(){
  tooltip.style("opacity", 0).attr("aria-hidden", "true");
}

/* ---------------- Scene 0: Global average ---------------- */
function renderGlobalAverage(){
  setSceneHeader("Scene 1 — Global Average",
    "How has global CO₂ per capita changed over time?");

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  // Yearly global average from numeric rows only
  const yearlyAvg = d3.rollups(
    data.filter(d => Number.isFinite(d.value)),
    v => d3.mean(v, d => d.value),
    d => d.year
  ).map(([year, value]) => ({year, value}))
   .sort((a,b) => a.year - b.year);

  const clean = cleanSeries(yearlyAvg);
  if (!clean.length){
    return g.append("text")
      .attr("x", innerWidth/2).attr("y", innerHeight/2)
      .attr("text-anchor","middle").text("No numeric data available.");
  }

  const x = d3.scaleLinear().domain(yearExtentClean(clean)).range([0, innerWidth]);
  const y = d3.scaleLinear().domain([0, d3.max(clean, d => d.value)]).nice().range([innerHeight, 0]);

  drawAxes(g, x, y, "Year", "CO₂ per capita (tonnes)");

  const line = d3.line().x(d => x(d.year)).y(d => y(d.value));
  g.append("path").datum(clean)
    .attr("fill","none").attr("stroke","#1f77b4").attr("stroke-width",2).attr("d", line);

  g.selectAll(".dot-avg").data(clean).enter().append("circle")
    .attr("cx", d => x(d.year)).attr("cy", d => y(d.value))
    .attr("r", 3).attr("fill","#1f77b4")
    .on("mousemove", (event,d) => showTip(`<strong>${d.year}</strong><br>${d.value.toFixed(2)} t/person`, event))
    .on("mouseleave", hideTip);
}

/* ---------- Helper: latest year with at least N numeric values from real countries ---------- */
function latestYearWithMinCountCountries(minCount){
  const numericCountryRows = data.filter(d => Number.isFinite(d.value) && !isAggregate(d.country));
  if (!numericCountryRows.length) return undefined;

  const byYear = d3.rollups(numericCountryRows, v => v.length, d => d.year)
                   .sort((a,b) => b[0] - a[0]); // desc year
  for (const [yr, cnt] of byYear){
    if (cnt >= minCount) return yr;
  }
  // Fallback to most recent year with any numeric country values
  return d3.max(numericCountryRows, d => d.year);
}

/* ---------------- Scene 1 (now) — Top 30 Bubble Chart ---------------- */
function renderTop30Bubble(){
  // Find the most recent year with at least 30 numeric country values
  const latestYear = latestYearWithMinCountCountries(30);

  setSceneHeader(
    `Scene 2 — Top 30 Countries in ${latestYear}`,
    "Largest CO₂ per capita values in the latest well‑covered year. Bubble size ∝ value."
  );

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  if (!latestYear){
    return g.append("text")
      .attr("x", innerWidth/2).attr("y", innerHeight/2)
      .attr("text-anchor","middle").text("No year found with enough numeric country values.");
  }

  // Filter: latestYear, real countries only, numeric
  const rows = cleanRows(data.filter(d => d.year === latestYear && !isAggregate(d.country)));
  if (!rows.length){
    return g.append("text").attr("x", innerWidth/2).attr("y", innerHeight/2)
      .attr("text-anchor","middle").text("No numeric data for real countries in that year.");
  }

  // Pick top 30 by value (desc)
  const top30 = rows.sort((a,b) => b.value - a.value).slice(0, 30);

  // Scales
  const maxVal = d3.max(top30, d => d.value);
  const x = d3.scaleLinear()
    .domain([0, maxVal * 1.05])
    .range([0, innerWidth]);

  // y: country names (ranked by value), highest at top
  const y = d3.scaleBand()
    .domain(top30.map(d => d.country))
    .range([0, innerHeight])
    .padding(0.25);

  // Bubble radius: sqrt scale (area ∝ value)
  const r = d3.scaleSqrt().domain([0, maxVal]).range([4, 22]);

  // Axes (note: y axis lists country names; x axis is CO2 per capita)
  g.append("g").attr("class","axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(8));
  g.append("g").attr("class","axis").call(d3.axisLeft(y));

  // Axis labels (overrides label text)
  g.append("text").attr("class","axis-label")
    .attr("x", innerWidth/2).attr("y", innerHeight + 52)
    .attr("text-anchor","middle").text("CO₂ per capita (tonnes)");
  g.append("text").attr("class","axis-label")
    .attr("transform","rotate(-90)")
    .attr("x", -innerHeight/2).attr("y", -110) // more left to avoid y labels
    .attr("text-anchor","middle").text("Country");

  // Bubbles
  const bubbles = g.selectAll(".bubble")
    .data(top30, d => d.country)
    .join("circle")
    .attr("class", "bubble")
    .attr("cx", d => x(d.value))
    .attr("cy", d => y(d.country) + y.bandwidth()/2)
    .attr("r", d => r(d.value))
    .attr("fill", "#9467bd")
    .attr("fill-opacity", 0.85)
    .attr("stroke", "rgba(0,0,0,0.25)")
    .attr("stroke-width", 0.5)
    .on("mousemove", (event,d) => {
      showTip(
        `<strong>${d.country}</strong><br>${latestYear}: ${d.value.toFixed(2)} t/person`,
        event
      );
    })
    .on("mouseleave", hideTip);

  // Value labels to the right (optional but helpful)
  g.selectAll(".val-label")
    .data(top30)
    .join("text")
    .attr("class", "val-label")
    .attr("x", d => x(d.value) + Math.max(10, r(d.value) + 6))
    .attr("y", d => y(d.country) + y.bandwidth()/2 + 4)
    .attr("fill", "#394366")
    .attr("font-size", 11)
    .text(d => d.value.toFixed(2));

  // ----- Size Legend (three bubbles) -----
  const legend = g.append("g").attr("transform", `translate(${innerWidth - 180}, 0)`);
  const legendTitle = legend.append("text")
    .attr("x", 0).attr("y", 0)
    .attr("fill", "#394366").attr("font-size", 12).text("Bubble size = t/person");

  // pick representative sizes (min>0, mid, max)
  const vals = top30.map(d => d.value).filter(v => v > 0);
  const minV = d3.min(vals), maxV2 = d3.max(vals);
  const midV = d3.quantile(vals.sort(d3.ascending), 0.5);
  const legendVals = [minV, midV, maxV2].filter(v => Number.isFinite(v));

  const baseY = 18;
  legendVals.forEach((v, i) => {
    const cy = baseY + i * 38;
    legend.append("circle")
      .attr("cx", 18)
      .attr("cy", cy)
      .attr("r", r(v))
      .attr("fill", "#9467bd")
      .attr("fill-opacity", 0.85)
      .attr("stroke", "rgba(0,0,0,0.25)")
      .attr("stroke-width", 0.5);
    legend.append("text")
      .attr("x", 18 + r(v) + 10)
      .attr("y", cy + 4)
      .attr("fill", "#394366")
      .attr("font-size", 12)
      .text(`${v.toFixed(2)} t/person`);
  });
}

/* ---------------- Scene 2: Explore selected country (dynamic title) ---------------- */
function renderCountryExplore(){
  dd.style("display","inline-block").property("disabled", false);

  // Dynamic title based on currently selected country
  setSceneHeader(`Scene 3 — Explore: ${selectedCountry}`,
    "Use the dropdown (top right) to switch countries and inspect the curve.");

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  const rawSeries = data.filter(d => d.country === selectedCountry).sort((a,b)=>a.year-b.year);
  const series = cleanSeries(rawSeries);

  if (!series.length){
    drawAxes(
      g,
      d3.scaleLinear().domain(d3.extent(rawSeries, d => d.year)).range([0, innerWidth]),
      d3.scaleLinear().domain([0, 1]).range([innerHeight, 0]),
      "Year", "CO₂ per capita (tonnes)"
    );
    return g.append("text")
      .attr("x", innerWidth/2).attr("y", innerHeight/2)
      .attr("text-anchor","middle").attr("fill","#8a63d2")
      .text(`No numeric CO₂ per capita values for ${selectedCountry}.`);
  }

  const x = d3.scaleLinear().domain(yearExtentClean(series)).range([0, innerWidth]);
  const y = d3.scaleLinear().domain([0, d3.max(series, d => d.value)]).nice().range([innerHeight, 0]);

  drawAxes(g, x, y, "Year", "CO₂ per capita (tonnes)");

  const line = d3.line().x(d => x(d.year)).y(d => y(d.value));
  g.append("path").datum(series).attr("fill","none").attr("stroke","#8a63d2").attr("stroke-width", 2).attr("d", line);

  g.selectAll(".dot-explore").data(series).enter().append("circle")
    .attr("cx", d => x(d.year)).attr("cy", d => y(d.value))
    .attr("r", 3).attr("fill","#8a63d2")
    .on("mousemove", (event,d) => showTip(
      `<strong>${selectedCountry}</strong><br>${d.year}: ${d.value.toFixed(2)} t/person`, event))
    .on("mouseleave", hideTip);

  const last = series[series.length - 1];
  g.append("text")
    .attr("x", x(last.year) + 6)
    .attr("y", y(last.value) - 6)
    .attr("font-size", 12)
    .text(`${last.year}: ${last.value.toFixed(2)}`);
}
