let scene = 0, data;
const svg = d3.select("#chart"), width=+svg.attr("width"), height=+svg.attr("height");
let selectedCountry;

d3.csv("data/co2.csv").then(d => {
  data = d.map(d=>({country:d.country, year:+d.year, value:+d.co2_per_capita}));
  selectedCountry = data[0].country;
  setupDropdown();
  renderScene();
});

d3.select("#next").on("click", () => { scene=Math.min(scene+1,2); renderScene(); });
d3.select("#prev").on("click", () => { scene=Math.max(scene-1,0); renderScene(); });

function setupDropdown(){
  const countries = Array.from(new Set(data.map(d=>d.country))).sort();
  const select = d3.select("body").append("select").attr("id","countryDropdown").style("display","none");
  select.selectAll("option").data(countries).enter()
    .append("option").attr("value",d=>d).text(d=>d);
  select.on("change", function(){ selectedCountry=this.value; renderScene(); });
}

function renderScene(){
  svg.selectAll("*").remove();
  d3.select("#countryDropdown").style("display", scene===2 ? "inline-block":"none");
  if(scene===0) scene0();
  else if(scene===1) scene1();
  else scene2();
}

function scene0(){
  const yearly = d3.rollups(data, vs=>d3.mean(vs,d=>d.value), d=>d.year)
    .map(([year,value])=>({year,value}));
  drawLine(yearly,"Global Average");
  svg.append("text").attr("x",60).attr("y",60).attr("class","annotation")
     .text("Scene 1: Global average CO₂ emissions per capita (1960–2020)");
}

function scene1(){
  const latest = d3.max(data, d=>d.year);
  const top5 = Array.from(new Set(data.filter(d=>d.year===latest)))
    .sort((a,b)=>b.value-a.value).slice(0,5).map(d=>d.country);
  const filt = data.filter(d=> top5.includes(d.country) );
  drawMultiLine(filt, top5);
  svg.append("text").attr("x",60).attr("y",60).attr("class","annotation")
     .text(`Scene 2: Top 5 CO₂ per capita emitters in ${latest}`);
}

function scene2(){
  const filt = data.filter(d=>d.country===selectedCountry);
  drawLine(filt,selectedCountry);
  svg.append("text").attr("x",60).attr("y",60).attr("class","annotation")
     .text("Scene 3: Explore per‑capita emissions for any country");
}

function drawLine(series,label){
  const x=d3.scaleLinear().domain(d3.extent(series,d=>d.year)).range([50,850]);
  const y=d3.scaleLinear().domain([0,d3.max(series,d=>d.value)]).range([450,50]);
  svg.append("g").attr("transform","translate(0,450)").call(d3.axisBottom(x).tickFormat(d3.format("d")));
  svg.append("g").attr("transform","translate(50,0)").call(d3.axisLeft(y));
  svg.append("path").datum(series).attr("fill","none").attr("stroke","steelblue").attr("stroke-width",2)
     .attr("d", d3.line().x(d=>x(d.year)).y(d=>y(d.value)) );
  svg.append("text").attr("x",width-200).attr("y",470).attr("text-anchor","end")
     .style("font-size","12px").text(label);
}

function drawMultiLine(filtered,countries){
  const x=d3.scaleLinear().domain(d3.extent(filtered,d=>d.year)).range([50,850]);
  const y=d3.scaleLinear().domain([0,d3.max(filtered,d=>d.value)]).range([450,50]);
  const color = d3.scaleOrdinal(d3.schemeCategory10).domain(countries);
  svg.append("g").attr("transform","translate(0,450)").call(d3.axisBottom(x).tickFormat(d3.format("d")));
  svg.append("g").attr("transform","translate(50,0)").call(d3.axisLeft(y));
  countries.forEach(c=>{
    const arr = filtered.filter(d=>d.country===c);
    svg.append("path").datum(arr).attr("fill","none").attr("stroke",color(c)).attr("stroke-width",2)
       .attr("d", d3.line().x(d=>x(d.year)).y(d=>y(d.value)) );
  });
}
