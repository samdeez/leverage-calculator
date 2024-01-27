import React, { useState } from "react";
import Isolated from "./Isolated";
import Cross from "./Cross";

const App = () => {
  const [cross, setCross] = useState(false);
  const [isolated, setIsolated] = useState(true);

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
      <h1>Leverage Calculator</h1>
      <div className="button-wrapper">
        <button
          onClick={handleIsolated}
          style={
            isolated
              ? { backgroundColor: "darkslategray" }
              : { backgroundColor: "gray" }
          }
        >
          Isolated
        </button>
        <button
          onClick={handleCross}
          style={
            cross
              ? { backgroundColor: "darkslategray" }
              : { backgroundColor: "gray" }
          }
        >
          Cross
        </button>
      </div>
      {isolated ? <Isolated /> : <Cross />}
    </div>
  );
};

export default App;
