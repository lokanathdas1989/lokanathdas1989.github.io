
let scene = 0;
let data;
let svg = d3.select("#chart");
let width = +svg.attr("width"), height = +svg.attr("height");

d3.csv("data/co2.csv").then(d => {
  data = d.map(d => ({
    country: d.country,
    year: +d.year,
    value: +d.co2_per_capita
  }));
  renderScene();
});

d3.select("#next").on("click", () => {
  scene = Math.min(scene + 1, 2);
  renderScene();
});
d3.select("#prev").on("click", () => {
  scene = Math.max(scene - 1, 0);
  renderScene();
});

function renderScene() {
  svg.selectAll("*").remove();
  if (scene === 0) scene0();
  else if (scene === 1) scene1();
  else scene2();
}

function scene0() {
  let annotation = [
    {
      note: { label: "USA had the highest per capita emissions in 1970s" },
      x: 200, y: 100, dy: -30, dx: 20
    }
  ];

  drawLineChart(["USA"]);
  d3.annotation().annotations(annotation).type(d3.annotationLabel)(svg.append("g"));
}

function scene1() {
  let annotation = [
    {
      note: { label: "India's emissions are still low despite growth" },
      x: 500, y: 400, dy: -30, dx: 40
    }
  ];

  drawLineChart(["USA", "China", "India"]);
  d3.annotation().annotations(annotation).type(d3.annotationLabel)(svg.append("g"));
}

function scene2() {
  drawLineChart(["USA", "China", "India"]);
  svg.selectAll("circle")
    .data(data.filter(d => ["USA", "China", "India"].includes(d.country)))
    .enter().append("circle")
    .attr("cx", d => xScale(d.year))
    .attr("cy", d => yScale(d.value))
    .attr("r", 3)
    .on("mouseover", (event, d) => {
      let tip = svg.append("text").attr("id", "tooltip").attr("x", xScale(d.year) + 10).attr("y", yScale(d.value)).text(`${d.country} (${d.year}): ${d.value}`);
    })
    .on("mouseout", () => svg.select("#tooltip").remove());
}

let xScale, yScale;

function drawLineChart(countries) {
  let filtered = data.filter(d => countries.includes(d.country));
  xScale = d3.scaleLinear().domain(d3.extent(filtered, d => d.year)).range([50, 850]);
  yScale = d3.scaleLinear().domain([0, d3.max(filtered, d => d.value)]).range([450, 50]);

  let color = d3.scaleOrdinal(d3.schemeCategory10).domain(countries);

  svg.append("g").attr("transform", "translate(0,450)").call(d3.axisBottom(xScale).tickFormat(d3.format("d")));
  svg.append("g").attr("transform", "translate(50,0)").call(d3.axisLeft(yScale));

  let line = d3.line()
    .x(d => xScale(d.year))
    .y(d => yScale(d.value));

  countries.forEach(country => {
    svg.append("path")
      .datum(filtered.filter(d => d.country === country))
      .attr("fill", "none")
      .attr("stroke", color(country))
      .attr("stroke-width", 2)
      .attr("d", line);
  });
}
