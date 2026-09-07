import { renderToString } from "react-dom/server";
import Spot from "./src/Spot.jsx";
import React from "react";

const iterations = 10000;
const start = process.hrtime.bigint();

for (let i = 0; i < iterations; i++) {
  renderToString(React.createElement(Spot));
}

const end = process.hrtime.bigint();
console.log(`Render time for ${iterations} iterations: ${Number(end - start) / 1000000} ms`);
