const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { Portrait } = require("./portrait.js");
const fs = require("fs");
const all = [
  ["diksha","Diksha","Staff Engineer, Payments","female",18],["puneet","Puneet Tiwari","Senior Engineer, Infrastructure","male",205],
  ["trishna","Trishna","Engineering Manager, Search","female",330],["ayush","Ayush","Principal Engineer, Data","male",150],
  ["sana","Sana","Senior Engineer, Mobile","female",265],["arjun","Arjun","Tech Lead, Backend","male",42],
  ["divya","Divya","Staff Engineer, Reliability","female",185],["vikram","Vikram","Senior Engineer, Platform","male",95],
  ["nisha","Nisha","Engineering Manager, Growth","female",350],["farhan","Farhan","Principal Engineer, Systems","male",235],
].map(([id,name,title,voice,hue]) => ({ id, name, title, style: "", pitch: 1, rate: 1, voice, hue }));
const out = {};
out.scene = renderToStaticMarkup(React.createElement(Portrait, { person: all[1], scene: true }));
out.round = all.map(p => ({ name: p.name, title: p.title, svg: renderToStaticMarkup(React.createElement(Portrait, { person: p, size: 44 })) }));
fs.writeFileSync(process.argv[2], JSON.stringify(out));
