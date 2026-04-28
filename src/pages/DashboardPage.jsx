import React, { useEffect, useState } from "react";
import { BUDGET_CATEGORY_ORDER } from "../utils/constants";
import { categoryLabel, buildEqualSplit, expenseTypeToDescription, getEffectiveExpenseAmount, isInCurrentMonth, normalizeCategory, transactionSortValue } from "../utils/dashboard";
import { formatCurrency, formatShortDate, formatTableAmount } from "../utils/format";
import { loadDashboardDbFromStorageOrSeed, writeLocalDb } from "../utils/storage";

export default function DashboardPage() {
  const [db, setDb] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [formData, setFormData] = useState({
    expenseType: "",
    baseAmount: "",
    tipPercent: "0",
    expenseNote: "",
    isSplitExpense: false,
    splitCount: "2"
  });

  useEffect(() => {
    async function loadDb() {
      const normalizedDb = await loadDashboardDbFromStorageOrSeed();
      setDb(normalizedDb);
    }
    loadDb();
  }, []);

  function getTotalWithTip() {
    const baseAmount = Number(formData.baseAmount);
    const tipPercent = Number(formData.tipPercent || 0);
    if (!Number.isFinite(baseAmount) || baseAmount <= 0) {
      return 0;
    }
    return baseAmount + (baseAmount * Math.max(0, tipPercent) / 100);
  }

  function resetForm() {
    setFormData({
      expenseType: "",
      baseAmount: "",
      tipPercent: "0",
      expenseNote: "",
      isSplitExpense: false,
      splitCount: "2"
    });
    setMessage("");
    setMessageType("");
  }

  function closeModal() {
    setShowModal(false);
    resetForm();
  }

  function handleInputChange(event) {
    const { name, value, type, checked } = event.target;
    setFormData((current) => {
      const next = {
        ...current,
        [name]: type === "checkbox" ? checked : value
      };
      if (name === "isSplitExpense" && !checked) {
        next.splitCount = "2";
      }
      return next;
    });
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!db) {
      return;
    }

    const expenseType = formData.expenseType;
    const baseAmount = Number(formData.baseAmount);
    const tipPercent = Number(formData.tipPercent || 0);
    const note = formData.expenseNote.trim();
    const totalAmount = getTotalWithTip();

    if (!expenseType || !Number.isFinite(baseAmount) || baseAmount <= 0) {
      setMessage("Please fill all fields with a valid amount.");
      setMessageType("error");
      return;
    }
    if (!Number.isFinite(tipPercent) || tipPercent < 0) {
      setMessage("Tip must be zero or a positive value.");
      setMessageType("error");
      return;
    }

    let splitDetails = [];
    let effectiveAmount = totalAmount;
    if (formData.isSplitExpense) {
      const splitCount = Number.parseInt(formData.splitCount, 10);
      if (!Number.isFinite(splitCount) || splitCount < 2) {
        setMessage("Split count must be at least 2.");
        setMessageType("error");
        return;
      }
      splitDetails = {
        splitCount,
        eachAmount: buildEqualSplit(splitCount, totalAmount)
      };
      effectiveAmount = splitDetails.eachAmount;
    }

    const splitTag = formData.isSplitExpense ? ` (Split bill: ${splitDetails.splitCount} people)` : "";
    const description = note
      ? `${expenseTypeToDescription(expenseType)}${splitTag} - ${note}`
      : `${expenseTypeToDescription(expenseType)}${splitTag}`;

    const nextDb = {
      ...db,
      transactions: [
        {
          date: new Date().toISOString().slice(0, 10),
          createdAt: new Date().toISOString(),
          description,
          category: normalizeCategory(expenseType),
          amount: -Math.abs(effectiveAmount),
          totalAmount: -Math.abs(totalAmount),
          type: "expense",
          baseAmount,
          tipPercent,
          paidBy: "self",
          splitBetween: splitDetails
        },
        ...db.transactions
      ]
    };

    writeLocalDb(nextDb);
    setDb(nextDb);
    setMessage("Expense added successfully.");
    setMessageType("success");
    setTimeout(() => {
      closeModal();
    }, 500);
  }

  if (!db) {
    return <main className="dashboard-main"><div className="dashboard-container"><p>Loading...</p></div></main>;
  }

  const monthlyTransactions = db.transactions.filter((item) => isInCurrentMonth(item.date));
  const sortedTransactions = [...monthlyTransactions].sort((a, b) => {
    const aKey = transactionSortValue(a);
    const bKey = transactionSortValue(b);
    if (aKey === bKey) {
      return 0;
    }
    return aKey < bKey ? 1 : -1;
  });

  const monthlyIncome = Number(db.monthlyIncome || 0);
  const monthlySpend = monthlyTransactions
    .filter((item) => getEffectiveExpenseAmount(item) < 0)
    .reduce((sum, item) => sum + Math.abs(getEffectiveExpenseAmount(item)), 0);

  const totalBudget = BUDGET_CATEGORY_ORDER.reduce(
    (sum, category) => sum + Number(db.categoryBudgets[category] || 0),
    0
  );

  const budgetRemaining = Math.max(0, totalBudget - monthlySpend);
  const totalBalance = monthlyIncome - monthlySpend;
  const totalWithTip = getTotalWithTip();
  const splitCount = Number.parseInt(formData.splitCount, 10);
  const splitPreview = !formData.isSplitExpense
    ? ""
    : (!Number.isFinite(splitCount) || splitCount < 2 || totalWithTip <= 0)
      ? "Enter how many people to split with."
      : `Auto split -> ${splitCount} people, each pays ${formatCurrency(buildEqualSplit(splitCount, totalWithTip))}`;

  return (
    <>
      <main className="dashboard-main">
        <div className="dashboard-container">
          <div className="dashboard-header">
            <h1>Dashboard</h1>
            <button type="button" className="btn-add-expense" onClick={() => setShowModal(true)}>
              Add Expense
            </button>
          </div>

          <div className="cards">
            <div className="card"><h3>Monthly Balance</h3><p>{formatCurrency(totalBalance)}</p></div>
            <div className="card"><h3>Monthly Income</h3><p>{formatCurrency(monthlyIncome)}</p></div>
            <div className="card"><h3>Monthly Spend</h3><p>{formatCurrency(monthlySpend)}</p></div>
            <div className="card"><h3>Budget Remaining</h3><p>{formatCurrency(budgetRemaining)}</p></div>
          </div>

          <div className="section">
            <h2>Budget Progress</h2>
            <div>
              {BUDGET_CATEGORY_ORDER.map((category) => {
                const budget = Number(db.categoryBudgets[category] || 0);
                const used = monthlyTransactions
                  .filter((item) => getEffectiveExpenseAmount(item) < 0 && item.category === category)
                  .reduce((sum, item) => sum + Math.abs(getEffectiveExpenseAmount(item)), 0);
                const usedPercent = budget > 0 ? Math.min(100, (used / budget) * 100) : 0;

                return (
                  <div className="budget-item" key={category}>
                    <p>
                      {categoryLabel(category)} Used: <strong>{formatCurrency(used)} ({Math.round(usedPercent)}%)</strong>
                      {" "}• Budget: <strong>{formatCurrency(budget)}</strong>
                    </p>
                    <div className="bar" style={{ "--progress": `${Math.round(usedPercent)}%` }}>
                      <div className="bar-fill"></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="section">
            <h2>Recent Transactions</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th></tr>
                </thead>
                <tbody>
                  {sortedTransactions.length > 0 ? (
                    sortedTransactions.map((item) => (
                      <tr key={`${item.createdAt}-${item.description}`}>
                        <td>{formatShortDate(item.date)}</td>
                        <td>{item.description}</td>
                        <td>{categoryLabel(item.category)}</td>
                        <td>{formatTableAmount(getEffectiveExpenseAmount(item))}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan="4">No transactions for this month.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      <div
        className={`modal-overlay${showModal ? " active" : ""}`}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            closeModal();
          }
        }}
      >
        <div className="modal">
          <button type="button" className="modal-close" aria-label="Close" onClick={closeModal}>&times;</button>
          <h2>Add Expense</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="expenseType">Expense Type</label>
              <select id="expenseType" name="expenseType" required value={formData.expenseType} onChange={handleInputChange}>
                <option value="">Select type...</option>
                <option value="rent">Rent</option><option value="groceries">Groceries</option><option value="utilities">Utilities</option>
                <option value="food">Food</option><option value="transport">Transport</option><option value="entertainment">Entertainment</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="baseAmount">Amount Before Tip ($)</label>
              <input type="number" id="baseAmount" name="baseAmount" min="0" step="0.01" placeholder="0.00" required value={formData.baseAmount} onChange={handleInputChange} />
            </div>
            <div className="form-group">
              <label htmlFor="tipPercent">Tip (%)</label>
              <input type="number" id="tipPercent" name="tipPercent" min="0" step="0.01" value={formData.tipPercent} onChange={handleInputChange} />
            </div>
            <div className="form-group">
              <label htmlFor="expenseNote">Note (Optional)</label>
              <input type="text" id="expenseNote" name="expenseNote" maxLength="120" placeholder="e.g. dinner with friends" value={formData.expenseNote} onChange={handleInputChange} />
            </div>
            <div className="form-group total-preview"><span>Total With Tip:</span><strong>{formatCurrency(totalWithTip)}</strong></div>
            <div className="form-group split-toggle-row">
              <label><input type="checkbox" id="isSplitExpense" name="isSplitExpense" checked={formData.isSplitExpense} onChange={handleInputChange} />{" "}Split this expense</label>
            </div>
            <div className={`split-section${formData.isSplitExpense ? "" : " hidden"}`}>
              <div className="form-group">
                <label htmlFor="splitCount">Split With (Auto-equal split)</label>
                <input type="number" id="splitCount" name="splitCount" min="2" step="1" value={formData.splitCount} placeholder="How many people" onChange={handleInputChange} />
              </div>
              <p className="split-preview">{splitPreview}</p>
            </div>
            <p className={`auth-message ${messageType}`} aria-live="polite">{message}</p>
            <div className="modal-actions">
              <button type="button" className="btn-cancel" onClick={closeModal}>Cancel</button>
              <button type="submit" className="btn-submit">Add Expense</button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
