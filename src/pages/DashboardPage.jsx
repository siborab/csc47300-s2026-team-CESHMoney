import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  createExpense,
  deleteCategory,
  deleteExpense,
  listCategories,
  listExpenses,
  saveCategory
} from "../api/spendwise";
import Spinner from "../components/Spinner";
import { SkeletonCard, SkeletonTable } from "../components/Skeleton";
import { useToast } from "../components/ToastProvider";
import { expenseRowToTransaction, categoryRowToBudgetEntry } from "../utils/dataAdapter";
import {
  buildEqualSplit,
  categoryLabel,
  expenseTypeToDescription,
  getEffectiveExpenseAmount,
  isInCurrentMonth,
  transactionSortValue
} from "../utils/dashboard";
import { formatCurrency, formatShortDate, formatTableAmount } from "../utils/format";
import { readSession } from "../utils/storage";

const EMPTY_FORM = {
  expenseType: "",
  baseAmount: "",
  tipPercent: "0",
  expenseNote: "",
  isSplitExpense: false,
  splitCount: "2",
  txType: "expense"
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const { toast, confirm } = useToast();
  const session = readSession();
  const user = session?.user;
  const userId = user?.id;

  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [categoryForm, setCategoryForm] = useState({ categoryName: "", categoryBudget: "" });
  const [categoryMessage, setCategoryMessage] = useState("");
  const [categoryMessageType, setCategoryMessageType] = useState("");

  useEffect(() => {
    if (!userId) {
      navigate("/signin");
    }
  }, [userId, navigate]);

  async function loadAll() {
    if (!userId) return;
    setLoading(true);
    setLoadError("");
    try {
      const [rawExpenses, rawCategories] = await Promise.all([
        listExpenses(userId),
        listCategories(userId)
      ]);
      setExpenses(rawExpenses.map(expenseRowToTransaction).filter(Boolean));
      setCategories(rawCategories.map(categoryRowToBudgetEntry));
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  function getTotalWithTip() {
    const baseAmount = Number(formData.baseAmount);
    const tipPercent = Number(formData.tipPercent || 0);
    if (!Number.isFinite(baseAmount) || baseAmount <= 0) return 0;
    return baseAmount + (baseAmount * Math.max(0, tipPercent) / 100);
  }

  function resetForm() {
    setFormData(EMPTY_FORM);
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
      const next = { ...current, [name]: type === "checkbox" ? checked : value };
      if (name === "isSplitExpense" && !checked) {
        next.splitCount = "2";
      }
      return next;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!userId) return;

    const expenseType = formData.expenseType;
    const baseAmount = Number(formData.baseAmount);
    if (!expenseType || !Number.isFinite(baseAmount) || baseAmount <= 0) {
      setMessage("Please fill all fields with a valid amount.");
      setMessageType("error");
      return;
    }

    setSubmitting(true);
    setMessage("");
    setMessageType("");
    try {
      const note = formData.expenseNote.trim();
      const splitTag = formData.isSplitExpense ? ` (Split bill: ${formData.splitCount} people)` : "";
      const baseLabel = expenseTypeToDescription(expenseType);
      const description = note ? `${baseLabel}${splitTag} - ${note}` : `${baseLabel}${splitTag}`;

      await createExpense({
        userId,
        date: new Date().toISOString().slice(0, 10),
        description,
        category: expenseType,
        baseAmount,
        tipPercent: Number(formData.tipPercent || 0),
        type: formData.txType,
        isSplit: formData.isSplitExpense,
        splitCount: formData.isSplitExpense ? Number(formData.splitCount) : null
      });
      await loadAll();
      toast.success(formData.txType === "income" ? "Income recorded." : "Expense added.");
      closeModal();
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteExpense(id) {
    const ok = await confirm({
      title: "Delete this transaction?",
      message: "This action cannot be undone.",
      confirmLabel: "Delete",
      danger: true
    });
    if (!ok) return;
    try {
      await deleteExpense(id);
      setExpenses((current) => current.filter((row) => row.id !== id));
      toast.success("Transaction deleted.");
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function handleAddCategory(event) {
    event.preventDefault();
    if (!userId) return;
    const name = String(categoryForm.categoryName || "").trim().toLowerCase();
    const budget = Number(categoryForm.categoryBudget);
    if (!name || !Number.isFinite(budget) || budget <= 0) {
      setCategoryMessage("Please fill name and a positive budget.");
      setCategoryMessageType("error");
      return;
    }
    try {
      await saveCategory({ userId, name, budget });
      setCategoryForm({ categoryName: "", categoryBudget: "" });
      setCategoryMessage("");
      setCategoryMessageType("");
      await loadAll();
      toast.success(`Category "${name}" saved.`);
    } catch (error) {
      setCategoryMessage(error.message);
      setCategoryMessageType("error");
      toast.error(error.message);
    }
  }

  async function handleDeleteCategory(id) {
    const ok = await confirm({
      title: "Delete this category?",
      message: "Transactions in this category will keep their data but will fall back to 'Other'.",
      confirmLabel: "Delete",
      danger: true
    });
    if (!ok) return;
    try {
      await deleteCategory(id);
      await loadAll();
      toast.success("Category removed.");
    } catch (error) {
      toast.error(error.message);
    }
  }

  const monthlyTransactions = useMemo(
    () => expenses.filter((item) => isInCurrentMonth(item.date)),
    [expenses]
  );
  const sortedTransactions = useMemo(
    () =>
      [...monthlyTransactions].sort((a, b) => {
        const aKey = transactionSortValue(a);
        const bKey = transactionSortValue(b);
        if (aKey === bKey) return 0;
        return aKey < bKey ? 1 : -1;
      }),
    [monthlyTransactions]
  );

  const monthlyIncome = monthlyTransactions
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + Math.abs(getEffectiveExpenseAmount(item)), 0);
  const monthlySpend = monthlyTransactions
    .filter((item) => item.type !== "income" && getEffectiveExpenseAmount(item) < 0)
    .reduce((sum, item) => sum + Math.abs(getEffectiveExpenseAmount(item)), 0);
  const totalBudget = categories.reduce((sum, item) => sum + Number(item.budget || 0), 0);
  const budgetRemaining = Math.max(0, totalBudget - monthlySpend);
  const totalBalance = monthlyIncome - monthlySpend;
  const totalWithTip = getTotalWithTip();
  const splitCount = Number.parseInt(formData.splitCount, 10);
  const splitPreview = !formData.isSplitExpense
    ? ""
    : !Number.isFinite(splitCount) || splitCount < 2 || totalWithTip <= 0
      ? "Enter how many people to split with."
      : `Auto split -> ${splitCount} people, each pays ${formatCurrency(buildEqualSplit(splitCount, totalWithTip))}`;

  if (!userId) {
    return null;
  }

  return (
    <>
      <main className="dashboard-main">
        <div className="dashboard-container">
          <div className="dashboard-header">
            <h1>Dashboard</h1>
            <div>
              <Link to={`/users/${userId}`} className="btn-edit-categories" style={{ textDecoration: "none" }}>
                My Profile
              </Link>
              <button type="button" className="btn-edit-categories" onClick={() => setShowCategoryModal(true)}>
                Categories
              </button>
              <button type="button" className="btn-add-expense" onClick={() => setShowModal(true)}>
                Add Expense
              </button>
            </div>
          </div>

          {loadError && <p className="auth-message error">{loadError}</p>}

          {loading ? (
            <>
              <div className="cards">
                <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
              </div>
              <div className="section">
                <h2>Budget Progress</h2>
                <SkeletonTable rows={4} cols={2} />
              </div>
              <div className="section">
                <h2>Recent Transactions</h2>
                <SkeletonTable rows={4} cols={4} />
              </div>
            </>
          ) : (
            <>
              <div className="cards">
                <div className="card"><h3>Monthly Balance</h3><p>{formatCurrency(totalBalance)}</p></div>
                <div className="card"><h3>Monthly Income</h3><p>{formatCurrency(monthlyIncome)}</p></div>
                <div className="card"><h3>Monthly Spend</h3><p>{formatCurrency(monthlySpend)}</p></div>
                <div className="card"><h3>Budget Remaining</h3><p>{formatCurrency(budgetRemaining)}</p></div>
              </div>

              <div className="section">
                <h2>Budget Progress</h2>
                <div>
                  {categories.length === 0 && <p>No categories yet. Open "Categories" to add some.</p>}
                  {categories.map(({ id, category, budget }) => {
                    const used = monthlyTransactions
                      .filter((item) => getEffectiveExpenseAmount(item) < 0 && item.category === category)
                      .reduce((sum, item) => sum + Math.abs(getEffectiveExpenseAmount(item)), 0);
                    const usedPercent = budget > 0 ? Math.min(100, (used / budget) * 100) : 0;
                    return (
                      <div className="budget-item" key={id || category}>
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
                      <tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th><th></th></tr>
                    </thead>
                    <tbody>
                      {sortedTransactions.length > 0 ? (
                        sortedTransactions.map((item) => (
                          <tr key={item.id}>
                            <td>{formatShortDate(item.date)}</td>
                            <td>{item.description}</td>
                            <td>{categoryLabel(item.category)}</td>
                            <td>{formatTableAmount(getEffectiveExpenseAmount(item))}</td>
                            <td>
                              <button type="button" className="delete-btn" onClick={() => handleDeleteExpense(item.id)}>
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan="5">No transactions for this month.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      <div
        className={`modal-overlay${showModal ? " active" : ""}`}
        onClick={(event) => { if (event.target === event.currentTarget) closeModal(); }}
      >
        <div className="modal">
          <button type="button" className="modal-close" aria-label="Close" onClick={closeModal}>&times;</button>
          <h2>Add Transaction</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="txType">Type</label>
              <select id="txType" name="txType" value={formData.txType} onChange={handleInputChange}>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="expenseType">Category</label>
              <select id="expenseType" name="expenseType" required value={formData.expenseType} onChange={handleInputChange}>
                <option value="">Select category...</option>
                {categories.map(({ id, category }) => (
                  <option key={id || category} value={category}>{categoryLabel(category)}</option>
                ))}
                {formData.txType === "income" && <option value="income">Income</option>}
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
            {formData.txType === "expense" && (
              <>
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
              </>
            )}
            <p className={`auth-message ${messageType}`} aria-live="polite">{message}</p>
            <div className="modal-actions">
              <button type="button" className="btn-cancel" onClick={closeModal}>Cancel</button>
              <button type="submit" className="btn-submit" disabled={submitting}>
                {submitting ? <><Spinner size={14} /> Saving...</> : "Save"}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div
        className={`modal-overlay${showCategoryModal ? " active" : ""}`}
        onClick={(event) => { if (event.target === event.currentTarget) setShowCategoryModal(false); }}
      >
        <div className="modal modal--categories">
          <button type="button" className="modal-close" aria-label="Close" onClick={() => setShowCategoryModal(false)}>&times;</button>
          <h2>Manage Categories</h2>
          <div className="category-list-scroll">
            {categories.map(({ id, category, budget }) => (
              <div className="category-item category-item-editable" key={id}>
                <div className="category-editable-fields">
                  <strong style={{ flex: 1 }}>{categoryLabel(category)}</strong>
                  <span>{formatCurrency(budget)}</span>
                </div>
                <div className="category-row-actions">
                  <button type="button" className="delete-btn" onClick={() => handleDeleteCategory(id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
          <form className="category-add-form" onSubmit={handleAddCategory}>
            <div className="form-group">
              <label>Add or update category</label>
              <div className="categoryAdditionInput">
                <input
                  type="text"
                  name="categoryName"
                  maxLength="50"
                  placeholder="Category name"
                  value={categoryForm.categoryName}
                  onChange={(event) => setCategoryForm((c) => ({ ...c, categoryName: event.target.value }))}
                />
                <input
                  type="number"
                  name="categoryBudget"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={categoryForm.categoryBudget}
                  onChange={(event) => setCategoryForm((c) => ({ ...c, categoryBudget: event.target.value }))}
                />
              </div>
            </div>
            <p className={`auth-message ${categoryMessageType}`} aria-live="polite">{categoryMessage}</p>
            <div className="modal-actions">
              <button type="button" className="btn-cancel" onClick={() => setShowCategoryModal(false)}>Close</button>
              <button type="submit" className="btn-submit">Save category</button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
