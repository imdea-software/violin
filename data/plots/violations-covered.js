violations_covered_plot = function(datafile, width, height, margin) {

  var objectNames = {
    bkq: "Bounded-Size k-FIFO",
    dq: "Distributed Queue",
    rdq: "Random-Dequeue Queue",
    ukq: "Unbounded-Size k-FIFO"
  };

  var algorithmOrder = [
    /Enum/, /Symbolic$/, /Sym/, /Saturate$/, /Sat/,
    /Count.*4.$/, /Count.*4/, /Count.*2.$/, /Count.*2/, /Count.*0.$/, /Count.*0/,
  ];

  var algorithmAbbrs = [
    {pattern: /Enum.*/, abbr: "E"},
    {pattern: /Sym.*/, abbr: "SYM"},
    {pattern: /Sat.*/, abbr: "SAT"},
    {pattern: /Count.*\((\d+)\)/, abbr: "C($1)"}
  ];

  function objectName(obj) {
    for (key in objectNames)
      if (obj.match("-" + key))
        return objectNames[key];
    return "?";
  }

  function algOrder(a,b) {
    var result = 0;
    for (var i=0; i<algorithmOrder.length; ++i) {
      if (a.match(algorithmOrder[i])) return -1;
      if (b.match(algorithmOrder[i])) return 1;
    }
    return 0;
  }

  function algAbbr(a) {
    for (var i=0; i<algorithmAbbrs.length; ++i) {
      var abbr = algorithmAbbrs[i];
      var repl = a.replace(abbr.pattern, abbr.abbr);
      if (repl != a)
        return repl;
    }
    return "?";
  }

  var x1 = d3.scale.ordinal()
      .rangeRoundBands([0, width], .1);

  var y = d3.scale.linear()
      .range([height, margin.top]);

  var xAxis = d3.svg.axis()
      .scale(x1)
      .orient("bottom")

  var yAxis = d3.svg.axis()
      .scale(y)
      .orient("left");

  var svg = d3.select("body").append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
    .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  function type(d) {
    d.steps = +d.steps.replace(/\*/g,'')
    d.time = +d.time.replace(/\*|s/g,'')
    d.violation = d.violation == "true"
    return d;
  }

  d3.tsv(datafile, type, function(error, data) {

    var nested = d3.nest()
        .key(function(d) { return d.history.split(".")[0]; })
        .key(function(d) { return d.algorithm.split("+")[0]; })
        .sortKeys(algOrder)
        .key(function(d) { return d.algorithm.split("+")[1] || ""; })
        .rollup(function(ds) { return ds.filter(function(d) { return d.violation; }).length; })
        .entries(data.filter(function(d) { return d.history.split(".")[0] != "?" && d.violation; }));

    x1.domain(nested.map(function(d) { return objectName(d.key); }));
    y.domain([0,d3.max(nested, function(d) { return d3.max(d.values, function(d) { return d3.max(d.values, function(d) { return d.values; }); }); })]);

    var x2 = d3.scale.ordinal()
        .rangeRoundBands([0, x1.rangeBand()], .1)
        .domain(nested[0].values.map(function(d) { return d.key }));

    var x3 = d3.scale.ordinal()
        .rangeRoundBands([0, x2.rangeBand()], .1)
        .domain(["","R"]);

    var objects = svg.selectAll(".object")
        .data(nested)
      .enter().append("g")
        .attr("class", function(d) { return "object"; })
        .attr("transform", function(d) { return "translate(" + x1(objectName(d.key)) + ",0)"; });

    var algorithms = objects.selectAll(".algorithm")
        .data(function(d) { return d.values; })
      .enter().append("g")
        .attr("class", "algorithm")
        .attr("class", function(d) { return "algorithm"; })
        .attr("transform", function(d) { return "translate(" + x2(d.key) + ",0)"; });

    var variations = algorithms.selectAll(".variation")
        .data(function(d) { return d.values; })
      .enter().append("rect")
        .attr("class", "variation")
        .attr("class", function(d) { return "variation bar " + d.key; })
        .attr("x", function(d) { return x3(d.key); })
        .attr("y", function(d) { return y(d.values); })
        .attr("height", function(d) { return height - y(d.values); })
        .attr("width", function(d) { return x3.rangeBand(); });

    var labels = algorithms.append("text")
        .attr("text-anchor", "middle")
        .attr("y", function(d) { return y(d.values[0].values) - 13; });

    labels.append("tspan")
      .attr("x", x2.rangeBand()/2)
      .text(function(d) { return algAbbr(d.key); });

    labels.append("tspan")
      .attr("x", x2.rangeBand()/2)
      .attr("dy", "10")
      .text(function(d) { return d.values[0].values; });

    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis)

    svg.append("g")
        .attr("class", "y axis")
        .call(yAxis)
      .append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -20)
        .attr("y", 6)
        .attr("dy", ".71em")
        .style("text-anchor", "end")
        .text("Violations discovered");


    var legend = svg.append("g")
        .attr("transform", "translate(" + (width/2+30) + "," + 30 + ")");

    legend.append("rect")
        .attr("class", "legend")
        .attr("x", -69)
        .attr("y", -10)
        .attr("height", "60")
        .attr("width", "150");

    var keys = legend.append("g")
        .selectAll("g")
        .data([false, true])
      .enter().append("g")
        .attr("transform", function(d,i) { return "translate(" + (i * (x3.rangeBand()+1)) + "," + (0) + ")"})

    keys.append("rect")
        .attr("class", "variation")
        .attr("class", function(d) { return "variation bar " + (d ? "R" : ""); })
        // .attr("x", function(d) { return x3(d.key); })
        // .attr("y", function(d) { return y(d.values); })
        .attr("height", function(d) { return "40"; })
        .attr("width", function(d) { return x3.rangeBand(); });

    keys.append("text")
        .style("text-anchor", function(d) { return d ? "start" : "end";})
        .attr("x", function(d) { return d ? (2*x3.rangeBand()) : 0 })
        .attr("dx", "-5")
        .attr("y", "40")
        .attr("dy", "-.31em")
        .text(function(d) { return (d ? "w/" : "w/o") + " removal" });
  });
}
