"use strict"
//
//  virusCharting.js
//
//  This file provides the interface between Chart.js and the webpage
//
//------------------------------------------------------------------------------
//  Revision History
//  ================
//  22 Mar 2020 MDS  Original
//  21 Dec 2020 MDS Modified to use the revised weekly reporting protocol from 
//                  the European Centre for Disease Prevention and Control
//                  
//                  TODO: Modify SEIR model to report on weekly results rather 
//                         than daily
//
//------------------------------------------------------------------------------

var m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function rgbToHex(r, g, b) {
  return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

//
// ----------------------------------------------------------------------------
// Returns the desired max of the y axis grids based upon the passed maximum
// Assumes 8 ticks on the graph so we can get nice automatic division
function getYMax(max, min) {
  if (min == undefined) 
    min = 0;
  let tickCount = 8;
  let range = max - min;
  let unroundedTickSize = range/(tickCount-1);
  let x = Math.ceil(Math.log10(unroundedTickSize) + 1);
  let pow10x = Math.pow(10, x);
  let t = Math.ceil(unroundedTickSize / pow10x) * pow10x;
  // Divide by 2 and divide by 4 for 8 ticks will still give a nice result
  if (max < (t/2)) t = t/2;
  if (max < (t/2)) t = t/2;
  return t;
}

var lineCol = ['rgb(57,106,177)', 'rgb(218,124,48)', 'rgb(62,150,81)', 
  'rgb(204,37,41)', 'rgb(83,81,84)', 'rgb(107,76,154)', 'rgb(146,36,40)',
  'rgb(148,139,61)'];

// Restricts input for the given textbox to the given inputFilter.
function setInputFilter(textbox, inputFilter) {
  ["input", "keydown", "keyup", "mousedown", "mouseup", "select", "contextmenu", "drop"].forEach(function(event) {
    textbox.addEventListener(event, function() {
      if (inputFilter(this.value)) {
        this.oldValue = this.value;
        this.oldSelectionStart = this.selectionStart;
        this.oldSelectionEnd = this.selectionEnd;
      } else if (this.hasOwnProperty("oldValue")) {
        this.value = this.oldValue;
        this.setSelectionRange(this.oldSelectionStart, this.oldSelectionEnd);
      } else {
        this.value = "";
      }
    });
  });
}

var EUChartObj = {
//
// ----------------------------------------------------------------------------
// Add the event listeners, populate the dropdown boxes
countryData: [],
lineChartData: {},
daysShown : -1,
load:function(){
  // Populate Country dropdown
  let countryList = document.getElementById('countryList');
  let lastCountry = '';
  for (let key in csvData) {
    // skip loop if the property is from prototype
    if (!csvData.hasOwnProperty(key)) continue;

    let obj = csvData[key];
    for (let prop in obj) {
      // skip loop if the property is from prototype
      if (!obj.hasOwnProperty(prop)) continue;

      if ((prop.search(/Territories/i) > 0) && (obj[prop] != lastCountry)) {
        let countryOpt = document.createElement('option');
        countryOpt.value = obj[prop];
        countryOpt.text = obj[prop];
        countryList.appendChild(countryOpt);
        lastCountry = obj[prop];
      }
    }
  }

  document.getElementById('compactLink1').addEventListener('click', function() {
      Array.from(document.getElementsByClassName("compact")).forEach(
          function(el, ind, array) {
            el.style.display = "none";
          }
        );

      let h = window.innerHeight/2 - 100 + "px"

      document.getElementById("EUChartDiv").style.height =  h;
      document.getElementById("EUChartCanvas").style.height = h;

      document.getElementById("modelChartDiv").style.height = h;
      document.getElementById("modelChartCanvas").style.height = h;
    });

  document.getElementById('chkShowCumData').addEventListener('click', function() {
      EUChartObj.daysShown = -1
      EUChartObj.reloadChartData();
    });
  document.getElementById('chkNormaliseTimeline').addEventListener('click', function() {
      if (this.checked == false) {
        alert('Mike says:\nInfection display by absolute date has not yet been implemented, so this box can\'t be unchecked !');
        this.checked = true;
      } else {
        EUChartObj.daysShown = -1
        EUChartObj.reloadChartData();
      }
    });
  document.getElementById('chkNormaliseCaseData').addEventListener('click', function() {
      EUChartObj.daysShown = -1
      EUChartObj.reloadChartData();
    });
  document.getElementById('chkShowCaseData').addEventListener('click', function() {
      EUChartObj.daysShown = -1
      EUChartObj.reloadChartData();
    });
  document.getElementById('chkShowMortalityData').addEventListener('click', function() {
      EUChartObj.daysShown = -1
      EUChartObj.reloadChartData();
    });
  document.getElementById('EUChartZoomIn').addEventListener("click", function() {
      if (EUChartObj.daysShown > 20) {
        EUChartObj.daysShown = parseInt(EUChartObj.daysShown/2);
      } else {
        EUChartObj.daysShown = 10;
      }
      EUChartObj.reloadChartData();
    });
  document.getElementById('EUChartZoomOut').addEventListener("click", function() {
      if (EUChartObj.daysShown < 500) {
        EUChartObj.daysShown = parseInt(EUChartObj.daysShown * 2);
      } else {
        EUChartObj.daysShown = 1000;
      }
      EUChartObj.reloadChartData();
    });
  document.getElementById('EUChartZoomReset').addEventListener("click", function() {
      EUChartObj.daysShown = -1;
      EUChartObj.reloadChartData();
    });

  var ctx = document.getElementById('EUChartCanvas').getContext('2d');
  window.EUChart = Chart.Line(ctx, {
    data: EUChartObj.lineChartData,
    options: {
      responsive: true,
      animation: {
        duration: 0,
      },
      tooltips: {
        position: 'nearest',
        mode: 'index',
        intersect: false,
        callbacks: {
          title: function(tooltipItem, data) {
            return 'Week ' + tooltipItem[0].xLabel;
          }
        }
      },
      hoverMode: 'index',
      stacked: false,
      legend: {
        position: 'bottom'
      },
      layout: {
        padding: {
          top: 10,
          bottom: 10,
          left: 30,
          right: 30
        }
      },
      title: {
        display: false,
        text: 'Infection vs Time by Country'
      },
      scales: {
        xAxes:[{
          scaleLabel: {
            display: true,
          }
        }],
        yAxes: [{
          type: 'linear', // only linear but allow scale type registration. This allows extensions to exist solely for log scale for instance
          display: true,
          position: 'left',
          scaleLabel: {
            display: true,
          },
        }, {
          type: 'linear', // only linear but allow scale type registration. This allows extensions to exist solely for log scale for instance
          display: true,
          position: 'right',

          // grid line settings
          gridLines: {
            drawOnChartArea: false, // only want the grid lines for one axis to show up
          },
        }],
      }
    }
  });

  EUChartObj.addCountry('Australia');
  let d = new Date(EUChartObj.countryData[0].data[EUChartObj.countryData[0].data.length-1].dataDate);
  document.getElementById('dataNotice').innerHTML = 
    'This chart is based upon data current to ' + d.getDate() + ' ' + 
    m[d.getMonth()] + ' ' + d.getFullYear() + ' inclusive';

  EUChartObj.reloadChartData();
},
//
// ----------------------------------------------------------------------------
// Add the selected country in the dropdown box to the graph, starting at 
// day one = 100 or more cases
addCountryClick:function() {    // We need this to prevent the click event 
  EUChartObj.addCountry();      // propagation to addCountry() when we click the
},                              // 'Add Country' button
                                  
addCountry:function(c) {
  let d = {};
  d.name = '';
  d.data = [];

  // Use the dropdown selection if nothing passed as a parameter
  if (c == undefined) {
    let el = document.getElementById('countryList');
    if (el.options[el.selectedIndex].value == '') return;
    c = el.options[el.selectedIndex].text;
  }

  // Don't add same country twice
  if (EUChartObj.countryData.length > 0) {
    for (let i = 0; i< EUChartObj.countryData.length; i++) {
      if (EUChartObj.countryData[i].name == c) return;
    }
  }

  // Add the population data
  d.name = c;
  for (let key in populationData) {
    let obj = populationData[key];
    for (let prop in obj) {
      // skip loop if the property is from prototype
      if (!obj.hasOwnProperty(prop)) continue;

      if ((obj[prop] == c) && (prop.search(/country/i) >= 0)) {
        if (obj['population'] != undefined)
          d.population = parseInt(obj['population']);
      }
    }
  }

  // Add the COVID-19 case data
  for (let key in csvData) {
    // skip loop if the property is from prototype
    if (!csvData.hasOwnProperty(key)) continue;

    let obj = csvData[key];
    for (let prop in obj) {
      // skip loop if the property is from prototype
      if (!obj.hasOwnProperty(prop)) continue;

      // Search for the "Countries and Territories" property and add the data.
      // Depending upon which file type is downloaded, the property names are 
      // uppercase or lowercase
      if ((obj[prop] == c) && (prop.search(/Territories/i) >= 0)) {
        let o = {};
        // Following extraneous lines commented out 201221
        // if (typeof obj['Cases'] != undefined)
        //   o.actCases = parseInt(obj['Cases']);
        if (typeof obj['cases_weekly'] != undefined)
          o.actCases = parseInt(obj['cases_weekly']);

        if (typeof d.population !== undefined) {
          o.actCasesNormalised = o.actCases * 1000000 / d.population;
        } else {
          o.actDeathsNormalised = 0;
        }

        // Following extraneous lines commented out 201221
        // if (typeof obj['Deaths'] != undefined)
        //   o.actDeaths = parseInt(obj['Deaths_weekly']);
        if (typeof obj['deaths_weekly'] != undefined)
          o.actDeaths = parseInt(obj['deaths_weekly']);

        if (typeof d.population !== undefined) {
          o.actDeathsNormalised = o.actDeaths * 1000000 / d.population;
        } else {
          o.actDeathsNormalised = 0;
        }

        // Following extraneous lines commented out 201221
        // if (typeof obj['Month'] != undefined)
        //   o.dataDate = obj['Month'] + '/' + obj['Day'] + '/' + obj['Year'];
        // if (typeof obj['month'] != undefined)
        //   o.dataDate = obj['month'] + '/' + obj['day'] + '/' + obj['year'];
        if (typeof obj['dateRep'] === "string") {
          let d = obj['dateRep'];
          o.dataDate =  d.slice(3,4) + '/' + d.slice(0,1) + '/' + d.slice(6);
        }

        d.data.unshift(o);
      }
    }
  }

  d.data.sort(function (a,b) {
    return (Date.parse(a['dataDate']) < Date.parse(b['dataDate'])) ?
      -1 : (Date.parse(a['dataDate']) > Date.parse(b['dataDate'])) ? 1 : 0;
    });
  
  d.data[0].cumCases = d.data[0].actCases;
  d.data[0].cumCasesNormalised = d.data[0].actCasesNormalised;
  d.data[0].cumDeaths = d.data[0].actDeaths;
  d.data[0].cumDeathsNormalised = d.data[0].actDeathsNormalised;
  for (let i=1; i<d.data.length; i++) {
    d.data[i].cumCases = d.data[i-1].cumCases + d.data[i].actCases;
    d.data[i].cumCasesNormalised = 
      d.data[i-1].cumCasesNormalised + d.data[i].actCasesNormalised;
    d.data[i].cumDeaths = d.data[i-1].cumDeaths + d.data[i].actDeaths;
    d.data[i].cumDeathsNormalised = 
      d.data[i-1].cumDeathsNormalised + d.data[i].actDeathsNormalised;

    // Now that we have used the floating points for normalised figures to get
    // the cumulative figures, round them to the nearest integer for charting
    d.data[i-1].cumCasesNormalised = 
      parseInt(d.data[i-1].cumCasesNormalised + 0.5);
    d.data[i-1].actCasesNormalised = 
      parseInt(d.data[i-1].actCasesNormalised + 0.5);
    d.data[i-1].cumDeathsNormalised = 
      parseInt(d.data[i-1].cumDeathsNormalised + 0.5);
    d.data[i-1].actDeathsNormalised = 
      parseInt(d.data[i-1].actDeathsNormalised + 0.5);
  }
  d.data[d.data.length-1].cumCasesNormalised = 
    parseInt(d.data[d.data.length-1].cumCasesNormalised + 0.5);
  d.data[d.data.length-1].actCasesNormalised = 
    parseInt(d.data[d.data.length-1].actCasesNormalised + 0.5);
  d.data[d.data.length-1].cumDeathsNormalised = 
    parseInt(d.data[d.data.length-1].cumDeathsNormalised + 0.5);
  d.data[d.data.length-1].actDeathsNormalised = 
    parseInt(d.data[d.data.length-1].actDeathsNormalised + 0.5);

  EUChartObj.countryData.push(d);
  EUChartObj.daysShown = -1; // Reset zoom
  EUChartObj.reloadChartData();
},
//
// ----------------------------------------------------------------------------
// Remove the selected country in the dropdown box from the graph
removeCountryClick:function() {    // We need this to prevent the click event 
  EUChartObj.removeCountry();      // propagation to addCountry() when we click the
},                                 // 'Remove Country' button
 
removeCountry:function(c){
  if (EUChartObj.countryData.length < 1) // Nothing to remove
    return;

  if (EUChartObj.countryData.length == 1) { // Only one choice to remove so do it !
    EUChartObj.countryData.splice(0,1);
    EUChartObj.reloadChartData();
    return;
  }

  if (c == undefined) {
    let el = document.getElementById('countryList');
    if (el.options[el.selectedIndex].value == '') return;
    c = el.options[el.selectedIndex].text;
  }

  let i=0;
  while ((i < EUChartObj.countryData.length) & (EUChartObj.countryData[i].name != c))
    i++;

  if (i >= EUChartObj.countryData.length) // Selected country not found on graph
    return;       

  EUChartObj.countryData.splice(i,1);
  EUChartObj.daysShown = -1; // Reset zoom
  EUChartObj.reloadChartData();
},
//
// ----------------------------------------------------------------------------
// Copy the relevant array entries from the countryData array (which holds all 
// of the data for the selected countries) to the lineChartData object (which
// is used by the charting tool to display the chart)
reloadChartData: function() {
  if (EUChartObj.countryData.length == 0) {
    return; // Nothing to plot
  }

  EUChartObj.lineChartData = {
    labels: [],
    datasets: []
  };

  // Sort by country name
  EUChartObj.countryData.sort(function (a,b) {
    return a['name'] > b['name'] ?
      -1 : a['name'] < b['name'] ? 1 : 0;
    });

  // Y axis scales always start at 0
  EUChart.options.scales.yAxes[0].ticks.min = 0;
  EUChart.options.scales.yAxes[1].ticks.min = 0;

  let caseThreshold = 100;
  if  (document.getElementById('chkNormaliseCaseData').checked == true) {
    caseThreshold = 1;
  }

  let cumData = true;
  if (document.getElementById('chkShowCumData').checked == true) {
    EUChart.options.scales.yAxes[0].scaleLabel.labelString = 'Cumulative Cases';
  } else {
    EUChart.options.scales.yAxes[0].scaleLabel.labelString = 'Actual Cases';
    cumData = false;
  }
  if (document.getElementById('chkNormaliseCaseData').checked == true) 
    EUChart.options.scales.yAxes[0].scaleLabel.labelString = 
      EUChart.options.scales.yAxes[0].scaleLabel.labelString + ' per 1,000,000 Population';

  if (document.getElementById('chkNormaliseTimeline').checked == true) {
    let totalWeeks = 0;
    let i, j, start, finish;
    // Do the labels.  Figure out how many days to display
    for (i=0; i < EUChartObj.countryData.length; i++) {
      j = 0;
      // Find the start of the data - use cumulative data threshold to filter out the anomolies
      // at the start of the infection spread even if we are viewing actual data
      if (document.getElementById('chkNormaliseCaseData').checked == true) {
        while ((j < EUChartObj.countryData[i].data.length) && 
          (EUChartObj.countryData[i].data[j].cumCasesNormalised < caseThreshold))
          j++;
      } else {
        while ((j < EUChartObj.countryData[i].data.length) && 
          (EUChartObj.countryData[i].data[j].cumCases < caseThreshold))
          j++;
      }
      start = j;

      // Now that we have found the start of the data, find the end and see 
      // if this countries period is the longest period - we look backwards 
      // from the end of the data and ignore the last caseThreshold cases
      j = EUChartObj.countryData[i].data.length -1;
      let cumSumBackwards = 0;
      if (document.getElementById('chkNormaliseCaseData').checked == true) {
        if (document.getElementById('chkShowCaseData').checked == true) {
          while ((j > start) && 
            (cumSumBackwards <= caseThreshold)) {
            j--;
            cumSumBackwards += EUChartObj.countryData[i].data[j].actCasesNormalised;
          }
        } else {
          while ((j > start) && 
            (cumSumBackwards <= caseThreshold)) {
            j--;
            cumSumBackwards += EUChartObj.countryData[i].data[j].actDeathsNormalised;
          }
          if ((j == start) && (EUChartObj.countryData[i].data[EUChartObj.countryData[i].data.length-1].cumDeathsNormalised >= caseThreshold))
             j = EUChartObj.countryData[i].data.length - 1;
        }
      } else {
        if (document.getElementById('chkShowCaseData').checked == true) {
          while ((j > start) && 
            (cumSumBackwards <= caseThreshold)) {
            j--;
            cumSumBackwards += EUChartObj.countryData[i].data[j].actCases;
          }
        } else {
          while ((j > start) && 
            (cumSumBackwards <= caseThreshold)) {
            j--;
            cumSumBackwards += EUChartObj.countryData[i].data[j].actDeaths;
          }
        }
      }
      finish = j;
      if ((finish - start + 1) > totalWeeks)
        totalWeeks = finish - start + 1;
      if (totalWeeks < 10)
        totalWeeks = 10;
    }

    // This does the zoom
    if (EUChartObj.daysShown == -1) {
      EUChartObj.daysShown = totalWeeks;
    } else {
      totalWeeks = EUChartObj.daysShown;
    }

    for (i = 0; i <= totalWeeks; i++)
      EUChartObj.lineChartData.labels.push(i);

    if  (document.getElementById('chkNormaliseCaseData').checked == true) {
      EUChart.options.scales.xAxes[0].scaleLabel.labelString = 'Weeks Since One Reported Case per 1,000,000 Population';
    } else {
      if (document.getElementById('chkShowCumData').checked == true) {
        EUChart.options.scales.xAxes[0].scaleLabel.labelString = 'Weeks Since 100 Reported Cases';
      } else {
        EUChart.options.scales.xAxes[0].scaleLabel.labelString = 'Weeks Since First Reported Case';
      }
    }

    // Add the data
    let mortalityInd = 1;
    let displayMortality = true;
    let displayCases = true;
    if  (document.getElementById('chkShowCaseData').checked != true) {
      mortalityInd = 0;
      displayCases = false;
    }
    if  (document.getElementById('chkShowMortalityData').checked != true) 
      displayMortality = false;

    let max = 0;
    for (i=0; i < EUChartObj.countryData.length; i++) {
      if (displayCases == true)
        EUChartObj.lineChartData.datasets.unshift({});
      if (displayMortality == true)
        EUChartObj.lineChartData.datasets.unshift({});

      // Cases legend and formatting of the line
      if (displayCases == true) {
        EUChartObj.lineChartData.datasets[0].label = EUChartObj.countryData[i].name + ' Cases';
        EUChartObj.lineChartData.datasets[0].backgroundColor = lineCol[i % 8];
        EUChartObj.lineChartData.datasets[0].borderColor = lineCol[i % 8];
        EUChartObj.lineChartData.datasets[0].borderWidth = 1;
        EUChartObj.lineChartData.datasets[0].pointRadius = 0;
        EUChartObj.lineChartData.datasets[0].fill = false;
        EUChartObj.lineChartData.datasets[0].data = [];
      }

      // Deaths legend and formatting of the line
      if (displayMortality == true) {
        EUChartObj.lineChartData.datasets[mortalityInd].label = EUChartObj.countryData[i].name + ' Deaths';
        EUChartObj.lineChartData.datasets[mortalityInd].backgroundColor = lineCol[i % 8];
        EUChartObj.lineChartData.datasets[mortalityInd].borderColor = lineCol[i % 8];
        EUChartObj.lineChartData.datasets[mortalityInd].borderWidth = 1;
        if (mortalityInd == 1) 
          EUChartObj.lineChartData.datasets[mortalityInd].borderDash = [5,15];
        EUChartObj.lineChartData.datasets[mortalityInd].pointRadius = 0;
        EUChartObj.lineChartData.datasets[mortalityInd].fill = false;
        EUChartObj.lineChartData.datasets[mortalityInd].data = [];
      }

      // Find the start of the data - use cumulative data threshold to filter out the anomolies
      // at the start of the infection spread even if we are viewing actual data
      j = 0;
      if (document.getElementById('chkNormaliseCaseData').checked == true) {
        if (document.getElementById('chkShowCaseData').checked == true) {
          while ((j < EUChartObj.countryData[i].data.length) && 
            (EUChartObj.countryData[i].data[j].cumCasesNormalised < caseThreshold))
            j++;
        } else {
          while ((j < EUChartObj.countryData[i].data.length) && 
            (EUChartObj.countryData[i].data[j].cumDeathsNormalised < caseThreshold))
            j++;
        }
      } else {
        if (document.getElementById('chkShowCaseData').checked == true) {
          while ((j < EUChartObj.countryData[i].data.length) && 
            (EUChartObj.countryData[i].data[j].cumCases < caseThreshold))
            j++;
        } else {
          while ((j < EUChartObj.countryData[i].data.length) && 
            (EUChartObj.countryData[i].data[j].cumDeaths < caseThreshold))
            j++;
        }
      }

      // Add totalWeeks data points to the line
      let dayCount = 0;
      while ((j < EUChartObj.countryData[i].data.length) && (dayCount <= totalWeeks)) {
        if (cumData == true) {
          if (displayCases == true) {
            if (document.getElementById('chkNormaliseCaseData').checked == true) {
              EUChartObj.lineChartData.datasets[0].data.push(EUChartObj.countryData[i].data[j].cumCasesNormalised);
            } else {
              EUChartObj.lineChartData.datasets[0].data.push(EUChartObj.countryData[i].data[j].cumCases);
            }
          }
          if (displayMortality == true) {
            if (document.getElementById('chkNormaliseCaseData').checked == true) {
              EUChartObj.lineChartData.datasets[mortalityInd].data.push(EUChartObj.countryData[i].data[j].cumDeathsNormalised);
            } else {
              EUChartObj.lineChartData.datasets[mortalityInd].data.push(EUChartObj.countryData[i].data[j].cumDeaths);
            }
          }
          dayCount++;
          if (displayCases == true) {
            if (document.getElementById('chkNormaliseCaseData').checked == true) {
              if (EUChartObj.countryData[i].data[j].cumCasesNormalised > max)
                max = EUChartObj.countryData[i].data[j].cumCasesNormalised;
            } else {
              if (EUChartObj.countryData[i].data[j].cumCases > max)
                max = EUChartObj.countryData[i].data[j].cumCases;
            }  
          }
          if (displayMortality == true) {
            if (document.getElementById('chkNormaliseCaseData').checked == true) {
              if (EUChartObj.countryData[i].data[j].cumDeathsNormalised > max)
                max = EUChartObj.countryData[i].data[j].cumDeathsNormalised;
            } else {
              if (EUChartObj.countryData[i].data[j].cumDeaths > max)
                max = EUChartObj.countryData[i].data[j].cumDeaths;
            }
          }
        } else {
          if (displayCases == true) {
            if (document.getElementById('chkNormaliseCaseData').checked == true) {
              EUChartObj.lineChartData.datasets[0].data.push(EUChartObj.countryData[i].data[j].actCasesNormalised);
            } else {
              EUChartObj.lineChartData.datasets[0].data.push(EUChartObj.countryData[i].data[j].actCases);
            }
          }
          if (displayMortality == true) {
            if (document.getElementById('chkNormaliseCaseData').checked == true) {
              EUChartObj.lineChartData.datasets[mortalityInd].data.push(EUChartObj.countryData[i].data[j].actDeathsNormalised);
            } else {
              EUChartObj.lineChartData.datasets[mortalityInd].data.push(EUChartObj.countryData[i].data[j].actDeaths);
            }
          }
          dayCount++;
          if (displayCases == true) {
            if (document.getElementById('chkNormaliseCaseData').checked == true) {
              if (EUChartObj.countryData[i].data[j].actCasesNormalised > max)
                max = EUChartObj.countryData[i].data[j].actCasesNormalised;
            } else {
              if (EUChartObj.countryData[i].data[j].actCases > max)
                max = EUChartObj.countryData[i].data[j].actCases;
            }
          }
          if (displayMortality == true) {
            if (document.getElementById('chkNormaliseCaseData').checked == true) {
              if (EUChartObj.countryData[i].data[j].actDeathsNormalised > max)
                max = EUChartObj.countryData[i].data[j].actDeathsNormalised;
            } else {
              if (EUChartObj.countryData[i].data[j].actDeaths > max)
                max = EUChartObj.countryData[i].data[j].actDeaths;
            }
          }
        }
        j++;
      }
      if (displayCases == true) {
        if (EUChartObj.lineChartData.datasets[0].data.length == 0)
          EUChartObj.lineChartData.datasets[0].data.push(0);
      }

      if (displayMortality == true) {
        if (EUChartObj.lineChartData.datasets[mortalityInd].data.length == 0)
          EUChartObj.lineChartData.datasets[mortalityInd].data.push(0);
      }
    }

    // Configure the y axis minimum and maximum to be pretty
    EUChart.options.scales.yAxes[0].ticks.max = getYMax(max);
    EUChart.options.scales.yAxes[1].ticks.max = EUChart.options.scales.yAxes[0].ticks.max;
    if (displayCases == true) 
      EUChartObj.lineChartData.datasets[0].yAxisID = 'y-axis-1';
    if (displayMortality == true)
      EUChartObj.lineChartData.datasets[mortalityInd].yAxisID = 'y-axis-1';

  } else {
    //
    // Not written yet
    //
  }

  window.EUChart.data = EUChartObj.lineChartData;
	window.EUChart.update();
}
} // End of EUChartObj object
EUChartObj.load();

//
// ----------------------------------------------------------------------------
// The chart for displaying the modelling results
//

var modelChartObj = {
//
// ----------------------------------------------------------------------------
// Create all of the elements, add the event listeners, populate the dropdown 
// boxes

load:function(){
  document.getElementById('compactLink2').addEventListener('click', function() {
      Array.from(document.getElementsByClassName("compact")).forEach(
          function(el, ind, array) {
            el.style.display = "none";
          }
        );
      let h = window.innerHeight/2 - 100 + "px"
      document.getElementById("EUChartDiv").style.height =  h;
      document.getElementById("EUChartCanvas").style.height = h;

      document.getElementById("modelChartDiv").style.height = h;
      document.getElementById("modelChartCanvas").style.height = h;
    });

  document.getElementById('showSEIRData').addEventListener("click", function() {
    if ((document.getElementById('showSEIRData').checked == false) &&
      (document.getElementById('showSEISData').checked == false))
        document.getElementById('showSEISData').checked = true;
    this.restartModels;
    });
  document.getElementById('showSEISData').addEventListener("click", function() {
    if ((document.getElementById('showSEIRData').checked == false) &&
      (document.getElementById('showSEISData').checked == false))
        document.getElementById('showSEIRData').checked = true;
    this.restartModels;
    });

  document.getElementById("modelRestartImg").addEventListener("click", 
    this.restartModels);

//  document.getElementById("curveFit").addEventListener("select", addActivityItem, false); 

  document.getElementById("curveFit").addEventListener("change", function() {
      switch(document.getElementById("curveFit").value) {
        case "": // The prompt, so do nothing
          break;
        case "Australia":
          document.getElementById("chkShowCumData").checked = false;
          document.getElementById("chkNormaliseCaseData").checked = true;
          EUChartObj.daysShown = -1
          EUChartObj.reloadChartData();
          document.getElementById("modelZoomIn").checked = true;
          document.getElementById("inpRo").value = 0.8;
          document.getElementById("inpMortality").value = 0.9;
          document.getElementById("inpAsymptomatic").value = 2.0;
          document.getElementById("inpTe").value = 3;
          document.getElementById("inpTi").value = 5;
          document.getElementById("inpTr").value = 32;
          document.getElementById("inpStartInf").value = 0;
          document.getElementById("chkRndInfStartDay").checked = true;
          document.getElementById("inpRndInfStartDay").value = 32;
          document.getElementById("inpRndInfEndDay").value = 46;
          document.getElementById("chkInfNewBatch").checked = true;
          document.getElementById("inpInfNewBatchNum").value = 8;
          document.getElementById("inpInfNewBatchDay").value = 44;
          document.getElementById("chkRo1").checked = true;
          document.getElementById("inpRo1Num").value = 0.01;
          document.getElementById("inpRo1Day").value = 51;
          document.getElementById("chkRo3").checked = false;
          document.getElementById("chkRo2").checked = false;
          document.getElementById("chkStartPropDay").checked = true;
          document.getElementById("inpStartPropDay").value = 24;
          break;
        case "New Zealand":  // No curve fit for NZ yet
          document.getElementById("chkShowCumData").checked = false;
          document.getElementById("chkNormaliseCaseData").checked = true;
          EUChartObj.daysShown = -1
          EUChartObj.reloadChartData();
          document.getElementById("modelZoomIn").checked = true;
          alert("Curve fit has not been implemented for New Zealand yet");
          break;
        case "United Kingdom": // Falls through to US because the parameters are the same
        case "United States":
          document.getElementById("chkShowCumData").checked = false;
          document.getElementById("chkNormaliseCaseData").checked = true;
          EUChartObj.daysShown = -1
          EUChartObj.reloadChartData();
          document.getElementById("modelZoomIn").checked = true;
          document.getElementById("inpRo").value = 2.2;
          document.getElementById("inpMortality").value = 0.9;
          document.getElementById("inpAsymptomatic").value = 2.0;
          document.getElementById("inpTe").value = 3;
          document.getElementById("inpTi").value = 5;
          document.getElementById("inpTr").value = 32;
          document.getElementById("inpStartInf").value = 1;
          document.getElementById("chkRndInfStartDay").checked = true;
          document.getElementById("inpRndInfStartDay").value = 4;
          document.getElementById("inpRndInfEndDay").value = 30;
          document.getElementById("chkInfNewBatch").checked = false;
          document.getElementById("chkRo1").checked = true;
          document.getElementById("inpRo1Num").value = 0.05;
          document.getElementById("inpRo1Day").value = 32;
          document.getElementById("chkRo3").checked = false;
          document.getElementById("chkRo2").checked = false;
          document.getElementById("chkStartPropDay").checked = true;
          document.getElementById("inpStartPropDay").value = 4;
          break;
      } // switch(document.getElementById("curveFit").value)
    }); 


  document.getElementById('inpRndInfStartDay').addEventListener("click", function(){
      document.getElementById('chkRndInfStartDay').checked = true;
    });
  document.getElementById('inpRndInfEndDay').addEventListener("click", function(){
      document.getElementById('chkRndInfStartDay').checked = true;
    });
  document.getElementById('inpInfNewBatchNum').addEventListener("click", function(){
      document.getElementById('chkInfNewBatch').checked = true;
    });
  document.getElementById('inpInfNewBatchDay').addEventListener("click", function(){
      document.getElementById('chkInfNewBatch').checked = true;
    });
  document.getElementById('inpRo1Num').addEventListener("click", function(){
      document.getElementById('chkRo1').checked = true;
    });
  document.getElementById('inpRo1Day').addEventListener("click", function(){
      document.getElementById('chkRo1').checked = true;
    });
  document.getElementById('chkRo2').addEventListener("click", function(){
      if (document.getElementById('chkRo1').checked != true)
        document.getElementById('chkRo2').checked = false;
    });
  document.getElementById('inpRo2Num').addEventListener("click", function(){
      if (document.getElementById('chkRo1').checked == true)
        document.getElementById('chkRo2').checked = true;
    });
  document.getElementById('inpRo2Day').addEventListener("click", function(){
      if (document.getElementById('chkRo1').checked == true)
        document.getElementById('chkRo2').checked = true;
    });
  document.getElementById('chkRo3').addEventListener("click", function(){
      if (document.getElementById('chkRo2').checked != true)
        document.getElementById('chkRo3').checked = false;
    });
  document.getElementById('inpRo3Num').addEventListener("click", function(){
      if (document.getElementById('chkRo2').checked == true)
        document.getElementById('chkRo3').checked = true;
    });
  document.getElementById('inpRo3Day').addEventListener("click", function(){
      if (document.getElementById('chkRo2').checked == true)
        document.getElementById('chkRo3').checked = true;
    });
  document.getElementById('inpStartPropDay').addEventListener("click", function(){
      document.getElementById('chkStartPropDay').checked = true;
    });
  document.getElementById('inpModelEndDay').addEventListener("click", function(){
      document.getElementById('chkModelEndDay').checked = true;
    });

  // Set input filters on model parameters
  setInputFilter(document.getElementById('inpRo'), function(value) {
    return /^-?\d*[.,]?\d{0,2}$/.test(value) && (value === "" || (parseInt(value) * 10) <= 100); });
  setInputFilter(document.getElementById('inpMortality'), function(value) {
    return /^-?\d*[.,]?\d{0,2}$/.test(value) && (value === "" || (parseInt(value) * 10) <= 100); });
  setInputFilter(document.getElementById('inpAsymptomatic'), function(value) {
    return /^-?\d*[.,]?\d{0,2}$/.test(value) && (value === "" || (parseInt(value) * 10) <= 100); });
  setInputFilter(document.getElementById('inpTe'), function(value) {
    return /^\d*$/.test(value) && (value === "" || parseInt(value) > 0); });
  setInputFilter(document.getElementById('inpTi'), function(value) {
    return /^\d*$/.test(value) && (value === "" || parseInt(value) > 0); });
  setInputFilter(document.getElementById('inpTr'), function(value) {
    return /^\d*$/.test(value) && (value === "" || parseInt(value) > 0); });

  // Set input filters on 'furfy' parameters
  setInputFilter(document.getElementById('inpStartInf'), function(value) {
    return /^\d*$/.test(value) && (value === "" || parseInt(value) >= 0); });
  setInputFilter(document.getElementById('inpRndInfStartDay'), function(value) {
    return /^\d*$/.test(value) && (value === "" || parseInt(value) > 0); });
  setInputFilter(document.getElementById('inpRndInfEndDay'), function(value) {
    return /^\d*$/.test(value) && (value === "" || parseInt(value) > 0); });
  setInputFilter(document.getElementById('inpInfNewBatchNum'), function(value) {
    return /^\d*$/.test(value) && (value === "" || parseInt(value) > 0); });
  setInputFilter(document.getElementById('inpInfNewBatchDay'), function(value) {
    return /^\d*$/.test(value) && (value === "" || parseInt(value) > 0); });
  setInputFilter(document.getElementById('inpRo1Num'), function(value) {
    return /^-?\d*[.,]?\d{0,2}$/.test(value) && (value === "" || (parseInt(value) * 10) <= 100); });
  setInputFilter(document.getElementById('inpRo1Day'), function(value) {
    return /^\d*$/.test(value) && (value === "" || parseInt(value) > 0); });
  setInputFilter(document.getElementById('inpRo2Num'), function(value) {
    return /^-?\d*[.,]?\d{0,2}$/.test(value) && (value === "" || (parseInt(value) * 10) <= 100); });
  setInputFilter(document.getElementById('inpRo2Day'), function(value) {
    return /^\d*$/.test(value) && (value === "" || parseInt(value) > 0); });
  setInputFilter(document.getElementById('inpRo3Num'), function(value) {
    return /^-?\d*[.,]?\d{0,2}$/.test(value) && (value === "" || (parseInt(value) * 10) <= 100); });
  setInputFilter(document.getElementById('inpRo3Day'), function(value) {
    return /^\d*$/.test(value) && (value === "" || parseInt(value) > 0); });
  setInputFilter(document.getElementById('inpStartPropDay'), function(value) {
    return /^\d*$/.test(value) && (value === "" || parseInt(value) > 0); });
  setInputFilter(document.getElementById('inpModelEndDay'), function(value) {
    return /^\d*$/.test(value) && (value === "" || parseInt(value) > 0); });

  var ctx = document.getElementById('modelChartCanvas').getContext('2d');
  window.modelChart = Chart.Line(ctx, {
    data: modelChartObj.lineChartData,
    options: {
      responsive: true,
      animation: {
        duration: 0,
      },
      tooltips: {
        position: 'nearest',
        mode: 'index',
        intersect: false,
      },
      hoverMode: 'index',
      stacked: false,
      legend: {
        position: 'bottom'
      },
      layout: {
        padding: {
          top: 30,
          bottom: 10,
          left: 30,
          right: 30
        }
      },
      title: {
        display: false,
        text: 'Infection vs Time COVID-19 Models'
      },
      scales: {
        xAxes:[{
          display: false,
          scaleLabel: {
            display: false,
          }
        }],
        yAxes: [{
          type: 'linear', // only linear but allow scale type registration. This allows extensions to exist solely for log scale for instance
          display: true,
          position: 'left',
          scaleLabel: {
            display: true,
          },
        }, {
          type: 'linear', // only linear but allow scale type registration. This allows extensions to exist solely for log scale for instance
          display: true,
          position: 'right',

          // grid line settings
          gridLines: {
            drawOnChartArea: false, // only want the grid lines for one axis to show up
          },
        }],
      }
    }
  });
  this.restartModels();
},
//
// ----------------------------------------------------------------------------
//
restartModels: function() {
  modelChartObj.lineChartData = {
    labels: [],
    datasets: []
  };

  // Set up the axis displays
  modelChart.options.scales.xAxes[0].scaleLabel.labelString = 'Day';
  modelChart.options.scales.yAxes[0].scaleLabel.labelString = 'Number per 1,000,000 Population';

  modelChartObj.showSEIRData = (document.getElementById('showSEIRData').checked == true);
  modelChartObj.showSEISData = (document.getElementById('showSEISData').checked == true);

  let SEISDataStart = 0;
  let myLabels = ['Susceptible', 'Infected', 'Dead', 'Recovered'];
  if (modelChartObj.showSEIRData == true) {
    for (let i=0; i<4; i++)
      modelChartObj.lineChartData.datasets.unshift({});
    for (let i=0; i<4; i++) {
      modelChartObj.lineChartData.datasets[i].label = 'SEIR ' + myLabels[i];
      modelChartObj.lineChartData.datasets[i].backgroundColor = lineCol[i];
      modelChartObj.lineChartData.datasets[i].borderColor = lineCol[i];
      modelChartObj.lineChartData.datasets[i].borderWidth = 2;
      modelChartObj.lineChartData.datasets[i].pointRadius = 0;
      modelChartObj.lineChartData.datasets[i].fill = false;
      modelChartObj.lineChartData.datasets[i].data = [];
    };

    SEISDataStart = 4;
  }

  if (modelChartObj.showSEISData == true) {
    for (let i=0; i<4; i++)
      modelChartObj.lineChartData.datasets.unshift({});
    for (let i=0; i<4; i++) {
      modelChartObj.lineChartData.datasets[SEISDataStart+i].label = 'SEIS ' + myLabels[i];
      modelChartObj.lineChartData.datasets[SEISDataStart+i].backgroundColor = lineCol[i];
      modelChartObj.lineChartData.datasets[SEISDataStart+i].borderColor = lineCol[i+4];
      modelChartObj.lineChartData.datasets[SEISDataStart+i].borderWidth = 2;
      modelChartObj.lineChartData.datasets[SEISDataStart+i].pointRadius = 0;
      modelChartObj.lineChartData.datasets[SEISDataStart+i].fill = false;
      modelChartObj.lineChartData.datasets[SEISDataStart+i].data = [];
      modelChartObj.lineChartData.datasets[SEISDataStart+i].data.push(750000);
    }
  }

  modelChartObj.lineChartData.datasets[0].yAxisID = 'y-axis-0';
  modelChartObj.lineChartData.datasets[1].yAxisID = 'y-axis-1';
  if (document.getElementById("modelZoomIn").checked == true) {
    modelChart.options.scales.yAxes[0].ticks.max = EUChart.options.scales.yAxes[0].ticks.max;
  } else {
    modelChart.options.scales.yAxes[0].ticks.max = 1000000;
  }
  modelChart.options.scales.yAxes[1].ticks.max = modelChart.options.scales.yAxes[0].ticks.max;
  window.modelChart.config.data = modelChartObj.lineChartData;
  window.modelChart.update();
  document.getElementById('modelStatus').innerHTML = 'Reinitialising populations... please wait about 5 seconds';

  virusModelInterface.restartModels(); // Restarts  the web worker
},
//
// ----------------------------------------------------------------------------
//
updateChart: function(d) {
  // Update the charts
  let SEISDataStart = 0;
  let showFlag = false;
  if ((modelChartObj.showSEIRData == true) && virusModelInterface.SEIRisRunning()) {
    SEISDataStart = 4;
    modelChartObj.lineChartData.datasets[0].data.push(d.SEIRModel.numSusceptible * 1000000/POPULATION_SIZE);
    modelChartObj.lineChartData.datasets[1].data.push(d.SEIRModel.numInfected * 1000000/POPULATION_SIZE);
    modelChartObj.lineChartData.datasets[2].data.push(d.SEIRModel.numDead * 1000000/POPULATION_SIZE);
    modelChartObj.lineChartData.datasets[3].data.push(d.SEIRModel.numRecovered * 1000000/POPULATION_SIZE);
    showFlag = true;
  }

  if ((modelChartObj.showSEISData == true) && virusModelInterface.SEISisRunning()) {
    modelChartObj.lineChartData.datasets[SEISDataStart].data.push(d.SEISModel.numSusceptible * 1000000/POPULATION_SIZE);
    modelChartObj.lineChartData.datasets[SEISDataStart+1].data.push(d.SEISModel.numInfected * 1000000/POPULATION_SIZE);
    modelChartObj.lineChartData.datasets[SEISDataStart+2].data.push(d.SEISModel.numDead * 1000000/POPULATION_SIZE);
    modelChartObj.lineChartData.datasets[SEISDataStart+3].data.push(d.SEISModel.numRecovered * 1000000/POPULATION_SIZE);
    showFlag = true;
  }
  if (showFlag == true) {
    modelChartObj.lineChartData.labels.push('Day ' + d.SEIRModel.daysIn);
    window.modelChart.data = modelChartObj.lineChartData;
    window.modelChart.update()
  }
}







} // End of modelChartObj object
modelChartObj.load();

codeInfo.registerFile(5);
document.getElementById('codeInfoBlock').innerHTML = codeInfo.getInfo();
//
// ----------------------------------------------------------------------------
//                               End of file
// ----------------------------------------------------------------------------
//


