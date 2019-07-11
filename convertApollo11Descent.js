// Convert Apollo 11 LEM Descent data to OpenSpace Translations.
// Author: Emil Axelsson, 2019-07-11
// License: MIT

const xmlJs = require('xml-js');
const fs = require('fs');

const inputFile = 'the_last_four_minutes_2019-06-09.kml';
const outputFile = 'apollo11LemDescent.asset';

const forcedLandingSpot = [23.4733, 0.6741, -1925];

const xml = fs.readFileSync(inputFile, 'utf8');
const data = xmlJs.xml2js(xml);

const traverse = (node, fn) => {
  fn(node);
  if (node.elements) {
    node.elements.forEach(child => traverse(child, fn));
  }
}

const filter = (data, fn) => {
  const matches = [];
  traverse(data, node => {
    if (fn(node)) {
      matches.push(node);
    }
  });
  return matches;
}

const find = (data, fn) => {
  let found = undefined;
  traverse(data, node => {
    if (found) {
      return;
    }
    if (fn(node)) {
      found = node;
    }
  });
  return found;
}

const hasName = (name) => {
  return node => {
    const nameElement = node.elements &&
          node.elements.find(element => element.name = "name");

    return nameElement && 
           nameElement.elements &&
           nameElement.elements.find(element => element.text === name);
  }
}

const getString = node => {
  if (!node.elements) {
    return undefined;
  }
  if (!node.elements[0]) {
    return undefined;
  }
  if (!node.elements[0].text) {
    return undefined;
  }
  return node.elements[0].text;
}

const descentMarkersElement = find(data, hasName('Decent Markers'));
if (!descentMarkersElement) {
  console.error('No descent markers were found.')
  return;
}

const positionData = {};
const touchdownTime = new Date('1969 JUL 20 20:17:40 UTC');

const descentMarkers = descentMarkersElement.elements;

let landingTime = 0;

descentMarkers.forEach(marker => {
  const nameElement = marker.elements.find(e => e.name === 'name');
  if (!nameElement) return;

  const pointElement = marker.elements.find(e => e.name === 'Point');
  if (!pointElement) return;

  const coordinatesElement = pointElement.elements.find(e => e.name === 'coordinates');
  if (!coordinatesElement) return;

  const name = getString(nameElement);
  const minSec = name.substring(0, 4).split(':');
  const seconds = (+minSec[0])*60 + (+minSec[1]);

  const coordinatesString = getString(coordinatesElement);
  const lonLatAlt = coordinatesString.split(',');

  const time = new Date(touchdownTime - seconds * 1000);
  const isoTime = time.toISOString().substring(0, 19);

  positionData[isoTime] = lonLatAlt;
  landingTime = isoTime;
});

const originalLandingSpot = positionData[landingTime];
const offset = [forcedLandingSpot[0] - originalLandingSpot[0], 
                forcedLandingSpot[1] - originalLandingSpot[1], 
                forcedLandingSpot[2] - originalLandingSpot[2]];

output = '-- The following keyframe data was converted from ' + inputFile + ',\n' + 
         '-- which is available at http://apollo.mem-tek.com/GoogleMoonKMZ.html\n\n' +
         '-- In the conversion, some assumptions and simplifications were made:\n' +
         '--   * The descent markers in the KML have Point nodes expressed "relaivte to ground"\n' +
         '--     We assume that the ground is fixed at altitude ' + -forcedLandingSpot[2] + ' meters below the reference ellipsoid,\n' +
         '--     in order to match height data from a height map constructed from LRO data.\n' +
         '--   * We manually offset the coordiantes slightly, by ' + offset[0] + 'degrees in longitude and ' + offset[1] + ' degrees in latitude, \n' +
         '--     in order to match the landing spot specified at long: ' + forcedLandingSpot[0] + ', lat: ' + forcedLandingSpot[1] + ' extracted from footage from LRO.\n' +
         '--     The kml file provided ' + originalLandingSpot[0] + ', lat: ' + originalLandingSpot[1] + ' as the landing coordinates - hence the manual offset.\n' + 
         '--     If more accurate height/color maps are aqcuired, these values can be adjusted by running the conversion script again.\n' + 
         '--     For more information, contact emil.axelsson@liu.se.\n\n'; 

output += "asset.export('keyframes', {\n"
Object.entries(positionData).forEach(([key, value]) => {
  output += '    [\'' + key + '\'] = {\n' +
            '        Type = "GlobeTranslation",\n' +
            '        Globe = "Moon",\n' +
            '        Longitude = ' + (+value[0] + offset[0]) + ',\n' +
            '        Latitude = ' + (+value[1] + offset[1]) + ',\n' +
            '        Altitude = ' + (+value[2] + offset[2]) + ',\n' +
            '        UseHeightmap = false\n' +
            '    },\n';
});

output += "})";

fs.writeFileSync(outputFile, output);
