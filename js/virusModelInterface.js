"use strict"
//
//  virusModelInterface.js
//
//  This file runs in the host webpage and provides the interface to the web 
//  worker
//
//  ------------------------------------------------------------------------------
//  Revision History
//  ================
//  22 Mar 2020 MDS  Original
//  21 Dec 2020 MDS  Modified to use the updated weekly reporting style of the 
//                   Centre for European Disease Control
//
//  ------------------------------------------------------------------------------

// DEBUG_LEVEL 
//  0 - enable all messages through to 999 disable all messages
//  Add 1000 to disable timeout timers in webWorker
//     (1001 or 1002 are good debug numbers when debugging is required - 1000 can 
//      get quite verbose. 1999 is a good way to disable the webworker timeout without
//      getting heaps of debugging information )
var DEBUG_LEVEL = 1010;
var POPULATION_SIZE = 1000000; // Population size for the simulation
var ANIMATION_TIME = 25;       // Time in ms between updating the models

//----------------------------------------------------------------------------
// This function starts the web worker from inside the host script as required
//----------------------------------------------------------------------------  
var virusModelInterface = (function() {
  // Private functions and properties

  var c = Object.freeze({
    /* Status   */ INITIALISING: 1, IDLE: 2, RUNNING: 3, COMPLETE: 4,
    /* Commands */ NO_COMMAND: 101, ACK: 102, INITIALISE: 103, START: 104, STOP: 105, RESTART: 106
  });

  var outObj = { 
        parameters: {},
        results : {},
        command : c.INITIALISE,
        response : "",
        heartBeat : true,
        parentName : window.location.pathname.split("/").pop(),
        webWorkerName: '',
        SEIRModel: {
          status: c.INITIALISING
        },
        SEISModel: {
          status: c.INITIALISING,
        },
      };

  var timeoutTmr;
  var webWorkerHeartbeatTmr;
  var w;

  return {
    // Public functions
    debug : function(s, level) {
      //  0 - enable all messages through to 999 disable all messages
      //  Add 1000 to disable timeout timers in webWorker
      if (typeof level == "undefined") level = 0;
      if (level >= (DEBUG_LEVEL % 1000)) console.log(outObj.parentName + ':\n' + s);
    },
    
    SEIRisRunning : function() {
      return ((outObj.SEIRModel.status == c.RUNNING) || 
                    (outObj.SEIRModel.daysIn == outObj.parameters.modelEndDay));
    },

    SEISisRunning : function() {
      return (outObj.SEISModel.status == c.RUNNING);
    },

    //--------------------------------------------------------------------------
    // This function terminates the web worker from inside the host script
    //--------------------------------------------------------------------------  
    stopWebWorker : function() { 
      clearInterval(webWorkerHeartbeatTmr);
      if (typeof(w) !== "undefined") {
        w.terminate();
        w = undefined;
      }
    },

    // This is the timer that starts the web worker if the message channel 
    // goes quiet (because the web worker is not running in another instance)
    // If DEBUG_LEVEL >= 1000, this will stop this function automatically creating
    // another instance of the webWorker, to allow step by step debugging of the 
    // current instance of the webWorker
    restartTimeoutTimer : function() {
      clearTimeout(timeoutTmr);
      if (DEBUG_LEVEL < 1000) {
        timeoutTmr = setTimeout(function() {
          virusModelInterface.debug("\r\nWeb worker has stopped transmitting - starting new instance", 2);
          virusModelInterface.stopWebWorker();
          virusModelInterface.startWebWorker();        
          }, 3000);
      }
    },

    
    //--------------------------------------------------------------------------
    // This is the time that ensures regular transmission to the webworker 
    restartWebWorkerHeartbeatTimer : function() {
      clearTimeout(webWorkerHeartbeatTmr);
      webWorkerHeartbeatTmr = setTimeout(function() {
        if (typeof(w) !== "undefined") {
          w.postMessage(JSON.stringify(outObj));
        }
        virusModelInterface.restartWebWorkerHeartbeatTimer();
      }, 1500);
      return;
    },
      
    // -------------------------------------------------------------------------
    // 
    updateWorker : function() {
      w.postMessage(JSON.stringify(outObj));
      this.restartWebWorkerHeartbeatTimer();
    },
   
    //-------------------------------------------------------------------------
    loadParameters : function() {
      // Basic model parameters
      outObj.parameters.Ro = Number(document.getElementById('inpRo').value);
      outObj.parameters.mortality = Number(document.getElementById('inpMortality').value);
      outObj.parameters.asymptomatic = Number(document.getElementById('inpAsymptomatic').value);
      outObj.parameters.Te = Number(document.getElementById('inpTe').value);
      outObj.parameters.Ti = Number(document.getElementById('inpTi').value);
      outObj.parameters.Tr = Number(document.getElementById('inpTr').value);

      // Furfies - the things that make the model more 'real world'
      outObj.parameters.startInf = (document.getElementById('chkStartInf').checked == true) ?
        Number(document.getElementById('inpStartInf').value) * POPULATION_SIZE / 1000000 : 1;

      if (document.getElementById('chkRndInfStartDay').checked == true) {
        outObj.parameters.rndInfStartDay = Number(document.getElementById('inpRndInfStartDay').value);
        outObj.parameters.rndInfEndDay = Number(document.getElementById('inpRndInfEndDay').value);
        if (outObj.parameters.rndInfEndDay < outObj.parameters.rndInfStartDay) {
          outObj.parameters.rndInfEndDay = outObj.parameters.rndInfStartDay;
          document.getElementById('inpRndInfEndDay').value = outObj.parameters.rndInfEndDay;
        }
      } else {
        outObj.parameters.rndInfStartDay = -1;
        outObj.parameters.rndInfEndDay = -1;
      }

      outObj.parameters.infNewBatchNum = (document.getElementById('chkInfNewBatch').checked == true) ?
        Number(document.getElementById('inpInfNewBatchNum').value)  * POPULATION_SIZE / 1000000 : 0;
      outObj.parameters.infNewBatchDay = (document.getElementById('chkInfNewBatch').checked == true) ?
        Number(document.getElementById('inpInfNewBatchDay').value) : 1;

      outObj.parameters.Ro1Num = (document.getElementById('chkRo1').checked == true) ?
        Number(document.getElementById('inpRo1Num').value) : -1;
      outObj.parameters.Ro1Day = (document.getElementById('chkRo1').checked == true) ?
        Number(document.getElementById('inpRo1Day').value) : -1;
      outObj.parameters.Ro2Num = (document.getElementById('chkRo2').checked == true) ?
        Number(document.getElementById('inpRo2Num').value) : -1;
      outObj.parameters.Ro2Day = (document.getElementById('chkRo2').checked == true) ?
        Number(document.getElementById('inpRo2Day').value) : -1;
      outObj.parameters.Ro3Num = (document.getElementById('chkRo3').checked == true) ?
        Number(document.getElementById('inpRo3Num').value) : -1;
      outObj.parameters.Ro3Day = (document.getElementById('chkRo3').checked == true) ?
        Number(document.getElementById('inpRo3Day').value) : -1;
      outObj.parameters.startPropDay = (document.getElementById('chkStartPropDay').checked == true) ?
        Number(document.getElementById('inpStartPropDay').value) : 1;
      outObj.parameters.modelEndDay = (document.getElementById('chkModelEndDay').checked == true) ?
        Number(document.getElementById('inpModelEndDay').value) : -1;

    },

    //-------------------------------------------------------------------------
    startWebWorker : function() {
      // The following is how a web worker script would usually be started :
      //   w = new Worker("alarmWebWorker.js");
      // However, because Chrome doesn't let you load web workers when running 
      // scripts from a local file, the following workaround tricks Chrome into
      // thinking that web worker is a script running from a remote URL and not 
      // a web worker running from file:// per sey 
      w = new Worker(URL.createObjectURL(new Blob(["("+virusModelWebWorker.toString()+")()"], 
          {name: 'virusModelWebWorker', type: 'text/javascript'})));

      w.onerror = function(e) {
        debug("\r\nHost script says: Worker error:\r\n" + e.message  + " (" + e.filename + ":" + e.lineno + ")", 999);
      };

      //
      //-----------------------------------------------------------------------
      //
      w.onmessage = function(event) { 
        var rx;

        virusModelInterface.restartTimeoutTimer();
        try {
          rx = JSON.parse(event.data);
          if (rx === null)
            return;
          virusModelInterface.parseAndActionObject(rx);
          if (typeof outObj.webWorkerName !== "undefined") {
            virusModelInterface.debug('Message received from "' + outObj.webWorkerName + '" webWorker');    
          } else {
            virusModelInterface.debug('Message received from webWorker');    
          }
        } catch (e) { 
          virusModelInterface.debug('Host error : ' + e.message, 999);
          return;
        };
      };

      // Send the constants and parameters down upon startup
      outObj.modelConstants = c;
      this.loadParameters();
      outObj.command = c.INITIALISE;
      outObj.DEBUG_LEVEL = DEBUG_LEVEL;
      if (POPULATION_SIZE < 10000) POPULATION_SIZE = 10000;
      document.getElementById('modelDataNotice').innerHTML = 
        'The models are based upon a population of ' + POPULATION_SIZE.toLocaleString() +
        ' with a generic age and gender distribution';
      outObj.POPULATION_SIZE = POPULATION_SIZE;
      // Prevent the maximum ANIMATION_TIME from being longer than 1/2 of the timeout time
      if (ANIMATION_TIME > 1500) ANIMATION_TIME = 1500;
      outObj.ANIMATION_TIME = ANIMATION_TIME;
      this.updateWorker();
      outObj.command = '';


      //------------------------------------------------------------------------
      // Use this timeout to periodically check the things that allow the 
      // web worker to keep running
      setTimeout(function() {
          var stopIt = false;
          
          // Perform checks in here and set stopIt to true as required


          if (stopIt !== false) { 
            debug("\r\nStopping web worker");
            stopWebWorker();
          }
        }, 15000);
    }, // End of startWebWorker


    // -------------------------------------------------------------------------
    // 
    restartModels : function() {
      this.loadParameters();
      outObj.command = c.RESTART;
      this.updateWorker();
      outObj.command = '';
    },

    // -------------------------------------------------------------------------
    // parse the received object from the webworker and call other functions as
    // required
    //   d is the event.data object received from the host
    // -------------------------------------------------------------------------
    parseAndActionObject : function(d) {
      if (typeof d.webWorkerName !== "undefined")
        outObj.webWorkerName = d.webWorkerName;

      // Initialise and check for initialised
      if ((outObj.SEIRStatus == c.INITIALISING) && (d.SEIRStatus == c.IDLE)) {
        outObj.SEIRStatus = c.IDLE;
      }
      if ((outObj.SEISStatus == c.INITIALISING) && (d.SEISStatus == c.IDLE)) {
        outObj.SEISStatus = c.IDLE;
      }
      delete outObj.modelConstants;
      delete outObj.DEBUG_LEVEL;

      if (typeof d.response !== "undefined") {
        if (d.response == c.ACK)
          outObj.command = c.NO_COMMAND;
        this.updateWorker();
      }

      if (typeof d.SEIRModel.status !== "undefined")
        outObj.SEIRModel.status = d.SEIRModel.status;

      if (typeof d.SEISModel.status !== "undefined")
        outObj.SEISModel.status = d.SEISModel.status;

      if ((typeof d.SEIRModel.statusMsg !== "undefined") && (modelChartObj.showSEIRData == true))
        document.getElementById('modelStatus').innerHTML = 'SEIR Model: ' + d.SEIRModel.statusMsg;
      if ((typeof d.SEISModel.statusMsg !== "undefined") && (modelChartObj.showSEISData == true)) {
        if (document.getElementById('modelStatus').innerHTML.length != 0) 
          document.getElementById('modelStatus').innerHTML += '<br/>';
        document.getElementById('modelStatus').innerHTML += 'SEIS Model: ' + d.SEISModel.statusMsg;
      }

      modelChartObj.updateChart(d);

      if ((outObj.SEIRStatus == c.INITIALISING) || (outObj.SEISStatus == c.INITIALISING))
        return;

      if (typeof d.response != "undefined") {
        if (d.response == c.ACK)
          outObj.command = c.NO_COMMAND;
      }
    }
  };
})();


console.log("Model interface script loaded OK");
if (typeof(Worker) === "undefined") {
  alert("Host script says: Sorry! No Web Worker support.");
} else {
  virusModelInterface.restartWebWorkerHeartbeatTimer();
  virusModelInterface.restartTimeoutTimer();
  virusModelInterface.startWebWorker();
} 





codeInfo.registerFile(5);
//
// ----------------------------------------------------------------------------
//                               End of file
// ----------------------------------------------------------------------------
//


