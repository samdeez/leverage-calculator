import React, { useState } from "react";
import { NumericFormat } from "react-number-format";

const Spot = () => {
  const [feesPercent, setFeesPercent] = useState(0);
  const [localPrice, setlocalPrice] = useState(200000);
  const [invest, setInvest] = useState("200");
  const [enterPrice, setEnterPrice] = useState("88");
  const [exitPrice, setExitPrice] = useState("");
  const [percentPrice, setPercentPrice] = useState(0.58);
  //const [percentToSell, setPercentToSell] = useState(100);

  //2025 version
  const [compoundTrades, setCompoundTrades] = useState(1);
  const handleCompoundTrades = (event) => {
    setCompoundTrades(event.target.value);
  };

  const leverage = 1;

  const handleFeesPercentChange = (event) => {
    setFeesPercent(event.target.value);
  };

  //add later
  /*const handlePercentToSell = (event) => {
    setPercentToSell(event.target.value);
  };*/

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

  function compoundCalc() {
    let comp = 1 + Number(percentPrice) / 100;
    let Sum = invest * Math.pow(comp, compoundTrades);
    let profit = Sum - invest;

    return profit;
  }

  const levSumValue = levCalc();

  return (
    <div className="container">
      <div className="insidecol">
        <h2 style={{ color: "gray", textAlign: "center" }}>
          input spot trade:
        </h2>
        <hr style={{ marginBottom: "30px" }} />
        <div className="inputContainer">
          <label htmlFor="spotBuyAmount" className="inputLabel">Buy Amount:</label>
          <NumericFormat
            id="spotBuyAmount"
            thousandSeparator=","
            value={invest}
            onValueChange={(values) => handleInvestChange({ target: { value: values.value } })}
            className="input"
            placeholder="0"
            onFocus={() => console.log("Clicked!")}
          />

          <div className="inputSuffix">$</div>
        </div>

        <div className="inputContainer">
          <label htmlFor="spotBuyPrice" className="inputLabel">Buy Price:</label>
          <NumericFormat
            id="spotBuyPrice"
            thousandSeparator=","
            value={enterPrice}
            onValueChange={(values) => handleEnterPriceChange({ target: { value: values.value } })}
            className="input"
            placeholder="0"
          />
          <div className="inputSuffix">$</div>
        </div>

        <div className="inputContainer">
          <label htmlFor="spotSellPrice" className="inputLabel">Sell Price:</label>
          <NumericFormat
            id="spotSellPrice"
            thousandSeparator=","
            value={exitPrice}
            onValueChange={(values) => handleExitPriceChange({ target: { value: values.value } })}
            className="input"
            placeholder="0"
          />
          <div className="inputSuffix">$</div>
        </div>

        {/*
        <div className="inputContainer">
          <label htmlFor="spotPercentToSell" className="inputLabel">% To Sell:</label>
          <input
            id="spotPercentToSell"
            type="number"
            value={percentToSell}
            onChange={handlePercentToSell}
            className="input"
            placeholder="0%"
          />
          <div className="inputSuffix">%</div>
        </div>
        */}

        <div className="inputContainer">
          <label htmlFor="spotUsdPrice" className="inputLabel">USD Price:</label>
          <NumericFormat
            id="spotUsdPrice"
            thousandSeparator=","
            value={localPrice}
            onValueChange={(values) => handleLocalPriceChange({ target: { value: values.value } })}
            className="input"
            placeholder="0"
          />
          <div className="inputSuffix">T</div>
        </div>

        <div className="inputContainer">
          <label htmlFor="spotFees" className="inputLabel">Fees:</label>
          <NumericFormat
            id="spotFees"
            thousandSeparator=","
            value={feesPercent}
            onValueChange={(values) => handleFeesPercentChange({ target: { value: values.value } })}
            className="input"
            placeholder="0"
          />
          <div className="inputSuffix">%</div>
        </div>

        <div className="inputContainer">
          <label htmlFor="spotPercentChange" className="inputLabel">% Change:</label>
          <NumericFormat
            id="spotPercentChange"
            thousandSeparator=","
            value={percentPrice}
            onValueChange={(values) => handlePercentPriceChange({ target: { value: values.value } })}
            className="input"
            placeholder="0%"
          />
          <div className="inputSuffix">%</div>
        </div>

        {/* 2025 version */}
        <div className="inputContainer">
          <label htmlFor="spotCompoundTrades" className="inputLabel">Compound Trades:</label>
          <NumericFormat
            id="spotCompoundTrades"
            thousandSeparator=","
            value={compoundTrades}
            onValueChange={(values) => handleCompoundTrades({ target: { value: values.value } })}
            className="input"
            placeholder="1"
          />
          <div className="inputSuffix">#</div>
        </div>

        <div className="note">
          <p>- Don't get greedy! Take profits while you can!</p>
          <p>- Stick to the plan! Don't FOMO!</p>
          <p>- WGMI 2025/2026</p>
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
              levSumValue < 0
                ? "linear-gradient(45deg, black, #4f2f2f)"
                : "linear-gradient(45deg, black, darkslategray)",
            color: levSumValue < 0 ? "firebrick" : "seagreen",
          }}
        >
          <span>
            <span style={{ fontSize: "x-large" }}>
              {levSumValue > 0 ? "+$" : "$"}
            </span>
            <span style={{ fontSize: "xx-large" }}>
              {levSumValue.toLocaleString()}
            </span>
            <span style={{ fontSize: "x-small", color: "gray" }}>
              {" "}
              Profit/Loss
            </span>
          </span>
          <br />
          <span style={{ fontSize: "large" }}>
            {((levSumValue + Number(invest)) / Number(invest)) * 100 < -100
              ? 100
              : ((levSumValue / invest) * 100).toFixed(1)}
            %<span style={{ fontSize: "x-small", color: "gray" }}> ROI</span>
          </span>
          <br />
          <span style={{ fontSize: "large", color: "#d0d0d02c" }}>$</span>
          <span style={{ color: "#d0d0d02c", fontSize: "x-large" }}>
            {invest.toLocaleString()}
            <span style={{ fontSize: "x-small", color: "gray" }}>
              {" "}
              Prev Equity
            </span>
          </span>
          <br />
          <span style={{ fontSize: "large", color: "#d0d0d0" }}>$</span>
          <span style={{ color: "#d0d0d0", fontSize: "x-large" }}>
            {(levSumValue + Number(invest)).toLocaleString()}
            <span style={{ fontSize: "x-small", color: "gray" }}>
              {" "}
              New Equity
            </span>
          </span>
          <hr className="solid" style={{ margin: "5px" }} />
          <span style={{ fontSize: "large" }}>
            {levSumValue > 0
              ? "+" + (levSumValue * localPrice).toLocaleString()
              : (levSumValue * localPrice).toLocaleString()}{" "}
            t
            <span style={{ fontSize: "x-small", color: "gray" }}>
              {" "}
              Profit/Loss
            </span>
          </span>
          <br />

          <span style={{ color: "#d0d0d02c", fontSize: "large" }}>
            {(invest * localPrice).toLocaleString()}
            <span style={{ fontSize: "small", color: "gray" }}> t</span>
            <span style={{ fontSize: "x-small", color: "gray" }}>
              {" "}
              Prev Equity
            </span>
          </span>
          <br />
          <span style={{ color: "#d0d0d0", fontSize: "large" }}>
            {(invest * localPrice + levSumValue * localPrice).toLocaleString()}
            <span style={{ fontSize: "small", color: "gray" }}> t</span>
            <span style={{ fontSize: "x-small", color: "gray" }}>
              {" "}
              New Equity
            </span>
          </span>
          <br />
          <span style={{ color: "gray", fontSize: "small" }}>
            {(invest / enterPrice).toFixed(6)} ₿
            <span style={{ fontSize: "x-small", color: "gray" }}>
              {" "}
              Tokens Recieved
            </span>
          </span>
          <br />

          <hr className="solid" style={{ margin: "5px" }} />

          <span style={{ fontSize: "medium", color: "gray" }}>
            <span>
              profit after{" "}
              <span style={{ fontSize: "large", color: "#d0d0d0" }}>
                {compoundTrades}{" "}
              </span>
              compound trades:
            </span>
            <br />
            <span style={{ fontSize: "large", color: "#8a7028ff" }}>
              $
              {compoundCalc().toLocaleString("en-US", {
                maximumFractionDigits: 0,
              })}
            </span>
            <br />
            <span style={{ fontSize: "medium", color: "gray" }}>
              {(compoundCalc() * localPrice).toLocaleString("en-US", {
                maximumFractionDigits: 0,
              })}{" "}
              t
            </span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default Spot;

// $400 x  (1.075)^20

//(Number(invest) * (1 + Number(percentPrice) / 100)) ^ Number(compoundTrades)
