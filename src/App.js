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
      <h1>$ Degen Calculator $</h1>
      <div className="button-wrapper">
        <button
          onClick={handleCross}
          style={
            cross
              ? { backgroundColor: "darkslategray" }
              : { backgroundColor: "gray" }
          }
        >
          Degen
        </button>
        <button
          onClick={handleIsolated}
          style={
            isolated
              ? { backgroundColor: "darkslategray" }
              : { backgroundColor: "gray" }
          }
        >
          Leverage
        </button>
      </div>
      {isolated ? <Leverage /> : <Spot />}
    </div>
  );
};

export default App;
