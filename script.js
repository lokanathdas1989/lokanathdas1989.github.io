// ===== Robust, fixed-size implementation — NaNs excluded everywhere =====
let scene = 0;  // 0: global average, 1: top5 latest, 2: explore any country
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

// Load real dataset (YOU provide data/co2.csv with columns: country,year,co2_per_capita)
d3.csv("data/co2.csv", d => ({
  country: d.country,
  year: +d.year,
  value: d.co2_per_capita === "" ? NaN : +d.co2_per_capita
})).then(rows => {
  // Keep rows with a numeric year; value can be NaN (we'll clean later)
  data = rows.filter(r => Number.isFinite(r.year));

  // Choose a default country with at least one numeric value
  const countriesWithValues = Array.from(
    d3.group(data.filter(d => Number.isFinite(d.value)), d => d.country).keys()
  ).sort();
  const allCountries = Array.from(new Set(data.map(d => d.country))).sort();

  selectedCountry = countriesWithValues[0] || allCountries[0] || null;

  setupDropdown(allCountries);
  updateSteps();
  render();
});

/* ---------------- Helpers ---------------- */
// Remove NaNs from a single time series (array of {year, value})
function cleanSeries(series){
  return series.filter(d => Number.isFinite(d.value) && Number.isFinite(d.year));
}

// Remove NaNs from a mixed set of rows (e.g., many countries)
function cleanRows(rows){
  return rows.filter(d => Number.isFinite(d.value) && Number.isFinite(d.year));
}

// Year extent from a cleaned series/rows; if empty, return null
function yearExtentClean(arr){
  if (!arr.length) return null;
  return d3.extent(arr, d => d.year);
}

function setupDropdown(countries){
  dd.selectAll("option").data(countries).join("option")
    .attr("value", d => d)
    .text(d => d);
  if (selectedCountry) dd.property("value", selectedCountry);

  dd.on("change", function(){
    selectedCountry = this.value;
    if (scene === 2) render();
  });
}

function updateSteps(){
  for (let i=0;i<3;i++){
    d3.select(`#step-${i}`).classed("current", i === scene);
  }
  // Dropdown visible & enabled only in Scene 3 (Martini glass)
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

  g.append("g").attr("class","axis")
    .call(d3.axisLeft(y).ticks(6));

  // Axis labels
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

/* ---------------- Scene 0: Global average (NaNs excluded) ---------------- */
function renderGlobalAverage(){
  setSceneHeader("Scene 1 — Global Average",
    "How has global CO₂ per capita changed over time?");

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  // Compute yearly global average from only numeric values
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
  const y = d3.scaleLinear()
    .domain([0, d3.max(clean, d => d.value)])
    .nice().range([innerHeight, 0]);

  drawAxes(g, x, y);

  const line = d3.line().x(d => x(d.year)).y(d => y(d.value));
  g.append("path")
    .datum(clean)
    .attr("fill","none").attr("stroke","#1f77b4").attr("stroke-width",2)
    .attr("d", line);

  g.selectAll(".dot-avg")
    .data(clean).enter().append("circle")
    .attr("cx", d => x(d.year)).attr("cy", d => y(d.value))
    .attr("r", 3).attr("fill","#1f77b4")
    .on("mousemove", (event,d) => showTip(`<strong>${d.year}</strong><br>${d.value.toFixed(2)} t/person`, event))
    .on("mouseleave", hideTip);
}

/* ---------------- Scene 1: Top 5 latest (NaNs excluded) ---------------- */
function renderTop5Latest(){
  // latest year; if too sparse, fallback to most recent with enough numeric values
  const maxYear = d3.max(data, d => d.year);
  const rowsMax = cleanRows(data.filter(d => d.year === maxYear));
  const latestYear = rowsMax.length >= 10 ? maxYear
    : d3.max(cleanRows(data), d => d.year);

  setSceneHeader(`Scene 2 — Top 5 Countries in ${latestYear}`,
    "Who emits the most CO₂ per person in the latest year?");

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const atLatestClean = cleanRows(data.filter(d => d.year === latestYear));
  if (!atLatestClean.length){
    return g.append("text")
      .attr("x", innerWidth/2).attr("y", innerHeight/2)
      .attr("text-anchor","middle").text("No numeric data for the latest year.");
  }

  const top5 = atLatestClean.sort((a,b) => b.value - a.value).slice(0,5).map(d => d.country);
  const filteredClean = cleanRows(data.filter(d => top5.includes(d.country)));

  const x = d3.scaleLinear().domain(yearExtentClean(filteredClean)).range([0, innerWidth]);
  const y = d3.scaleLinear()
    .domain([0, d3.max(filteredClean, d => d.value)])
    .nice().range([innerHeight, 0]);

  drawAxes(g, x, y);

  const palette = ["#1f77b4","#9467bd","#2ca02c","#ff7f0e","#d62728"];
  const color = d3.scaleOrdinal().domain(top5).range(palette);

  // Legend
  const legend = g.append("g").attr("class","legend").attr("transform","translate(0,-28)");
  top5.forEach((c,i) => {
    const group = legend.append("g").attr("transform", `translate(${i*175},0)`);
    group.append("rect").attr("x",0).attr("y",-12).attr("width", 170).attr("height", 24).attr("fill","transparent");
    group.append("rect").attr("x",6).attr("y",-8).attr("width", 12).attr("height", 12).attr("fill", color(c));
    group.append("text").attr("x", 24).attr("y", 2).text(c);
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
      .on("mousemove", (event,d) => showTip(`<strong>${cn}</strong><br>${d.year}: ${d.value.toFixed(2)} t/person`, event))
      .on("mouseleave", hideTip);
  });
}

/* ---------------- Scene 2: Explore any country (NaNs excluded) ---------------- */
function renderCountryExplore(){
  // Make sure dropdown is visible AND enabled
  dd.style("display","inline-block").property("disabled", false);

  setSceneHeader("Scene 3 — Explore: Any Country",
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
      .text("No numeric CO₂ per capita values for this country.");
  }

  const x = d3.scaleLinear().domain(yearExtentClean(series)).range([0, innerWidth]);
  const y = d3.scaleLinear()
    .domain([0, d3.max(series, d => d.value)])
    .nice().range([innerHeight, 0]);

  drawAxes(g, x, y);

  const line = d3.line().x(d => x(d.year)).y(d => y(d.value));
  g.append("path")
    .datum(series)
    .attr("fill","none").attr("stroke","#8a63d2").attr("stroke-width", 2)
    .attr("d", line);

  g.selectAll(".dot-explore")
    .data(series).enter().append("circle")
    .attr("cx", d => x(d.year)).attr("cy", d => y(d.value))
    .attr("r", 3).attr("fill","#8a63d2")
    .on("mousemove", (event,d) => showTip(`<strong>${selectedCountry}</strong><br>${d.year}: ${d.value.toFixed(2)} t/person`, event))
    .on("mouseleave", hideTip);

  // Label last valid value
  const last = series[series.length - 1];
  g.append("text")
    .attr("x", x(last.year) + 6)
    .attr("y", y(last.value) - 6)
    .attr("font-size", 12)
    .text(`${last.year}: ${last.value.toFixed(2)}`);
}
