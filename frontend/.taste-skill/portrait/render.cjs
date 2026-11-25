const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { Portrait } = require("./portrait.js");
const person = { id: "diksha", name: "Diksha", title: "Staff Engineer, Payments", style: "", pitch: 1, rate: 1, voice: "female", hue: 18 };
process.stdout.write(renderToStaticMarkup(React.createElement(Portrait, { person, scene: true })));
