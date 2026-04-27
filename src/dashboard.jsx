import React, { useEffect, useState } from "react";
import {
  DEFAULT_CATEGORY_BUDGET_LIST,
  EXPENSES_DB_KEY,
  EXPENSES_DB_VERSION,
  EXPENSES_DB_VERSION_KEY,
  buildEqualSplit,
  categoryLabel,
  expenseTypeToDescription,
  formatCurrency,
  formatShortDate,
  formatTableAmount,
  getEffectiveExpenseAmount,
  isInCurrentMonth,
  normalizeCategory,
  normalizeDbShape,
  readJsonFromStorage,
  transactionSortValue,
  writeLocalDb
} from "./utils.js";

// Dashboard page with summary cards, transaction table, add-expense modal,
// and the "Edit Categories" modal to add, rename, change budgets, or remove categories.
// Replaces the legacy dashboard.ts/dashboard.js implementation.
export function DashboardPage() {
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
  // State for the "Edit Categories" modal: add new rows + edit existing name/budget.
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ categoryName: "", categoryBudget: "" });
  // Draft values per existing category key (for rename and budget changes).
  const [categoryRowDrafts, setCategoryRowDrafts] = useState({});
  const [categoryMessage, setCategoryMessage] = useState("");
  const [categoryMessageType, setCategoryMessageType] = useState("");

  useEffect(() => {
    async function loadDb() {
      // Prefer the saved local expense database, but seed it from expenses.json on first load.
      const localDbVersion = localStorage.getItem(EXPENSES_DB_VERSION_KEY);
      const localDb = localDbVersion === EXPENSES_DB_VERSION ? readJsonFromStorage(EXPENSES_DB_KEY, null) : null;

      if (localDb && Array.isArray(localDb.transactions)) {
        setDb(normalizeDbShape(localDb));
        return;
      }

      try {
        const response = await fetch("/expenses.json", { cache: "no-store" });
        const data = await response.json();
        const normalized = normalizeDbShape(data);
        writeLocalDb(normalized);
        setDb(normalized);
      } catch (error) {
        setDb(normalizeDbShape({
          monthlyIncome: 0,
          categoryBudget2: DEFAULT_CATEGORY_BUDGET_LIST.map((item) => ({ ...item })),
          startingBalance: 0,
          transactions: []
        }));
      }
    }

    loadDb();
  }, []);

  function getTotalWithTip() {
    // Adds tip on top of the entered base amount.
    const baseAmount = Number(formData.baseAmount);
    const tipPercent = Number(formData.tipPercent || 0);
    if (!Number.isFinite(baseAmount) || baseAmount <= 0) {
      return 0;
    }
    return baseAmount + (baseAmount * Math.max(0, tipPercent) / 100);
  }

  function resetForm() {
    // Clears the form after submit or modal close.
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
    // Handles both text inputs and the split-expense checkbox.
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
      // The dashboard stores the per-person value for shared expenses.
      effectiveAmount = splitDetails.eachAmount;
    }

    const splitTag = formData.isSplitExpense ? ` (Split bill: ${splitDetails.splitCount} people)` : "";
    const description = note
      ? `${expenseTypeToDescription(expenseType)}${splitTag} - ${note}`
      : `${expenseTypeToDescription(expenseType)}${splitTag}`;

    const nextDb = {
      ...db,
      transactions: [
        // Store the newest expense at the top of the transaction list.
        {
          date: new Date().toISOString().slice(0, 10),
          createdAt: new Date().toISOString(),
          description,
          category: normalizeCategory(expenseType, db.categoryBudget2),
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

  function closeCategoryModal() {
    setShowCategoryModal(false);
    setCategoryForm({ categoryName: "", categoryBudget: "" });
    setCategoryRowDrafts({});
    setCategoryMessage("");
    setCategoryMessageType("");
  }

  function openCategoryModal() {
    if (db) {
      const next = {};
      for (const { category, budget } of db.categoryBudget2) {
        next[category] = {
          name: category,
          budget: String(Number(budget) || 0)
        };
      }
      setCategoryRowDrafts(next);
    }
    setCategoryMessage("");
    setCategoryMessageType("");
    setShowCategoryModal(true);
  }

  function patchCategoryRowDraft(categoryKey, updates, fallbacks) {
    setCategoryRowDrafts((prev) => {
      const base = prev[categoryKey] ?? {
        name: fallbacks.name,
        budget: fallbacks.budget
      };
      return { ...prev, [categoryKey]: { ...base, ...updates } };
    });
  }

  function handleCategoryFormChange(event) {
    const { name, value } = event.target;
    setCategoryForm((current) => ({ ...current, [name]: value }));
  }

  function handleDeleteCategory(categoryName) {
    if (!db) {
      return;
    }
    const nextList = db.categoryBudget2.filter(
      (item) => item.category !== categoryName
    );
    const nextDb = { ...db, categoryBudget2: nextList };
    writeLocalDb(nextDb);
    setDb(nextDb);
    setCategoryRowDrafts((prev) => {
      const next = { ...prev };
      delete next[categoryName];
      return next;
    });
    // Clear the expense-type selection if it referenced the deleted category.
    if (formData.expenseType === categoryName) {
      setFormData((current) => ({ ...current, expenseType: "" }));
    }
  }

  function handleUpdateCategory(oldKey) {
    if (!db) {
      return;
    }
    const draft = categoryRowDrafts[oldKey];
    if (!draft) {
      return;
    }
    const rawName = String(draft.name || "").trim();
    const newKey = rawName.toLowerCase();
    const budget = Number(draft.budget);

    if (!rawName || !Number.isFinite(budget) || budget <= 0) {
      setCategoryMessage("Each category needs a name and a budget greater than zero.");
      setCategoryMessageType("error");
      return;
    }

    if (newKey !== oldKey) {
      const nameTaken = db.categoryBudget2.some(
        (item) => item.category === newKey && item.category !== oldKey
      );
      if (nameTaken) {
        setCategoryMessage("A category with that name already exists.");
        setCategoryMessageType("error");
        return;
      }
    }

    const nextList = db.categoryBudget2.map((item) =>
      item.category === oldKey ? { category: newKey, budget } : item
    );
    const nextTransactions =
      newKey !== oldKey
        ? db.transactions.map((t) =>
            t.category === oldKey ? { ...t, category: newKey } : t
          )
        : db.transactions;

    const nextDb = {
      ...db,
      categoryBudget2: nextList,
      transactions: nextTransactions
    };
    writeLocalDb(nextDb);
    setDb(nextDb);

    setCategoryRowDrafts((prev) => {
      const next = { ...prev };
      delete next[oldKey];
      next[newKey] = { name: newKey, budget: String(budget) };
      return next;
    });

    if (formData.expenseType === oldKey) {
      setFormData((current) => ({ ...current, expenseType: newKey }));
    }

    setCategoryMessage("Category updated.");
    setCategoryMessageType("success");
  }

  function handleAddCategory(event) {
    event.preventDefault();
    if (!db) {
      return;
    }

    const rawName = String(categoryForm.categoryName || "").trim();
    const name = rawName.toLowerCase();
    const budget = Number(categoryForm.categoryBudget);

    if (!rawName || !Number.isFinite(budget) || budget <= 0) {
      setCategoryMessage("Please fill all fields with a valid amount.");
      setCategoryMessageType("error");
      return;
    }

    if (db.categoryBudget2.some((item) => item.category === name)) {
      setCategoryMessage("Category already exists.");
      setCategoryMessageType("error");
      return;
    }

    const nextDb = {
      ...db,
      // Newest categories appear first to match the prior dashboard.js behavior.
      categoryBudget2: [{ category: name, budget }, ...db.categoryBudget2]
    };
    writeLocalDb(nextDb);
    setDb(nextDb);
    setCategoryForm({ categoryName: "", categoryBudget: "" });
    setCategoryRowDrafts((prev) => ({
      ...prev,
      [name]: { name, budget: String(budget) }
    }));
    setCategoryMessage("Category added successfully.");
    setCategoryMessageType("success");
    setTimeout(closeCategoryModal, 500);
  }

  if (!db) {
    // Shows a simple loading state while dashboard data is prepared.
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

  const categoryBudgetList = Array.isArray(db.categoryBudget2) ? db.categoryBudget2 : [];
  const totalBudget = categoryBudgetList.reduce(
    (sum, item) => sum + Number(item.budget || 0),
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
            <div>
              <button type="button" className="btn-edit-categories" onClick={openCategoryModal}>
                Categories
              </button>
              <button type="button" className="btn-add-expense" onClick={() => setShowModal(true)}>
                Add Expense
              </button>
            </div>
          </div>

          <div className="cards">
            <div className="card">
              <h3>Monthly Balance</h3>
              <p>{formatCurrency(totalBalance)}</p>
            </div>
            <div className="card">
              <h3>Monthly Income</h3>
              <p>{formatCurrency(monthlyIncome)}</p>
            </div>
            <div className="card">
              <h3>Monthly Spend</h3>
              <p>{formatCurrency(monthlySpend)}</p>
            </div>
            <div className="card">
              <h3>Budget Remaining</h3>
              <p>{formatCurrency(budgetRemaining)}</p>
            </div>
          </div>

          <div className="section">
            <h2>Budget Progress</h2>
            <div>
              {categoryBudgetList.map(({ category, budget }) => {
                const numericBudget = Number(budget || 0);
                const used = monthlyTransactions
                  .filter((item) => getEffectiveExpenseAmount(item) < 0 && item.category === category)
                  .reduce((sum, item) => sum + Math.abs(getEffectiveExpenseAmount(item)), 0);
                const usedPercent = numericBudget > 0 ? Math.min(100, (used / numericBudget) * 100) : 0;

                return (
                  <div className="budget-item" key={category}>
                    <p>
                      {categoryLabel(category)} Used: <strong>{formatCurrency(used)} ({Math.round(usedPercent)}%)</strong>
                      {" "}• Budget: <strong>{formatCurrency(numericBudget)}</strong>
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
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Category</th>
                    <th>Amount</th>
                  </tr>
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
                    <tr>
                      <td colSpan="4">No transactions for this month.</td>
                    </tr>
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
                {categoryBudgetList.map(({ category }) => (
                  <option key={category} value={category}>{categoryLabel(category)}</option>
                ))}
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
            <div className="form-group total-preview">
              <span>Total With Tip:</span>
              <strong>{formatCurrency(totalWithTip)}</strong>
            </div>
            <div className="form-group split-toggle-row">
              <label>
                <input type="checkbox" id="isSplitExpense" name="isSplitExpense" checked={formData.isSplitExpense} onChange={handleInputChange} />
                {" "}Split this expense
              </label>
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

      <div
        className={`modal-overlay${showCategoryModal ? " active" : ""}`}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            closeCategoryModal();
          }
        }}
      >
        <div className="modal">
          <button type="button" className="modal-close" aria-label="Close" onClick={closeCategoryModal}>&times;</button>
          <h2>Edit Categories</h2>
          <p className="category-modal-hint">Change the name or monthly budget, then save. Renaming a category updates past transactions in that category.</p>
          <form onSubmit={handleAddCategory}>
            <div id="categoryBudgetListEdit">
              {categoryBudgetList.map(({ category, budget }) => {
                const defaultBudget = String(Number(budget) || 0);
                const draft = categoryRowDrafts[category] ?? {
                  name: category,
                  budget: defaultBudget
                };
                return (
                  <div className="category-item category-item-editable" key={category}>
                    <div className="category-editable-fields">
                      <div className="form-group category-field-name">
                        <label htmlFor={`cat-name-${category}`}>Category</label>
                        <input
                          id={`cat-name-${category}`}
                          type="text"
                          maxLength="50"
                          value={draft.name}
                          onChange={(event) => patchCategoryRowDraft(
                            category,
                            { name: event.target.value },
                            { name: category, budget: defaultBudget }
                          )}
                        />
                      </div>
                      <div className="form-group category-field-budget">
                        <label htmlFor={`cat-budget-${category}`}>Monthly budget ($)</label>
                        <input
                          id={`cat-budget-${category}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft.budget}
                          onChange={(event) => patchCategoryRowDraft(
                            category,
                            { budget: event.target.value },
                            { name: category, budget: defaultBudget }
                          )}
                        />
                      </div>
                    </div>
                    <div className="category-row-actions">
                      <button
                        type="button"
                        className="btn-save-category"
                        onClick={() => handleUpdateCategory(category)}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="delete-btn"
                        onClick={() => handleDeleteCategory(category)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="form-group">
              <label htmlFor="categoryNameInput">Add a category</label>
              <div className="categoryAdditionInput">
                <input
                  type="text"
                  id="categoryNameInput"
                  name="categoryName"
                  maxLength="50"
                  placeholder="Category name"
                  value={categoryForm.categoryName}
                  onChange={handleCategoryFormChange}
                />
                <input
                  type="number"
                  id="categoryBudgetInput"
                  name="categoryBudget"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={categoryForm.categoryBudget}
                  onChange={handleCategoryFormChange}
                />
              </div>
            </div>
            <p className={`auth-message ${categoryMessageType}`} aria-live="polite">{categoryMessage}</p>
            <div className="modal-actions">
              <button type="button" className="btn-cancel" onClick={closeCategoryModal}>Cancel</button>
              <button type="submit" className="btn-submit">Add category</button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
