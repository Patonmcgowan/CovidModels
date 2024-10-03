"use strict";
//
// virusModelWebWorker.js
// 
// Web worker that models the virus
//
//------------------------------------------------------------------------------
//  Revision History
//  ~~~~~~~~~~~~~~~~
//   26 Mar 2020 MDS Copied from alarmWebWorker.js in the homeAutomation app
//------------------------------------------------------------------------------

//
//------------------------------------------------------------------------------
// This code is the stuff done by the web worker.  Note that we can't load 
// jquery because it is a DOM access tool and the web worker isn't in the DOM
//
var virusModelWebWorker = function() {

  var restartHostHeartbeatTmr; // Times stuff coming back from the host
  var hostUpdateTmr = null;    // Times how often to send stuff to the host
  var hostUpdateReqd = false;  // Do we need to transmit data to the host
  var c = {}; // Model states
  var inf = {   // Infection states;
      SUSCEPTIBLE: 100,
      EXPOSED: 101,   // ... but not presenting yet
      CARRIER: 102,   // ... infected but asymptomatic until recovery
      INFECTED: 103,  // ... infected and symptomatic until recovery
      RECOVERED: 104, 
      DEAD: 105,
      VACCINATED: 106
    };
  var outObj = { 
      results : {},
      webWorkerName : 'virusModelWebWorker.js',
      SEIRModel: {}, // This only contains the relevant results, not the full model
      SEISModel: {}, // This only contains the relevant results, not the full model
    };
  var parameters = {};
  var command;

  var DEBUG_LEVEL = 0;        // Overwritten by host
  var POPULATION_SIZE = 100;  // Overwritten by host
  var ANIMATION_TIME = 100;   // Overwritten by host
  //
  //--------------------------------------------------------------------------
  //
  debug = function (s, level) {
    if (typeof level == "undefined") level = 0;
    if (level >= (DEBUG_LEVEL % 1000)) console.log(outObj.webWorkerName + ':\n' + s);
  }  
  //
  //--------------------------------------------------------------------------
  //  Return the passed number accurate to places decimal places
  dp = function(num, places) {
    let t = Math.pow(10, places);
    return parseInt(num * t)/t;
  }

  //--------------------------------------------------------------------------
  // Data and command reception by the WebWorker from the host software
  //--------------------------------------------------------------------------
  //
  onmessage = function(event) {
    try {
      var rx = JSON.parse(event.data);
      parseAndActionObject(rx);
    } catch(e) {
      debug("Webworker Error : " + e.message, 999);
    }
    restartHostHeartbeatTimer();  // This keeps the web worker alive as long as
                                  // the host page keeps the heartbeat ticking                    
    if  (typeof rx.parentName !== "undefined") {
      outObj.parentName = rx.parentName;
      debug('Message received from "' + outObj.parentName + '" host page');
    } else {
      debug('Message received from host webpage');
    }
  };  
  //--------------------------------------------------------------------------
  // restartHostHeartbeatTimer keeps the web worker alive so long as it keeps
  // receiving a message from the host
  //--------------------------------------------------------------------------
  restartHostHeartbeatTimer = function() {
    clearTimeout(restartHostHeartbeatTmr);
    if (DEBUG_LEVEL < 1000) {
      restartHostHeartbeatTmr = setTimeout(function() {
        // If no messages from the host script for some time then suicide
        console.log("\r\n" + outObj.webWorkerName + " says: Contact lost with host - I'm terminating");
        self.close();
      }, 5000);
    }
    return;
  };
  restartHostHeartbeatTimer();
  //--------------------------------------------------------------------------
  // Send object back to the host script. This function simply looks to see if 
  // there is data to be sent, and sends it accordingly
  transmitToHost = function() {
    if (Object.keys(outObj).length < 1) {
      outObj.heartbeat = true;
    }
    postMessage(JSON.stringify(outObj));
    clearTimeout(hostUpdateTmr);
    if (hostUpdateReqd == true) {
      hostUpdateReqd = false;
      // Data is an array.  If there is nothing there, it
      // means that we are sending a message to the host again prior to receiving
      // data from the hardware, so we send a heartbeat
      hostUpdateTmr = setTimeout(function() {
          transmitToHost();
        }, ANIMATION_TIME);
    } else {
      // If we aren't updating because of modelling, just send the heartbeat
      // to keep everything alive
      hostUpdateTmr = setTimeout(function() {
          transmitToHost();
        }, 1500);
    };
    return;
  };
  transmitToHost();

  //--------------------------------------------------------------------------
  // timeDateStamp()
  //
  // Copied from commonFunctions.js, (copy as at 190619)
  //
  //--------------------------------------------------------------------------
  //
  function timeDateStamp() {
    var d = new Date();
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var num = ["00", "01", "02", "03", "04", "05", "06", "07", "08", "09", 
               "10", "11", "12", "13", "14", "15", "16", "17", "18", "19",
               "20", "21", "22", "23", "24", "25", "26", "27", "28", "29",
               "30", "31", "32", "33", "34", "35", "36", "37", "38", "39",
               "40", "41", "42", "43", "44", "45", "46", "47", "48", "49",
               "50", "51", "52", "53", "54", "55", "56", "57", "58", "59"]

    return num[d.getDate()] + " " + months[d.getMonth()] + " " + d.getFullYear() + " " + num[d.getHours()] + ":" + num[d.getMinutes()];
  };
  // -------------------------------------------------------------------------
  // End of cut and paste of timeDateStamp() from commonFunctions.js
  // -------------------------------------------------------------------------

  // -------------------------------------------------------------------------
  // Get parameters from passed object (nominally the object sent down from the host)
  function getParameters(rx) {
    // --------------------------------------- Main Model Parameters ---------------------------------------
    // Infection rate - no of persons that will get infected from one infected person
    parameters.RoInit = typeof rx.parameters.Ro === "undefined" ? 3.61 : rx.parameters.Ro;
    outObj.SEIRModel.Ro = parameters.RoInit;

    // % of population that will die if infected - mortality rate
    parameters.mortality = typeof rx.parameters.mortality === "undefined" ? 0.9 : rx.parameters.mortality;

    // % of population that present as asymptomatic (these will be infectious until recovered)
    parameters.asymptomatic = typeof rx.parameters.asymptomatic === "undefined" ? 2 : rx.parameters.asymptomatic;

    // Time that those that will be infectious present as asymptomatic and not infectious (days) ie incubation period
    parameters.Te = typeof rx.parameters.Te === "undefined" ? 4 : rx.parameters.Te;

    // Time that those that are infectious are symptomatic (days)
    parameters.Ti = typeof rx.parameters.Ti === "undefined" ? 5 : rx.parameters.Ti;

    // Recovery time (days)
    parameters.Tr = typeof rx.parameters.Tr === "undefined" ? 32 : rx.parameters.Tr;

    // ------------------- 'Furfy' Parameters, which introduce real world randomness --------------------

    // startInf is the number of infections/1,000,000 population to load at day 1
    parameters.startInf = typeof rx.parameters.startInf === "undefined" ? 1 : rx.parameters.startInf;

    // Introduce random infections/1,000,000 population starting on day rndInfStartDay and ending on rndInfEndDay
    parameters.rndInfStartDay = typeof rx.parameters.rndInfStartDay === "undefined" ? -1 : rx.parameters.rndInfStartDay;
    parameters.rndInfEndDay = typeof rx.parameters.rndInfEndDay === "undefined" ? -1 : rx.parameters.rndInfEndDay;

    // Introduce infNewBatchNum infections/1,000,000 population on infNewBatchDay 
    parameters.infNewBatchNum = typeof rx.parameters.infNewBatchNum === "undefined" ? 0 : rx.parameters.infNewBatchNum;
    parameters.infNewBatchDay = typeof rx.parameters.infNewBatchDay === "undefined" ? 1 : rx.parameters.infNewBatchDay;

    // Change Ro to Ro1Num on day Ro1Day
    parameters.Ro1Num = typeof rx.parameters.Ro1Num === "undefined" ? -1 : rx.parameters.Ro1Num;
    parameters.Ro1Day = ((typeof rx.parameters.Ro1Day === "undefined") || (rx.parameters.Ro1Day < 1)) ? -1 : 
      rx.parameters.Ro1Day;

    // Change Ro to Ro1Num Ro2Day days after Ro1Day
    parameters.Ro2Num = typeof rx.parameters.Ro2Num === "undefined" ? -1 : rx.parameters.Ro2Num;
    parameters.Ro2Day = ((typeof rx.parameters.Ro2Day === "undefined") || (rx.parameters.Ro2Day < 1)) ? -1 : 
      parameters.Ro1Day + rx.parameters.Ro2Day;

    // Change Ro to Ro3Num Ro3Day days after Ro2Day (ie Day Ro1Day + Ro2Day + Ro3Day)
    parameters.Ro3Num = typeof rx.parameters.Ro3Num === "undefined" ? -1 : rx.parameters.Ro3Num;
    parameters.Ro3Day = ((typeof rx.parameters.Ro3Day === "undefined") || (rx.parameters.Ro3Day < 1)) ? -1 : 
      parameters.Ro1Day + parameters.Ro2Day + rx.parameters.Ro3Day;

    // Don't cause infection propagation until day startPropDay
    parameters.startPropDay = typeof rx.parameters.startPropDay === "undefined" ? 0 : rx.parameters.startPropDay;

    // Stop the model on day modelEndDay or stabilisation, whichever comes first
    parameters.modelEndDay = typeof rx.parameters.modelEndDay === "undefined" ? -1 : rx.parameters.modelEndDay;
  
  }

  // -------------------------------------------------------------------------
  // parse the received object from the host and call other functions as
  // required
  //   d is the event.data object received from the host
  // -------------------------------------------------------------------------
  function parseAndActionObject(rx) {
    // Accept the downloaded constants and initialise
    if ((typeof rx.modelConstants !== "undefined") && 
        ((typeof outObj.SEIRModel.status === "undefined") || (typeof outObj.SEISModel.status === "undefined"))) {
      c = rx.modelConstants;
      c.MALE = 0;
      c.FEMALE = 1;
      outObj.modelsInitialised = true;
      DEBUG_LEVEL = rx.DEBUG_LEVEL;
      POPULATION_SIZE = rx.POPULATION_SIZE;
      ANIMATION_TIME = rx.ANIMATION_TIME;
      getParameters(rx);
      initialiseSEIRModel();
      initialiseSEISModel();
      debug('*** Constants and models initialised, and models started ***', 2)
      return;
    };

    outObj.response = c.NO_COMMAND;

    if (((rx.command == c.RESTART) && (outObj.modelsInitialised == true)) ||
        ((rx.command == c.START) && (outObj.SEIRStatus == c.IDLE) && 
         (outObj.SEISStatus == c.IDLE))) {
      debug('*** Models restarted ***', 2);
      POPULATION_SIZE = rx.POPULATION_SIZE;
      getParameters(rx);
      initialiseSEIRModel();
      initialiseSEISModel();
      outObj.response = c.ACK;
      return;
    };
  };
  //
  // --------------------------------------------------------------------------
  //
  var genericPerson = {
      age : 25,
      gender: c.MALE,
      state: inf.SUSCEPTIBLE,
      daysSinceExposure : 0,
    };

  function initialiseSEIRModel(){
    if (typeof SEIRModel.p == 'undefined') {
      SEIRModel.p = [];
      let t=JSON.stringify(genericPerson);
      for (let i=0; i<POPULATION_SIZE; i++)
        SEIRModel.p[i] = JSON.parse(t);
    } else {
      SEIRModel.p.splice(0, SEIRModel.p.length - POPULATION_SIZE);
      for (let i=1; i<POPULATION_SIZE; i++) {
        SEIRModel.p[i].state = inf.SUSCEPTIBLE;
        SEIRModel.p[i].daysSinceExposure = 0;
      }
    }
    for (let i=0; i<parameters.startInf; i++) {
      SEIRModel.p[i].state = inf.INFECTED;
      SEIRModel.p[i].daysSinceExposure = 1;
    }

    // This is the quickest way to initialise the SEIS model population
    SEISModel.p = [];
    SEISModel.p = JSON.parse(JSON.stringify(SEIRModel.p))

    if ((typeof SEIRModel.tmr == "undefined") || (SEIRModel.tmr == null))
      SEIRModel.tmr = setInterval(function() {
          SEIRModel();
        }, ANIMATION_TIME);

    outObj.SEIRModel.daysIn = 1;
    outObj.SEIRModel.clearDays = 0;
    outObj.SEIRModel.status = c.RUNNING;
    outObj.SEIRModel.numSusceptible = POPULATION_SIZE-1;
    outObj.SEIRModel.numExposed = 0;
    outObj.SEIRModel.numCarrier = 0;
    outObj.SEIRModel.numInfected = parameters.startInf;
    outObj.SEIRModel.dayInfected = 0;
    outObj.SEIRModel.peakInfected = 0;
    outObj.SEIRModel.numRecovered = 0;
    outObj.SEIRModel.numDead = 0;
    SEIRModel.Ro = parameters.RoInit;

    // debug('*** Model initialisation complete ***', 2);
    // for (let i=0; i<10; i++)
    //   SEIRModel();
  };
  //
  // --------------------------------------------------------------------------
  // expose() is used by the models to expose a proportion of the population to 
  // an infected person and adjust their state accordingly
  function expose(model, results) {
    // Infect population as required.  
    let dayContacts = model.Ro / parameters.Ti;

    let nextPr = dayContacts - parseInt(dayContacts);
    for (let i=0; i<parseInt(dayContacts); i++) {
      let t = Math.floor(Math.random() * POPULATION_SIZE);
      if (model.p[t].state == inf.SUSCEPTIBLE) {
        model.p[t].state = inf.EXPOSED;
        results.numSusceptible--;
        results.numInfected++;
        results.dayInfected++;
      }
    }
    if (Math.random() < nextPr) {
      let t = Math.floor(Math.random() * POPULATION_SIZE);
      if (model.p[t].state == inf.SUSCEPTIBLE) {
        model.p[t].state = inf.EXPOSED;
        results.numSusceptible--;
        results.numInfected++;
        results.dayInfected++;
      }
    }
  }
  //
  // --------------------------------------------------------------------------
  // infect() is used by the models to add infected people to the population
  function addInfected(model, results, numInf) {
    let p = JSON.parse(JSON.stringify(genericPerson));
    p.state = inf.INFECTED;
    p = JSON.stringify(p);

    for (let i=0; i<numInf; i++)
      model.p[POPULATION_SIZE + i] = JSON.parse(p);
    results.numInfected += numInf;
    results.dayInfected += numInf;
    POPULATION_SIZE += numInf;
    return;
  }

  //
  // --------------------------------------------------------------------------
  //
  function SEIRModel() {

    outObj.SEIRModel.dayInfected = 0;

    if (outObj.SEIRModel.daysIn >= parameters.startPropDay) {

      // Bring an infected person in at random
      if ((parameters.rndInfStartDay > 0) && (outObj.SEIRModel.daysIn >= parameters.rndInfStartDay) &&
          (parameters.rndInfEndDay > 0) && (outObj.SEIRModel.daysIn <= parameters.rndInfEndDay) &&
          (Math.random() < 0.10))
        addInfected(SEIRModel, outObj.SEIRModel, 1)

      // Bring a group of infected people in
      if (outObj.SEIRModel.daysIn == parameters.infNewBatchDay) 
        addInfected(SEIRModel, outObj.SEIRModel, parameters.infNewBatchNum);

      // Change Ro as required
      if ((parameters.Ro1Day > 0) && (outObj.SEIRModel.daysIn > parameters.Ro1Day))
        SEIRModel.Ro = parameters.Ro1Num;
      if ((parameters.Ro2Day > 0) && (outObj.SEIRModel.daysIn > parameters.Ro2Day))
        SEIRModel.Ro = parameters.Ro2Num;
      if ((parameters.Ro3Day > 0) && (outObj.SEIRModel.daysIn > parameters.Ro3Day))
        SEIRModel.Ro = parameters.Ro3Num;

      for (let i=0; i<POPULATION_SIZE; i++) {
        switch(SEIRModel.p[i].state) {
          case inf.EXPOSED:
            // Move EXPOSED into INFECTED and/or CARRIER states
            if (SEIRModel.p[i].daysSinceExposure > parameters.Te) {
              outObj.SEIRModel.numExposed--;
              if (Math.floor(Math.random() * 101) < parameters.asymptomatic) {
                SEIRModel.p[i].state = inf.CARRIER;
                outObj.SEIRModel.numCarrier++;
              } else {
                SEIRModel.p[i].state = inf.INFECTED;
                // These are already accounted for in the infected count
              }
            };
            break;
          case inf.CARRIER:
            if (SEIRModel.p[i].daysSinceExposure < (parameters.Te + parameters.Ti)) {
              expose(SEIRModel, outObj.SEIRModel);
            } else {
              if (SEIRModel.p[i].daysSinceExposure > parameters.Tr) {
                SEIRModel.p[i].state = inf.RECOVERED;
                outObj.SEIRModel.numInfected--;
                outObj.SEIRModel.numCarrier--;
                outObj.SEIRModel.numRecovered++;
              }
            }
            break;
          case inf.INFECTED:
            // Move INFECTED into DEAD or RECOVERED state as required
            if (SEIRModel.p[i].daysSinceExposure <= (parameters.Te + parameters.Ti)) {
              expose(SEIRModel, outObj.SEIRModel);
              if ((Math.random() * 100) < (parameters.mortality / parameters.Ti)) {
                SEIRModel.p[i].state = inf.DEAD;
                outObj.SEIRModel.numInfected--;
                outObj.SEIRModel.numDead++;
              } 
            } else if (SEIRModel.p[i].daysSinceExposure > parameters.Tr) {
                SEIRModel.p[i].state = inf.RECOVERED;
                outObj.SEIRModel.numInfected--;
                outObj.SEIRModel.numRecovered++;
            }
            break;
          case inf.SUSCEPTIBLE:
            // Do nothing because susceptible get infected in the INFECTED and CARRIER block
            break;
        }; // switch(SEIRModel.p[i].state) {
        if ((SEIRModel.p[i].state == inf.EXPOSED) ||
            (SEIRModel.p[i].state == inf.INFECTED) ||
            (SEIRModel.p[i].state == inf.CARRIER))
              SEIRModel.p[i].daysSinceExposure++;

      } // for (let i=0; i<POPULATION_SIZE; i++) {
    } 
    if ((outObj.SEIRModel.dayInfected == 0) && (outObj.SEIRModel.numInfected <= 0) && 
        (outObj.SEIRModel.daysIn >= parameters.startPropDay) && 
        (outObj.SEIRModel.daysIn >= parameters.rndInfEndDay) &&
        (outObj.SEIRModel.daysIn >= parameters.infNewBatchDay) &&
        (outObj.SEIRModel.daysIn >= parameters.modelEndDay))
      outObj.SEIRModel.clearDays++;
    else
      outObj.SEIRModel.clearDays = 0;

    if (outObj.SEIRModel.clearDays > 5) {
      outObj.SEIRModel.statusMsg = 'Outbreak stabilised after ' + 
        (outObj.SEIRModel.daysIn - outObj.SEIRModel.clearDays+1) + ' days';
      clearInterval(SEIRModel.tmr);
      SEIRModel.tmr = null;
      outObj.SEIRModel.status = c.COMPLETE;
    } else if ((parameters.modelEndDay > 0) && (outObj.SEIRModel.daysIn > parameters.modelEndDay)) {
      outObj.SEIRModel.statusMsg = 'Model stopped after ' + 
        (outObj.SEIRModel.daysIn -1) + ' days';
      clearInterval(SEIRModel.tmr);
      SEIRModel.tmr = null;
      outObj.SEIRModel.status = c.COMPLETE;
    } else {
      let div = POPULATION_SIZE/100;
      if (outObj.SEIRModel.daysIn % 2 == 0)
        outObj.SEIRModel.statusMsg = 'Day ' + outObj.SEIRModel.daysIn + ', Susceptible:' + 
          dp(outObj.SEIRModel.numSusceptible/div, 3) + '%, Infected:' + dp(outObj.SEIRModel.numInfected/div, 3) + 
          '%, Infected today:' + dp(outObj.SEIRModel.dayInfected/div, 3) + '%, Peak Infection:' + 
          dp(outObj.SEIRModel.peakInfected/div, 3) + '%, Recovered:' +  dp(outObj.SEIRModel.numRecovered/div, 3) + 
          '%, Dead:' + dp(outObj.SEIRModel.numDead/div, 3) + '%';

   
      if (outObj.SEIRModel.dayInfected > outObj.SEIRModel.peakInfected)
        outObj.SEIRModel.peakInfected = outObj.SEIRModel.dayInfected;
    }
    debug(outObj.SEIRModel.statusMsg, 3);

    hostUpdateReqd = true;
    transmitToHost();
    outObj.SEIRModel.daysIn++; // Ready for next time
  };
  //
  // --------------------------------------------------------------------------
  //
  function initialiseSEISModel(){

    // SEISModel population SEISModel.p is initialised by copying the SEIR 
    // model population (once the SEIR model population has been defined and 
    // initialised) in initialiseSEIRModel()

    outObj.SEISModel.status = c.RUNNING;

  }
  //
  // --------------------------------------------------------------------------
  //
  function SEISModel() {

  };

} // End of virusModelWebWorker() function - the webWorker code

codeInfo.registerFile(5);
//
// ----------------------------------------------------------------------------
//                               End of file
// ----------------------------------------------------------------------------
//
