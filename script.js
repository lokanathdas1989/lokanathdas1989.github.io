// ====== Simple, stable implementation (fixed 900x520 SVG) ======
let scene = 0;                           // 0: global avg, 1: top5 latest, 2: explore
let data = [];
let selectedCountry = null;

const svg = d3.select("#chart");
const tooltip = d3.select("#tooltip");
const dd = d3.select("#countryDropdown");
const btnNext = d3.select("#next");
const btnPrev = d3.select("#prev");

const margin = { top: 50, right: 30, bottom: 60, left: 70 };
const width = +svg.attr("width");
const height = +svg.attr("height");
const innerWidth = width - margin.left - margin.right;
const innerHeight = height - margin.top - margin.bottom;

btnNext.on("click", () => { scene = Math.min(2, scene + 1); updateSteps(); render(); });
btnPrev.on("click", () => { scene = Math.max(0, scene - 1); updateSteps(); render(); });

// Load real dataset (YOU provide data/co2.csv with columns: country,year,co2_per_capita)
d3.csv("data/co2.csv", d => ({
  country: d.country,
  year: +d.year,
  value: d.co2_per_capita === "" ? NaN : +d.co2_per_capita
})).then(rows => {
  data = rows.filter(r => Number.isFinite(r.year)); // keep rows even if value is NaN
  const countriesWithValues = d3.group(data.filter(d => Number.isFinite(d.value)), d => d.country);
  selectedCountry = Array.from(countriesWithValues.keys()).sort()[0] || "World";

  setupDropdown();
  updateSteps();
  render();
});

function setupDropdown(){
  const countries = Array.from(new Set(data.map(d => d.country))).sort();
  dd.selectAll("option").data(countries).join("option")
    .attr("value", d => d).text(d => d);
  dd.property("value", selectedCountry);
  dd.on("change", function(){
    selectedCountry = this.value;
    if (scene === 2) render();
  });
}

function updateSteps(){
  for (let i=0;i<3;i++){
    d3.select(`#step-${i}`).classed("current", i === scene);
  }
  // Dropdown visible only in Scene 3 (Martini glass)
  dd.style("display", scene === 2 ? "inline-block" : "none");
}

function setSceneHeader(title, note){
  d3.select("#scene-title").text(title);
  d3.select("#scene-note").text(note);
}

function render(){
  svg.selectAll("*").remove();
  tooltip.style("opacity", 0).attr("aria-hidden", "true");

  if (scene === 0) return renderGlobalAverage();
  if (scene === 1) return renderTop5Latest();
  return renderCountryExplore();
}

