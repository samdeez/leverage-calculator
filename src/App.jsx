import React, { useState } from "react";
import Leverage from "./Leverage";
import Spot from "./Spot";

const App = () => {
  const [cross, setCross] = useState(true);
  const [isolated, setIsolated] = useState(false);

  const handleIsolated = () => {
    setIsolated(true);
    setCross(false);
  };
  const handleCross = () => {
    setCross(true);
    setIsolated(false);
  };

  return (
    <div className="container-wrapper">
      <h1>$ Leverage Calculator $</h1>
      <div className="button-wrapper" role="tablist" aria-label="Calculator Type">
        <button
          role="tab"
          aria-selected={cross}
          aria-controls="spot-panel"
          id="spot-tab"
          onClick={handleCross}
          style={
            cross
              ? { backgroundColor: "darkslategray", color: "whitesmoke" }
              : { backgroundColor: "gray" }
          }
        >
          Spot
        </button>
        <button
          role="tab"
          aria-selected={isolated}
          aria-controls="leverage-panel"
          id="leverage-tab"
          onClick={handleIsolated}
          style={
            isolated
              ? { backgroundColor: "darkslategray", color: "whitesmoke" }
              : { backgroundColor: "gray" }
          }
        >
          Leverage
        </button>
      </div>
      <div
        id="leverage-panel"
        role="tabpanel"
        aria-labelledby="leverage-tab"
        style={{ display: isolated ? "block" : "none" }}
      >
        <Leverage />
      </div>
      <div
        id="spot-panel"
        role="tabpanel"
        aria-labelledby="spot-tab"
        style={{ display: isolated ? "none" : "block" }}
      >
        <Spot />
      </div>
    </div>
  );
};

export default App;
