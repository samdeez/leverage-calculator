import React, { useState } from "react";
import Leverage from "./Leverage";
import Spot from "./Spot";

const App = () => {
  const [isLeverage, setIsLeverage] = useState(false);

  return (
    <div className="container-wrapper">
      <h1>$ Leverage Calculator $</h1>
      <div className="button-wrapper">
        <button
          onClick={() => setIsLeverage(false)}
          style={
            !isLeverage
              ? { backgroundColor: "darkslategray" }
              : { backgroundColor: "gray" }
          }
        >
          Spot
        </button>
        <button
          onClick={() => setIsLeverage(true)}
          style={
            isLeverage
              ? { backgroundColor: "darkslategray" }
              : { backgroundColor: "gray" }
          }
        >
          Leverage
        </button>
      </div>
      {isLeverage ? <Leverage /> : <Spot />}
    </div>
  );
};

export default App;
