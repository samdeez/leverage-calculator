import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { ToastProvider } from "../../context/Toast";
import TradeCalculator from "./TradeCalculator";

const renderCalc = (mode) =>
  render(
    <ToastProvider>
      <TradeCalculator mode={mode} active />
    </ToastProvider>
  );

beforeEach(() => localStorage.clear());

describe("Spot calculator inputs (no jumping)", () => {
  it("types a negative decimal % change character by character", () => {
    renderCalc("spot");
    const pct = screen.getByLabelText("% Change");
    const sell = screen.getByLabelText("Sell Price");
    userEvent.type(pct, "-5.5");
    expect(pct).toHaveValue("-5.5");
    expect(sell).toHaveValue("83.16");
  });

  it("types a sell price without the % field rewriting it", () => {
    renderCalc("spot");
    const pct = screen.getByLabelText("% Change");
    const sell = screen.getByLabelText("Sell Price");
    userEvent.type(sell, "100.5");
    expect(sell).toHaveValue("100.5");
    expect(pct).toHaveValue("14.2");
    // Switching back to % keeps sell derived and stable.
    userEvent.clear(pct);
    userEvent.type(pct, "10");
    expect(pct).toHaveValue("10");
    expect(sell).toHaveValue("96.8");
  });

  it("formats large sell prices with separators while typing", () => {
    renderCalc("spot");
    const sell = screen.getByLabelText("Sell Price");
    userEvent.type(sell, "12345");
    expect(sell).toHaveValue("12,345");
  });

  it("steps values with the arrow keys", () => {
    renderCalc("spot");
    const pct = screen.getByLabelText("% Change");
    fireEvent.keyDown(pct, { key: "ArrowUp" });
    expect(pct).toHaveValue("0.5");
    fireEvent.keyDown(pct, { key: "ArrowUp", shiftKey: true });
    expect(pct).toHaveValue("5.5");
    fireEvent.keyDown(pct, { key: "ArrowDown", altKey: true });
    expect(pct).toHaveValue("5.45");
    const amount = screen.getByLabelText("Buy Amount");
    fireEvent.keyDown(amount, { key: "ArrowDown" });
    expect(amount).toHaveValue("190");
  });

  it("shows compound profit", () => {
    renderCalc("spot");
    userEvent.type(screen.getByLabelText("Buy Amount"), "{selectall}1000");
    userEvent.type(screen.getByLabelText("% Change"), "5");
    userEvent.type(screen.getByLabelText("Compound Trades"), "{selectall}3");
    expect(screen.getByText("$158")).toBeInTheDocument();
  });
});

describe("Leverage calculator", () => {
  it("shows short liquidation from entry and leverage", () => {
    renderCalc("leverage");
    userEvent.type(screen.getByLabelText("Entry Price"), "12000");
    expect(screen.getByText(/14,000 \$/)).toBeInTheDocument();
    userEvent.type(screen.getByLabelText("Leverage"), "{selectall}2");
    expect(screen.getByText(/18,000 \$/)).toBeInTheDocument();
  });

  it("toggles short with the x shortcut and recomputes pnl", () => {
    renderCalc("leverage");
    userEvent.type(screen.getByLabelText("Collateral"), "100");
    userEvent.type(screen.getByLabelText("Entry Price"), "100");
    userEvent.type(screen.getByLabelText("Fees"), "{selectall}0");
    userEvent.type(screen.getByLabelText("Funding Rate"), "{selectall}0");
    userEvent.type(screen.getByLabelText("Exit Price"), "80");
    expect(screen.getByText("LIQUIDATED")).toBeInTheDocument(); // long liq ≈ 83.33
    fireEvent.keyDown(document.body, { key: "x" });
    expect(screen.queryByText("LIQUIDATED")).not.toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument(); // +$120 on a 6x short
  });
});