// ---------- Helpers ----------
function drawAxes(g, x, y){
  g.append("g").attr("class","axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(8).tickFormat(d3.format("d")));

  g.append("g").attr("class","axis")
    .call(d3.axisLeft(y).ticks(6));

  g.append("text").attr("class","axis-label")
    .attr("x", innerWidth/2).attr("y", innerHeight + 44)
    .attr("text-anchor","middle").text("Year");

  g.append("text").attr("class","axis-label")
    .attr("transform","rotate(-90)")
    .attr("x", -innerHeight/2).attr("y", -50)
    .attr("text-anchor","middle").text("CO₂ per capita (tonnes)");
}

function showTip(html, event){
  tooltip.html(html)
    .style("left", (event.offsetX) + "px")
    .style("top", (event.offsetY - 8) + "px")
    .style("opacity", 1)
    .attr("aria-hidden", "false");
}
function hideTip(){
  tooltip.style("opacity", 0).attr("aria-hidden", "true");
}

// ---------- Scene 0: Global average ----------
function renderGlobalAverage(){
  setSceneHeader("Scene 1 — Global Average",
    "How has global CO₂ per capita changed across time?");

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const yearlyAvg = d3.rollups(
    data.filter(d => Number.isFinite(d.value)),
    v => d3.mean(v, d => d.value),
    d => d.year
  ).map(([year, value]) => ({year, value}))
   .sort((a,b) => a.year - b.year);

  const x = d3.scaleLinear().domain(d3.extent(yearlyAvg, d => d.year)).range([0, innerWidth]);
  const y = d3.scaleLinear().domain([0, d3.max(yearlyAvg, d => d.value) || 1]).nice().range([innerHeight, 0]);

  drawAxes(g, x, y);

  const line = d3.line().x(d => x(d.year)).y(d => y(d.value));
  g.append("path")
    .datum(yearlyAvg)
    .attr("fill","none").attr("stroke","#1f77b4").attr("stroke-width",2)
    .attr("d", line);

  // hover dots
  g.selectAll(".dot")
    .data(yearlyAvg).enter().append("circle")
    .attr("cx", d => x(d.year)).attr("cy", d => y(d.value))
    .attr("r", 3).attr("fill","#1f77b4")
    .on("mousemove", (event,d) => showTip(`<strong>${d.year}</strong><br>${d.value.toFixed(2)} t/person`, event))
    .on("mouseleave", hideTip);
}

// ---------- Scene 1: Top 5 latest ----------
function renderTop5Latest(){
  // choose the latest year with enough data points
  const maxYear = d3.max(data, d => d.year);
  const rowsLatest = data.filter(d => d.year === maxYear && Number.isFinite(d.value));
  const latestYear = rowsLatest.length >= 10 ? maxYear
    : d3.max(data.filter(d => Number.isFinite(d.value)), d => d.year);

  setSceneHeader(`Scene 2 — Top 5 Countries in ${latestYear}`,
    "Who emits the most CO₂ per person in the latest year?");

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const atLatest = data.filter(d => d.year === latestYear && Number.isFinite(d.value));
  const top5 = atLatest.sort((a,b) => b.value - a.value).slice(0,5).map(d => d.country);
  const filtered = data.filter(d => top5.includes(d.country));
  const x = d3.scaleLinear().domain(d3.extent(filtered, d => d.year)).range([0, innerWidth]);
  const y = d3.scaleLinear().domain([0, d3.max(filtered, d => d.value) || 1]).nice().range([innerHeight, 0]);

  drawAxes(g, x, y);

  const palette = ["#1f77b4","#9467bd","#2ca02c","#ff7f0e","#d62728"];
  const color = d3.scaleOrdinal().domain(top5).range(palette);

  // Legend
  const legend = g.append("g").attr("class","legend").attr("transform","translate(0,-26)");
  top5.forEach((c,i) => {
    const group = legend.append("g").attr("transform", `translate(${i*160},0)`);
    group.append("rect").attr("x",0).attr("y",-12).attr("width", 150).attr("height", 22).attr("fill","transparent");
    group.append("rect").attr("x",4).attr("y",-8).attr("width", 12).attr("height", 12).attr("fill", color(c));
    group.append("text").attr("x", 22).attr("y", 2).text(c);
  });

  const line = d3.line().defined(d => Number.isFinite(d.value)).x(d => x(d.year)).y(d => y(d.value));

  top5.forEach(cn => {
    const series = filtered.filter(d => d.country === cn).sort((a,b) => a.year - b.year);
    g.append("path")
      .datum(series)
      .attr("fill","none").attr("stroke", color(cn)).attr("stroke-width", 2)
      .attr("d", line);

    // hover points (subsample if very long)
    const pts = series.length > 200 ? series.filter((_,i)=> i%Math.ceil(series.length/200)===0) : series;
    g.selectAll(`.dot-${cn.replace(/\s+/g,'_')}`)
      .data(pts).enter().append("circle")
      .attr("cx", d => x(d.year)).attr("cy", d => y(d.value))
      .attr("r", 3).attr("fill", color(cn))
      .on("mousemove", (event,d) => showTip(`<strong>${cn}</strong><br>${d.year}: ${d.value.toFixed(2)} t/person`, event))
      .on("mouseleave", hideTip);
  });
}

// ---------- Scene 2: Explore any country ----------
function renderCountryExplore(){
  setSceneHeader(`Scene 3 — Explore: ${selectedCountry}`,
    "Use the dropdown (top‑right) to switch countries and inspect the curve.");

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  const series = data.filter(d => d.country === selectedCountry).sort((a,b)=>a.year-b.year);

  const x = d3.scaleLinear().domain(d3.extent(series, d => d.year)).range([0, innerWidth]);
  const y = d3.scaleLinear().domain([0, d3.max(series, d => d.value) || 1]).nice().range([innerHeight, 0]);

  drawAxes(g, x, y);

  const line = d3.line().defined(d => Number.isFinite(d.value)).x(d => x(d.year)).y(d => y(d.value));
  g.append("path")
    .datum(series)
    .attr("fill","none").attr("stroke","#8a63d2").attr("stroke-width", 2)
    .attr("d", line);

  // hover dots
  const pts = series.filter(d => Number.isFinite(d.value));
  g.selectAll(".dot-explore")
    .data(pts).enter().append("circle")
    .attr("cx", d => x(d.year)).attr("cy", d => y(d.value))
    .attr("r", 3).attr("fill","#8a63d2")
    .on("mousemove", (event,d) => showTip(`<strong>${selectedCountry}</strong><br>${d.year}: ${d.value.toFixed(2)} t/person`, event))
    .on("mouseleave", hideTip);

  // last value label
  const last = [...pts].reverse()[0];
  if (last){
    g.append("text")
      .attr("x", x(last.year) + 6)
      .attr("y", y(last.value) - 6)
      .attr("font-size", 12)
      .text(`${last.year}: ${last.value.toFixed(2)}`);
  }
}
