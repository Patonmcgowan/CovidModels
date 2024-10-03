"use strict"
//
//  utilities.js
//
// ----------------------------------------------------------------------------
//  Revision History
//  ================
//  8 Apr 2020 MDS  Original
//
// ----------------------------------------------------------------------------
//
// ----------------------------------------------------------------------------
// codeInfo
// It is not possible to load a javascript file from the local client so we 
// throw an error in the last line of each file as it loads and examine the 
// result, which contains the line that the error was thrown, and the filename
  //
  // --------------------------------------------------------------------------
  // Get the name of the file and the line number from which this function was 
  // called
var codeInfo = {
  registerFile : function(linesFollowing = 0) { 
    function throwError() {
      try { throw Error('Register File') } catch(err) { return(err); }
    };
    var err = throwError();
    var errStack = err.stack.split("\n");
    var caller_line = errStack[errStack.length - 1]
    var clean = caller_line.slice(caller_line.indexOf("at ") + 2, caller_line.length).split("/"); 
    var codeData = clean[clean.length - 1].split(":");
    codeInfo.addFileInfo(codeData[0], codeData[1]);
  },

  getInfo : function() {
    var i;
    var totalLines = 0;
    var outStr = '';
      
    outStr += 'Third party files:<br/>';
    outStr += '  Chart.min.js<br/>';
    outStr += '  COVID-19-Data.json<br/><br/>';
    outStr += 'Files containing Javascript:<br/>';
    outStr += '  File                     Lines<br/>';
    outStr += '  ~~~~                     ~~~~~<br/>';
    for (i = 0; i < this.srcFileNames.length; i++) {
      outStr += '  ' + pad(this.srcFileNames[i], 23, " ", PAD_RIGHT) + ' ' 
        + pad(this.srcFileLines[i],6) + '<br/>';
      totalLines += parseInt(this.srcFileLines[i]);
    }
    outStr += '  ------------------------------<br/>';
    outStr += '  ' + totalLines + ' lines in ' + this.srcFileNames.length + ' files.<br/>';
    return '<pre>' + outStr + '</pre>';
  },
  
  // The following is stuff that is private to this command
  srcFileNames: [],
  srcFileLines: [],
  addFileInfo: function(fileName, fileLines) {
    var tmp, i;
    this.srcFileNames.push(fileName);
    this.srcFileLines.push(fileLines);
    
    for (i = 0; i < (this.srcFileNames.length - 1); i++) {
      if (this.srcFileNames[i] > this.srcFileNames[i + 1]) {
        tmp = this.srcFileNames[i];
        this.srcFileNames[i] = this.srcFileNames[i+1];
        this.srcFileNames[i+1] = tmp;
        tmp = this.srcFileLines[i];
        this.srcFileLines[i] = this.srcFileLines[i+1];
        this.srcFileLines[i+1] = tmp;
      }
    }
  }
};


const PAD_LEFT = 0;
const PAD_RIGHT = 1;
//
// ----------------------------------------------------------------------------
// pad a string and return the padded result
//
function pad(s, width, ch, dirn) {
  if (width == undefined) 
    return s;
  if (ch == undefined) 
    ch = ' ';
  if (ch.length > 1)
    ch = ch[0];
  if (dirn == undefined) dirn = PAD_LEFT;

  s = s.toString();
  var i = s.length;
  
  if (dirn == PAD_LEFT) {
    while (i < width) {
      s = ch + s;
      i++;
    }
  } else {
    while (i < width) {
      s = s + ch;
      i++;
    }
  }
  return s;
}
//
// ----------------------------------------------------------------------------
// return a string of HTML friendly spaces
//
function spc(width) {
  if (width == undefined) 
    return '';
  var s = '\xa0';
  return s.repeat(width);
}

codeInfo.registerFile(5);
//
// ----------------------------------------------------------------------------
//                               End of file
// ----------------------------------------------------------------------------
//
