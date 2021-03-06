steps_until_timeout_plot = function(datafile, width, height, margin) {

  var timeouts = [5,25,50,75,100];

  function nearestTimeout(t) {
    for (var i=0; i<timeouts.length-1; ++i) {
      if (t < timeouts[i+1])
        return timeouts[i];
    }
    return 100;
  }

  var algorithmClasses = {
    enumerate: /Enumerate/,
    symbolic: /Symbolic/,
    saturate: /Saturate/,
    counting: /Counting/
  }

  function algClass(a) {
    for (key in algorithmClasses)
      if (a.match(algorithmClasses[key]))
        return key;
    return "?";
  }

  function algName(a) {
    var split = a.split("+");
    var name = split[0];
    return split[0] + (split[1] ? "+R" : "");
  }

  var x = d3.scale.log()
      .range([0, width]);

  var y = d3.scale.linear()
      .range([height, 0]);

  var xAxis = d3.svg.axis()
      .scale(x)
      .orient("bottom")
      .ticks(0,"g");

  var yAxis = d3.svg.axis()
      .scale(y)
      .orient("left")
      .tickValues(timeouts);

  var svg = d3.select("body").append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
    .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  var legend = svg.append("g")
      .attr("transform", "translate(" + (width/4) + ", 30)");

  legend.append("rect")
      .attr("class", "legend")
      .attr("x", -75)
      .attr("y", -15)
      .attr("width", 450)
      .attr("height", 30)
      .attr("fill", "white")
      .attr("stroke", "black");

  var keys = legend.selectAll("g")
      .data([
        {algorithm: "Enumerate"},
        {algorithm: "Symbolic"}, {algorithm: "Symbolic+R"},
        {algorithm: "Saturate"}, {algorithm: "Saturate+R"}])
    .enter().append("g")
      .attr("transform", function(d,i) { return "translate(" + (i * 90) + "," + (0) + ")"})

  keys.append("path")
      .attr("class", function(d) { return "point " + algClass(d.algorithm); })
      .classed("removal", function(d) { return d.algorithm.match(/\+R/); })
      .attr("d", d3.svg.symbol().type(function (d) { return data_shape(d) }).size(150));

  keys.append("text")
      .style("text-anchor", "end")
      .attr("dx", -15)
      .attr("dy", ".31em")
      .text(function(d) { return algName(d.algorithm); });

  function data_shape(d) {
    a = d.algorithm
    shape =  a.match(/Enumerate/) ? "diamond" :
      a.match(/Symbolic/) ? "square" :
      a.match(/Counting/) ? "circle" :
      a.match(/Saturate/) ? "cross" :
      "triangle-down";
    if (shape == "triangle-down")
      console.log("Unexpected algorithm: " + a);
    return shape;
  }

  function data_size(h) {
    return 150;
  }

  function type(d) {
    d.steps = +d.steps.replace(/\*/g,'')
    d.time = +d.time.replace(/\*|s/g,'')
    d.violation = d.violation == "true"
    return d;
  }

  var line = d3.svg.line()
      .x(function(d) { return x(d.values); })
      .y(function(d) { return y(d.key); })
      .interpolate("linear");

  d3.tsv(datafile, type, function(error, data) {
    data = data.filter(function(d) { return d.algorithm != "?" })

    var averages = d3.nest()
        .key(function(d) { return d.algorithm; })
        .key(function(d) { return nearestTimeout(d.time); })
        .rollup(function(d) { return d3.mean(d, function(g) { return +g.steps; })})
        .entries(data);

    x.domain([10,d3.max(data, function(d) { return d.steps })]);
    y.domain([-0.3,d3.max(data, function(d) { return d.time })]);

    timeouts.forEach(function(t) {
      svg.append("line")
        .attr("class", "gridline")
        .attr("x1", x(10))
        .attr("x2", x(10000))
        .attr("y1", y(t))
        .attr("y2", y(t));
    });

    averages.forEach(function(d) {
      svg.append("path")
          .attr("class", "outline " + algClass(d.key))
          .attr("d", line(d.values));
      svg.append("path")
          .attr("class", "line " + algClass(d.key))
          .classed("removal", function(_) { return d.key.match(/\+R/) })
          .attr("d", line(d.values));
    });

    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis)
      .append("text")
        .attr("x", width)
        .attr("y", -6)
        // .attr("dy", "-.31em")
        .attr("text-anchor", "end")
        .text("Steps");

    svg.append("g")
        .attr("class", "y axis")
        .call(yAxis)
      .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 6)
        .attr("dy", ".71em")
        .style("text-anchor", "end")
        .text("Seconds");

    svg.selectAll(".point")
        .data(data)
      .enter().append("path")
        .attr("class", function(d) { return "point " + algClass(d.algorithm); })
        .classed("violation", function(d) { return d.violation; })
        .classed("removal", function(d) { return d.algorithm.match(/\+R/); })
        .attr("transform", function(d) { return "translate(" + x(d.steps) + "," + y(d.time) + ")"; })
        .attr("d", d3.svg.symbol().type(function(d) { return data_shape(d) }).size(function(d) { return data_size(d); }))
      
  });

}
