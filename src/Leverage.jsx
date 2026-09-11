import React, { useState } from "react";
import { NumericFormat } from "react-number-format";

const Leverage = () => {
  const [feesPercent, setFeesPercent] = useState(0.2);
  const [localPrice, setlocalPrice] = useState(200000);
  const [invest, setInvest] = useState("");
  const [enterPrice, setEnterPrice] = useState("");
  const [exitPrice, setExitPrice] = useState("");
  const [leverage, setLeverage] = useState(6);
  const [percentPrice, setPercentPrice] = useState(0);
  const [fundingHour, setFundingHour] = useState(0.007);
  const [hours, setHours] = useState(48);

  const handleFeesPercentChange = (event) => {
    setFeesPercent(event.target.value);
  };

  const handleLocalPriceChange = (event) => {
    setlocalPrice(event.target.value);
  };

  const handleEnterPriceChange = (event) => {
    let percentChange = 0;
    if (event.target.value && Number(event.target.value) !== 0) {
      percentChange =
        ((exitPrice - event.target.value) / event.target.value) * 100;
    }
    setPercentPrice(percentChange);
    setEnterPrice(event.target.value);
  };

  const handleExitPriceChange = (event) => {
    let percentChange = 0;
    if (enterPrice && Number(enterPrice) !== 0) {
      percentChange = ((event.target.value - enterPrice) / enterPrice) * 100;
    }
    setPercentPrice(percentChange);
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
    const entPrice = Number(enterPrice);
    let pnl = (0).toFixed(2);

    if (entPrice !== 0 && !isNaN(entPrice)) {
      pnl = (
        ((Number(invest) * Number(leverage)) / entPrice) *
        (Number(exitPrice) - entPrice)
      ).toFixed(2);
    }

    let fees = (Number(invest) * Number(leverage) * Number(feesPercent)) / 100;
    let funding = (((invest * leverage * fundingHour) / 100) * hours).toFixed(
      3
    );

    let result = pnl - fees - funding;

    return result;
  }

  function shortCalc() {
    let shortLiq = enterPrice / leverage;
    shortLiq += +enterPrice;

    return shortLiq.toLocaleString();
  }

  const levValue = levCalc();

  return (
    <div className="container">
      <div className="insidecol">
        <h2 style={{ color: "gray", textAlign: "center" }}>
          input leverage trade:
        </h2>
        <hr style={{ marginBottom: "30px" }} />
        <div className="inputContainer">
          <div className="inputLabel">Collateral:</div>
          <NumericFormat
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
          <div className="inputLabel">Entry Price:</div>
          <NumericFormat
            thousandSeparator=","
            value={enterPrice}
            onValueChange={(values) => handleEnterPriceChange({ target: { value: values.value } })}
            className="input"
            placeholder="0"
          />
          <div className="inputSuffix">$</div>
        </div>

        <div className="inputContainer">
          <div className="inputLabel">Exit Price:</div>
          <NumericFormat
            thousandSeparator=","
            value={exitPrice}
            onValueChange={(values) => handleExitPriceChange({ target: { value: values.value } })}
            className="input"
            placeholder="0"
          />
          <div className="inputSuffix">$</div>
        </div>

        <div className="inputContainer">
          <div className="inputLabel">USD Price:</div>
          <NumericFormat
            thousandSeparator=","
            value={localPrice}
            onValueChange={(values) => handleLocalPriceChange({ target: { value: values.value } })}
            className="input"
            placeholder="0"
          />
          <div className="inputSuffix">T</div>
        </div>

        <div className="inputContainer">
          <div className="inputLabel">Leverage:</div>
          <NumericFormat
            thousandSeparator=","
            value={leverage}
            onValueChange={(values) => handleLeverageChange({ target: { value: values.value } })}
            className="input"
            placeholder="0"
          />
          <div className="inputSuffix">x</div>
        </div>

        <div className="inputContainer">
          <div className="inputLabel">Fees:</div>
          <NumericFormat
            thousandSeparator=","
            value={feesPercent}
            onValueChange={(values) => handleFeesPercentChange({ target: { value: values.value } })}
            className="input"
            placeholder="0"
          />
          <div className="inputSuffix">%</div>
        </div>

        <div className="inputContainer">
          <div className="inputLabel">% Change:</div>
          <NumericFormat
            thousandSeparator=","
            value={percentPrice}
            onValueChange={(values) => handlePercentPriceChange({ target: { value: values.value } })}
            className="input"
            placeholder="0%"
          />
          <div className="inputSuffix">%</div>
        </div>

        <div className="inputContainer">
          <div className="inputLabel">Funding Rate/h:</div>
          <NumericFormat
            thousandSeparator=","
            value={fundingHour}
            onValueChange={(values) => handleFundingHour({ target: { value: values.value } })}
            className="input"
            placeholder="$"
          />
          <div className="inputSuffix">%</div>
        </div>

        <div className="inputContainer">
          <div className="inputLabel">Hours Open:</div>
          <NumericFormat
            thousandSeparator=","
            value={hours}
            onValueChange={(values) => handleHours({ target: { value: values.value } })}
            className="input"
            placeholder="h"
          />
          <div className="inputSuffix">h</div>
        </div>

        <div className="note">
          <p>- Don't get greedy! Take profits while you can!</p>
          <p>- WAGMI 2024/2025</p>
        </div>
      </div>

      <div className="insidecol">
        <p className="outputLabel">P&L:</p>
        <p
          className="resultgrid"
          style={{
            backgroundColor: "#2f2f2f",
            background:
              levValue < 0
                ? "linear-gradient(45deg, black, #4f2f2f)"
                : "linear-gradient(45deg, black, darkslategray)",
            color: levValue < 0 ? "firebrick" : "seagreen",
          }}
        >
          {levValue > 0
            ? "+" + levValue.toLocaleString()
            : levValue.toLocaleString()}{" "}
          $
          <br />
          {(levValue * localPrice).toLocaleString()} T
          <br />
          <span style={{ color: "gray", fontSize: "medium" }}>
            Funding: -$
            {(((invest * leverage * fundingHour) / 100) * hours).toFixed(3)} /
            Fees: -$
            {(
              (Number(invest) * Number(leverage) * Number(feesPercent)) /
              100
            ).toFixed(3)}
          </span>
          <br />
          <span style={{ fontSize: "medium" }}>
            {" "}
            ROI: {(levValue + Number(invest)).toLocaleString()}${" ("}
            {((levValue + Number(invest)) / Number(invest)) * 100 < -100
              ? 100
              : ((levValue / invest) * 100).toFixed(1)}
            %{")"}
          </span>
        </p>
        <div className="reswrapper">
          <div className="reswrapperinner">
            <p className="outputLabel">Entery & Exit:</p>
            <div className="resultgrid">
              <span style={{ fontSize: "small", color: "gray" }}>{"IN:"}</span>{" "}
              <br />
              <span style={{ color: "#d0d0d0" }}>
                {(enterPrice * 1).toLocaleString()} $
              </span>
              <br />
              <hr className="solid" style={{ margin: "5px" }} />
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
                  {percentPrice > 0
                    ? "+" + percentPrice.toFixed(2)
                    : percentPrice.toFixed(2)}
                  %
                </span>
              </span>
            </div>
          </div>
          <div className="reswrapperinner">
            <p className="outputLabel">Liquid price:</p>
            <div
              className="resultgrid"
              style={{
                color: "goldenrod",
              }}
            >
              <span style={{ fontSize: "small", color: "gray" }}>Long ⬆</span>
              <br />
              <span>
                {(enterPrice - enterPrice / leverage).toLocaleString()} $
              </span>
              <br />
              <hr className="solid" style={{ margin: "5px" }} />
              <span style={{ fontSize: "small", color: "gray" }}>Short ⬇</span>
              <br />
              <span>{shortCalc()} $</span>
            </div>
          </div>
        </div>

        <p className="outputLabel">Margin:</p>

        <div className="pl">
          <p className="resultgrid" style={{ color: "burlywood" }}>
            {(invest * 1).toLocaleString()} $
            <br />
            {(invest / enterPrice).toFixed(6)} ₿
            <br />
            {(invest * localPrice).toLocaleString()} T
          </p>
          <p className="outputLabel">Size:</p>
          <p className="resultgrid" style={{ color: "burlywood" }}>
            {(invest * leverage).toLocaleString()} $
            <br />
            {((invest / enterPrice) * leverage).toFixed(6)} ₿
            <br />
            {(invest * leverage * localPrice).toLocaleString()} T
          </p>
        </div>
      </div>
    </div>
  );
};

export default Leverage;
