import React, { useState } from "react";

const App = () => {
  const [feesPercent, setFeesPercent] = useState(10);
  const [localPrice, setlocalPrice] = useState(52000);
  const [invest, setInvest] = useState("");
  const [enterPrice, setEnterPrice] = useState("");
  const [exitPrice, setExitPrice] = useState("");
  const [leverage, setLeverage] = useState(5);

  const handleFeesPercentChange = (event) => {
    setFeesPercent(event.target.value);
  };

  const handleLocalPriceChange = (event) => {
    setlocalPrice(event.target.value);
  };

  const handleEnterPriceChange = (event) => {
    setEnterPrice(event.target.value);
  };

  const handleExitPriceChange = (event) => {
    setExitPrice(event.target.value);
  };

  const handleLeverageChange = (event) => {
    setLeverage(event.target.value);
  };

  const handleInvestChange = (event) => {
    setInvest(event.target.value);
  };

  function levCalc() {
    let levSum =
      (
        ((Number(invest) * Number(leverage)) / Number(enterPrice)) *
        (Number(exitPrice) - Number(enterPrice))
      ).toFixed(2) *
      (1 - Number(feesPercent) / 100);

    return levSum;
  }

  function shortCalc() {
    let shortLiq = enterPrice / leverage;
    shortLiq += +enterPrice;

    return shortLiq.toLocaleString();
  }

  return (
    <div className="container-wrapper">
      <h1>Leverage Calculator</h1>

      <div className="container">
        <div className="insidecol">
          <h2 style={{ color: "gray", textAlign: "center" }}>
            Input Trade Details:
          </h2>
          <hr style={{ marginBottom: "30px" }} />
          <div className="inputContainer">
            <div className="inputLabel">Trade Amount:</div>
            <input
              type="number"
              value={invest}
              onChange={handleInvestChange}
              className="input"
              placeholder="0"
              onFocus={() => console.log("Clicked!")}
            />

            <div className="inputSuffix">$</div>
          </div>

          <div className="inputContainer">
            <div className="inputLabel">Entry Price:</div>
            <input
              type="number"
              value={enterPrice}
              onChange={handleEnterPriceChange}
              className="input"
              placeholder="0"
            />
            <div className="inputSuffix">$</div>
          </div>

          <div className="inputContainer">
            <div className="inputLabel">Exit Price:</div>
            <input
              type="number"
              value={exitPrice}
              onChange={handleExitPriceChange}
              className="input"
              placeholder="0"
            />
            <div className="inputSuffix">$</div>
          </div>

          <div className="inputContainer">
            <div className="inputLabel">USD Price:</div>
            <input
              type="number"
              value={localPrice}
              onChange={handleLocalPriceChange}
              className="input"
              placeholder="0"
            />
            <div className="inputSuffix">T</div>
          </div>

          <div className="inputContainer">
            <div className="inputLabel">Leverage:</div>
            <input
              type="number"
              value={leverage}
              onChange={handleLeverageChange}
              className="input"
              placeholder="0"
            />
            <div className="inputSuffix">x</div>
          </div>

          <div className="inputContainer">
            <div className="inputLabel">Fees:</div>
            <input
              type="number"
              value={feesPercent}
              onChange={handleFeesPercentChange}
              className="input"
              placeholder="0"
            />
            <div className="inputSuffix">%</div>
          </div>

          <div className="note">
            <p>- Don't get greedy! Take profits while you can!</p>
            <p>- WGMI 2024</p>
          </div>
        </div>

        <div className="insidecol">
          <p className="outputLabel">P&L:</p>
          <p
            className="resultgrid"
            style={{
              backgroundColor: "#2f2f2f",
              background: "linear-gradient(45deg, black, darkslategray)",
              color: levCalc() < 0 ? "firebrick" : "seagreen",
            }}
          >
            {levCalc() > 0
              ? "+" + levCalc().toLocaleString()
              : levCalc().toLocaleString()}{" "}
            $
            <br />
            {(levCalc() * localPrice).toLocaleString()} T
          </p>
          <div className="reswrapper">
            <div className="reswrapperinner">
              <p className="outputLabel">Entery & Exit:</p>
              <div
                className="resultgrid"
                style={{
                  backgroundColor: "gray",
                  background: "linear-gradient(gray, darkslategray)",
                }}
              >
                <span style={{ fontSize: "small" }}>{"IN:"}</span> <br />
                <span>{(enterPrice * 1).toLocaleString()} $</span>
                <br />
                <hr class="solid" style={{ margin: "5px" }} />
                <span style={{ fontSize: "small" }}>{"OUT:"}</span> <br />
                <span>{(exitPrice * 1).toLocaleString()} $</span>
              </div>
            </div>
            <div className="reswrapperinner">
              <p className="outputLabel">Liquid price:</p>
              <div
                className="resultgrid"
                style={{
                  backgroundColor: "darkslategray",
                  background: "linear-gradient(goldenrod, #1a0000)",
                  color: "gold",
                }}
              >
                <span style={{ fontSize: "small" }}>Long ⬆</span>
                <br />
                <span>
                  {(enterPrice - enterPrice / leverage).toLocaleString()} $
                </span>
                <br />
                <hr class="solid" style={{ margin: "5px" }} />
                <span style={{ fontSize: "small" }}>Short ⬇</span>
                <br />
                <span>{shortCalc()} $</span>
              </div>
            </div>
          </div>

          <p className="outputLabel">Margin:</p>

          <div className="pl">
            <p className="resultgrid">
              {(invest * 1).toLocaleString()} $
              <br />
              {(invest / enterPrice).toFixed(6)} ₿
              <br />
              {(invest * localPrice).toLocaleString()} T
            </p>
            <p className="outputLabel">Size:</p>
            <p
              className="resultgrid"
              style={{
                backgroundColor: "sienna",
                background: "linear-gradient(45deg, sienna, gray)",
              }}
            >
              {(invest * leverage).toLocaleString()} $
              <br />
              {((invest / enterPrice) * leverage).toFixed(6)} ₿
              <br />
              {(invest * leverage * localPrice).toLocaleString()} T
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
