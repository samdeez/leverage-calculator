import React, { useState } from "react";

const Spot = () => {
  const [feesPercent, setFeesPercent] = useState(0);
  const [localPrice, setlocalPrice] = useState(60000);
  const [invest, setInvest] = useState("");
  const [enterPrice, setEnterPrice] = useState("");
  const [exitPrice, setExitPrice] = useState("");
  const [percentPrice, setPercentPrice] = useState(0);
  const [percentToSell, setPercentToSell] = useState(100);

  const leverage = 1;

  const handleFeesPercentChange = (event) => {
    setFeesPercent(event.target.value);
  };

  //add later
  const handlePercentToSell = (event) => {
    setPercentToSell(event.target.value);
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
    setPercentPrice(percentChange);
    setExitPrice(event.target.value);
  };

  const handlePercentPriceChange = (event) => {
    const percentChange = parseFloat(event.target.value);
    const newExitPrice = enterPrice * (1 + percentChange / 100);
    setPercentPrice(percentChange);
    setExitPrice(newExitPrice.toFixed(2));
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
    <div className="container">
      <div className="insidecol">
        <h2 style={{ color: "gray", textAlign: "center" }}>
          input spot trade:
        </h2>
        <hr style={{ marginBottom: "30px" }} />
        <div className="inputContainer">
          <div className="inputLabel">Buy Amount:</div>
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
          <div className="inputLabel">Buy Price:</div>
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
          <div className="inputLabel">Sell Price:</div>
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
          <div className="inputLabel">% To Sell:</div>
          <input
            type="number"
            value={percentToSell}
            onChange={handlePercentPriceChange}
            className="input"
            placeholder="0%"
          />
          <div className="inputSuffix">%</div>
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

        <div className="note">
          <p>- Don't get greedy! Take profits while you can!</p>
          <p>- WGMI 2024</p>
        </div>
      </div>

      {/* RESULTS */}
      <div className="insidecol">
        <p className="outputLabel">P&L:</p>
        <div
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
          <span style={{ color: "#d0d0d0", fontSize: "xx-large" }}>
            ${(levCalc() + Number(invest)).toLocaleString()}
            <span style={{ fontSize: "x-small", color: "gray" }}>
              {" "}
              Total Equity
            </span>
          </span>
          <br />
          <span>
            $
            {levCalc() > 0
              ? "+" + levCalc().toLocaleString()
              : levCalc().toLocaleString()}{" "}
            <span style={{ fontSize: "x-small", color: "gray" }}>
              {" "}
              Profit/Loss
            </span>
          </span>
          <hr class="solid" style={{ margin: "5px" }} />
          <span style={{ color: "#d0d0d0", fontSize: "larger" }}>
            {(invest * localPrice + levCalc() * localPrice).toLocaleString()} t
            <span style={{ fontSize: "x-small", color: "gray" }}>
              {" "}
              Total Equity in t
            </span>
          </span>
          <br />
          <span>
            {levCalc() > 0
              ? "+" + (levCalc() * localPrice).toLocaleString()
              : (levCalc() * localPrice).toLocaleString()}{" "}
            t
            <span style={{ fontSize: "x-small", color: "gray" }}>
              {" "}
              Profit/Loss in t
            </span>
          </span>
          <hr class="solid" style={{ margin: "5px" }} />
          <span style={{ color: "#d0d0d0", fontSize: "medium" }}>
            {(invest / enterPrice).toFixed(6)} ₿
            <span style={{ fontSize: "x-small", color: "gray" }}>
              {" "}
              Tokens Recieved
            </span>
          </span>
          <br />
          <span style={{ fontSize: "small" }}>
            {((levCalc() + Number(invest)) / Number(invest)) * 100 < -100
              ? 100
              : ((levCalc() / invest) * 100).toFixed(1)}
            %<span style={{ fontSize: "x-small", color: "gray" }}> ROI</span>
          </span>
          <hr class="solid" style={{ margin: "5px" }} />
          <span>
            You turned $<span style={{ fontSize: "x-large" }}>{invest} </span>{" "}
            into $
            <span style={{ fontSize: "x-large" }}>
              {(levCalc() + Number(invest)).toLocaleString()}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default Spot;
