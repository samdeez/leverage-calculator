import React, { useState } from "react";

const App = () => {
  const [feesPercent, setFeesPercent] = useState(5);
  const [localPrice, setlocalPrice] = useState(52000);
  const [invest, setInvest] = useState("");
  const [enterPrice, setEnterPrice] = useState("");
  const [exitPrice, setExitPrice] = useState("");
  const [leverage, setLeverage] = useState(10);
  const [percentPrice, setPercentPrice] = useState(0);
  const [fundingHour, setFundingHour] = useState(0.01);
  const [hours, setHours] = useState(0);

  const handleFeesPercentChange = (event) => {
    setFeesPercent(event.target.value);
  };

  const handleLocalPriceChange = (event) => {
    setlocalPrice(event.target.value);
  };

  const handleEnterPriceChange = (event) => {
    const percentChange =
      ((exitPrice - event.target.value) / event.target.value) * 100;
    setPercentPrice(percentChange);
    setEnterPrice(event.target.value);
  };

  const handleExitPriceChange = (event) => {
    const percentChange =
      ((event.target.value - enterPrice) / enterPrice) * 100;
    setPercentPrice(percentChange.toFixed(2));
    setExitPrice(event.target.value);
  };

  const handlePercentPriceChange = (event) => {
    const percentChange = parseFloat(event.target.value);
    const newExitPrice = enterPrice * (1 + percentChange / 100);
    setPercentPrice(percentChange);
    setExitPrice(newExitPrice.toFixed(2));
  };

  const handleLeverageChange = (event) => {
    setLeverage(event.target.value);
  };

  const handleInvestChange = (event) => {
    setInvest(event.target.value);
  };

  const handleFundingHour = (event) => {
    setFundingHour(event.target.value);
  };

  const handleHours = (event) => {
    setHours(event.target.value);
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

          <div className="inputContainer">
            <div className="inputLabel">% Change:</div>
            <input
              type="number"
              value={percentPrice}
              onChange={handlePercentPriceChange}
              className="input"
              placeholder="0%"
            />
            <div className="inputSuffix">%</div>
          </div>

          <div className="inputContainer">
            <div className="inputLabel">Funding/h:</div>
            <input
              type="number"
              value={fundingHour}
              onChange={handleFundingHour}
              className="input"
              placeholder="$"
            />
            <div className="inputSuffix">$</div>
          </div>

          <div className="inputContainer">
            <div className="inputLabel">Hours Open:</div>
            <input
              type="number"
              value={hours}
              onChange={handleHours}
              className="input"
              placeholder="h"
            />
            <div className="inputSuffix">h</div>
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
              background:
                levCalc() < 0
                  ? "linear-gradient(45deg, black, #4f2f2f)"
                  : "linear-gradient(45deg, black, darkslategray)",
              color: levCalc() < 0 ? "firebrick" : "seagreen",
            }}
          >
            {levCalc() > 0
              ? "+" + levCalc().toLocaleString()
              : levCalc().toLocaleString()}{" "}
            $
            <br />
            {(levCalc() * localPrice).toLocaleString()} T
            <br />
            <span style={{ color: "gray", fontSize: "medium" }}>
              -{fundingHour * hours}$ Funding
            </span>
          </p>
          <div className="reswrapper">
            <div className="reswrapperinner">
              <p className="outputLabel">Entery & Exit:</p>
              <div
                className="resultgrid"
                style={{
                  backgroundColor: "gray",
                  background: "linear-gradient(45deg, #333, black)",
                }}
              >
                <span style={{ fontSize: "small", color: "gray" }}>
                  {"IN:"}
                </span>{" "}
                <br />
                <span style={{ color: "#d0d0d0" }}>
                  {(enterPrice * 1).toLocaleString()} $
                </span>
                <br />
                <hr class="solid" style={{ margin: "5px" }} />
                <span style={{ fontSize: "small", color: "gray" }}>
                  {"OUT:"}
                </span>{" "}
                <br />
                <span style={{ color: "#d0d0d0" }}>
                  {(exitPrice * 1).toLocaleString()} ${" "}
                  <span
                    style={{
                      color: percentPrice >= 0 ? "seagreen" : "firebrick",
                    }}
                  >
                    {percentPrice > 0 ? "+" + percentPrice : percentPrice}%
                  </span>
                </span>
              </div>
            </div>
            <div className="reswrapperinner">
              <p className="outputLabel">Liquid price:</p>
              <div
                className="resultgrid"
                style={{
                  backgroundColor: "darkslategray",
                  background: "linear-gradient(45deg, #333, black)",
                  color: "goldenrod",
                }}
              >
                <span style={{ fontSize: "small", color: "gray" }}>Long ⬆</span>
                <br />
                <span>
                  {(enterPrice - enterPrice / leverage).toLocaleString()} $
                </span>
                <br />
                <hr class="solid" style={{ margin: "5px" }} />
                <span style={{ fontSize: "small", color: "gray" }}>
                  Short ⬇
                </span>
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
                background: "linear-gradient(135deg, sienna, gray)",
                color: "burlywood",
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
