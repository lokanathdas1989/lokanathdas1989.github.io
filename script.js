// ===== Martini Glass Narrative Visualization =====
let scene = 0;
let data = [];
let selectedCountry = null;

const svg = d3.select("#chart");
const tooltip = d3.select("#tooltip");
const dd = d3.select("#countryDropdown");
const btnNext = d3.select("#next");
const btnPrev = d3.select("#prev");

const margin = { top: 54, right: 32, bottom: 70, left: 84 };
const width  = +svg.attr("width");
const height = +svg.attr("height");
const innerWidth  = width - margin.left - margin.right;
const innerHeight = height - margin.top - margin.bottom;

btnNext.on("click", () => { scene = Math.min(2, scene + 1); updateSteps(); render(); });
btnPrev.on("click", () => { scene = Math.max(0, scene - 1); updateSteps(); render(); });

// --- Numeric parse for co2_per_capita ---
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
  // Keep rows with numeric year; value with NaN will be cleaned per scene)
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

// Exclude aggregates/regions (Scene 2 top-5 should be real countries only)
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

/* ---------------- UI pairing ---------------- */
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
  if (scene === 1) return renderTop5Latest();
  return renderCountryExplore();
}

function drawAxes(g, x, y){
  g.append("g").attr("class","axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(8).tickFormat(d3.format("d")));
  g.append("g").attr("class","axis").call(d3.axisLeft(y).ticks(6));

  g.append("text").attr("class","axis-label")
    .attr("x", innerWidth/2).attr("y", innerHeight + 52)
    .attr("text-anchor","middle").text("Year");
  g.append("text").attr("class","axis-label")
    .attr("transform","rotate(-90)")
    .attr("x", -innerHeight/2).attr("y", -64)
    .attr("text-anchor","middle").text("CO₂ per capita (tonnes)");
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

  drawAxes(g, x, y);

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

/* ---------------- Scene 1: Top 5 latest (real countries only) ---------------- */
function renderTop5Latest(){
  const latestYear = latestYearWithMinCountCountries(5);

  setSceneHeader(
    `Scene 2 — Top 5 Countries in ${latestYear ?? "N/A"}`,
    "Who emits the most CO₂ per person in the most recent year?"
  );

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  if (!latestYear){
    return g.append("text")
      .attr("x", innerWidth/2).attr("y", innerHeight/2)
      .attr("text-anchor","middle").text("No year found with enough numeric country values.");
  }

  const atLatestClean = cleanRows(
    data.filter(d => d.year === latestYear && !isAggregate(d.country))
  );
  if (!atLatestClean.length){
    return g.append("text")
      .attr("x", innerWidth/2).attr("y", innerHeight/2)
      .attr("text-anchor","middle").text("No numeric data for real countries in that year.");
  }

  const top5 = atLatestClean.sort((a,b) => b.value - a.value)
                            .slice(0,5)
                            .map(d => d.country);

  const filteredClean = cleanRows(data.filter(d => top5.includes(d.country)));
  if (!filteredClean.length){
    return g.append("text")
      .attr("x", innerWidth/2).attr("y", innerHeight/2)
      .attr("text-anchor","middle").text("No numeric history for the selected countries.");
  }

  const x = d3.scaleLinear().domain(yearExtentClean(filteredClean)).range([0, innerWidth]);
  const y = d3.scaleLinear().domain([0, d3.max(filteredClean, d => d.value)]).nice().range([innerHeight, 0]);

  drawAxes(g, x, y);

  const palette = ["#1f77b4","#9467bd","#2ca02c","#ff7f0e","#d62728"];
  const color = d3.scaleOrdinal().domain(top5).range(palette);

  // Legend
  const legend = g.append("g").attr("class","legend").attr("transform","translate(0,-28)");
  top5.forEach((c,i) => {
    const group = legend.append("g").attr("transform", `translate(${i*175},0)`);
    group.append("rect").attr("x",0).attr("y",-12).attr("width",170).attr("height",24).attr("fill","transparent");
    group.append("rect").attr("x",6).attr("y",-8).attr("width",12).attr("height",12).attr("fill",color(c));
    group.append("text").attr("x",24).attr("y",2).text(c);
  });

  const line = d3.line().x(d => x(d.year)).y(d => y(d.value));

  top5.forEach(cn => {
    const seriesClean = cleanSeries(
      data.filter(d => d.country === cn).sort((a,b)=>a.year-b.year)
    );
    if (!seriesClean.length) return;

    g.append("path")
      .datum(seriesClean)
      .attr("fill","none").attr("stroke", color(cn)).attr("stroke-width", 2)
      .attr("d", line);

    const pts = seriesClean.length > 200
      ? seriesClean.filter((_,i)=> i%Math.ceil(seriesClean.length/200)===0)
      : seriesClean;

    g.selectAll(`.dot-${cn.replace(/\s+/g,'_')}`)
      .data(pts).enter().append("circle")
      .attr("cx", d => x(d.year)).attr("cy", d => y(d.value))
      .attr("r", 3).attr("fill", color(cn))
      .on("mousemove", (event,d) => showTip(
        `<strong>${cn}</strong><br>${d.year}: ${d.value.toFixed(2)} t/person`, event))
      .on("mouseleave", hideTip);
  });
}

/* ---------------- Scene 2: Explore selected country (with dynamic title) ---------------- */
function renderCountryExplore(){
  dd.style("display","inline-block").property("disabled", false);

  // Dynamic title based on currently selected country
  setSceneHeader(`Scene 3 — Explore: ${selectedCountry}`,
    "Use the dropdown (top right) to switch countries and inspect the curve.");

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  const rawSeries = data.filter(d => d.country === selectedCountry).sort((a,b)=>a.year-b.year);
  const series = cleanSeries(rawSeries);

  if (!series.length){
    drawAxes(g,
      d3.scaleLinear().domain(d3.extent(rawSeries, d => d.year)).range([0, innerWidth]),
      d3.scaleLinear().domain([0, 1]).range([innerHeight, 0])
    );
    return g.append("text")
      .attr("x", innerWidth/2).attr("y", innerHeight/2)
      .attr("text-anchor","middle").attr("fill","#8a63d2")
      .text(`No numeric CO₂ per capita values for ${selectedCountry}.`);
  }

  const x = d3.scaleLinear().domain(yearExtentClean(series)).range([0, innerWidth]);
  const y = d3.scaleLinear().domain([0, d3.max(series, d => d.value)]).nice().range([innerHeight, 0]);

  drawAxes(g, x, y);

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
