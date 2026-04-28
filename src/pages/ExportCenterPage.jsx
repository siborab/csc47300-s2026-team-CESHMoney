import React, { useEffect, useState } from "react";
import { getEffectiveExpenseAmount } from "../utils/dashboard";
import { loadDashboardDbFromStorageOrSeed } from "../utils/storage";

export default function ExportCenterPage() {
  const [db, setDb] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadDb() {
      const normalizedDb = await loadDashboardDbFromStorageOrSeed();
      setDb(normalizedDb);
    }
    loadDb();
  }, []);

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
    if (!db) {
      return;
    }
    downloadTextFile("spendwise-transactions.json", "application/json", JSON.stringify(db, null, 2));
    setMessage("JSON exported.");
  }

  function exportCsv() {
    if (!db) {
      return;
    }
    const rows = [
      ["date", "description", "category", "amount", "type"],
      ...db.transactions.map((item) => [
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

  return (
    <main className="feature-main">
      <div className="feature-shell">
        <section className="feature-section">
          <h1>Export Center</h1>
          <p>Download your local SpendWise data for reporting or backup.</p>
          <div className="section">
            <h2>Export Options</h2>
            <div className="modal-actions">
              <button type="button" className="btn-submit" onClick={exportJson} disabled={!db}>Export JSON</button>
              <button type="button" className="btn-submit" onClick={exportCsv} disabled={!db}>Export CSV</button>
            </div>
            <p className="auth-message success" aria-live="polite">{message}</p>
          </div>
        </section>
      </div>
    </main>
  );
}
