import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUser, listExpenses, listSubscriptions } from "../api/spendwise";
import { expenseRowToTransaction, subscriptionRowToCard } from "../utils/dataAdapter";
import { getEffectiveExpenseAmount } from "../utils/dashboard";
import { readSession, writeSession } from "../utils/storage";

export default function ExportCenterPage() {
  const navigate = useNavigate();
  const session = readSession();
  const userId = session?.user?.id;
  // Always fetch the fresh user from the server so an admin permission flip
  // takes effect on the next visit (rather than after sign-out + sign-in).
  const [me, setMe] = useState(null);
  const canExport = me
    ? me.role === "admin" || me.canExport !== false
    : null; // null = still loading

  const [expenses, setExpenses] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!userId) {
      navigate("/signin");
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const fresh = await getUser(userId).then((p) => p.user);
        if (cancelled) return;
        setMe(fresh);
        writeSession(fresh);
        const allowed = fresh.role === "admin" || fresh.canExport !== false;
        if (!allowed) {
          setLoading(false);
          return;
        }
        const [rawExpenses, rawSubs] = await Promise.all([
          listExpenses(userId),
          listSubscriptions(userId)
        ]);
        if (cancelled) return;
        setExpenses(rawExpenses.map(expenseRowToTransaction).filter(Boolean));
        setSubscriptions(rawSubs.map(subscriptionRowToCard));
      } catch (error) {
        if (!cancelled) setMessage(error.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId, navigate]);

  if (!userId) return null;

  function downloadTextFile(filename, mimeType, content) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportJson() {
    downloadTextFile(
      "spendwise-export.json",
      "application/json",
      JSON.stringify({ expenses, subscriptions }, null, 2)
    );
    setMessage("JSON exported.");
  }

  function exportCsv() {
    const rows = [
      ["date", "description", "category", "amount", "type"],
      ...expenses.map((item) => [
        item.date || "",
        (item.description || "").replaceAll("\"", "\"\""),
        item.category || "",
        String(getEffectiveExpenseAmount(item)),
        item.type || ""
      ])
    ];
    const csv = rows.map((cells) => cells.map((cell) => `"${cell}"`).join(",")).join("\n");
    downloadTextFile("spendwise-transactions.csv", "text/csv;charset=utf-8", csv);
    setMessage("CSV exported.");
  }

  // Don't render anything until we know whether the user has permission
  // (avoids flashing the export buttons for a fraction of a second).
  if (canExport === null) {
    return (
      <main className="feature-main">
        <div className="feature-shell">
          <section className="feature-section">
            <p>Loading export center...</p>
          </section>
        </div>
      </main>
    );
  }

  if (!canExport) {
    return (
      <main className="feature-main">
        <div className="feature-shell">
          <section className="feature-section">
            <h1>Export Center</h1>
            <p className="sw-notice sw-notice--warning">
              An admin has disabled data export on your account. Please contact your administrator to re-enable downloads.
            </p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="feature-main">
      <div className="feature-shell">
        <section className="feature-section">
          <h1>Export Center</h1>
          <p>Download your SpendWise data for reporting or backup.</p>
          <div className="section">
            <h2>Export Options</h2>
            <div className="modal-actions">
              <button type="button" className="btn-submit" onClick={exportJson} disabled={loading}>Export JSON</button>
              <button type="button" className="btn-submit" onClick={exportCsv} disabled={loading}>Export CSV</button>
            </div>
            <p className="auth-message success" aria-live="polite">{message}</p>
          </div>
        </section>
      </div>
    </main>
  );
}
