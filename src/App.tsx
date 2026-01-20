import { useEffect, useMemo, useState } from "react";

type MappingRow = Record<string, unknown>;

type ResultRow = {
  expectedTitle: string;
  actualTitle: string;
  expectedNorm: string;
  actualNorm: string;
  isExact: boolean;
};

const normalizeTitle = (value: string) => {
  const lowered = value.toLowerCase().trim();
  const replaced = lowered.replace(/[^\p{L}\p{N}]+/gu, " ");
  return replaced.replace(/\s+/g, " ").trim();
};

const extractString = (row: MappingRow, key: string) => {
  const value = row[key];
  if (value === undefined || value === null) {
    return "";
  }
  return String(value);
};

const detectKeys = (rows: MappingRow[]) => {
  if (!rows.length) {
    return [];
  }
  return Object.keys(rows[0]);
};

const App = () => {
  const [rows, setRows] = useState<MappingRow[]>([]);
  const [expectedKey, setExpectedKey] = useState("title");
  const [actualKey, setActualKey] = useState("matched_csv_title");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const defaultFileUrl = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("file") ?? "/mappings.json";
  }, []);

  const keys = useMemo(() => detectKeys(rows), [rows]);

  const results = useMemo<ResultRow[]>(() => {
    if (!rows.length) {
      return [];
    }
    return rows.map((row) => {
      const expectedTitle = extractString(row, expectedKey);
      const actualTitle = extractString(row, actualKey);
      const expectedNorm = normalizeTitle(expectedTitle);
      const actualNorm = normalizeTitle(actualTitle);
      return {
        expectedTitle,
        actualTitle,
        expectedNorm,
        actualNorm,
        isExact: expectedNorm === actualNorm,
      };
    });
  }, [rows, expectedKey, actualKey]);

  const summary = useMemo(() => {
    const matched = results.filter((row) => row.isExact).length;
    return {
      total: results.length,
      matched,
      mismatched: results.length - matched,
    };
  }, [results]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) {
          throw new Error("Ожидается JSON-массив");
        }
        setRows(parsed as MappingRow[]);
      } catch (err) {
        setRows([]);
        setError(err instanceof Error ? err.message : "Ошибка чтения файла");
      }
    };
    reader.readAsText(file);
  };

  const loadFromUrl = async (url: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Не удалось загрузить файл: ${response.status}`);
      }
      const parsed = await response.json();
      if (!Array.isArray(parsed)) {
        throw new Error("Ожидается JSON-массив");
      }
      setRows(parsed as MappingRow[]);
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : "Ошибка чтения файла");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFromUrl(defaultFileUrl);
  }, [defaultFileUrl]);

  return (
    <div className="page">
      <header className="header">
        <h1>Проверка маппинга</h1>
        <p>
          Загрузите JSON-файл и выберите поля для сравнения. Совпадение считается
          строгим после нормализации.
        </p>
      </header>

      <section className="card">
        <div className="field">
          <label htmlFor="file">JSON-файл</label>
          <input id="file" type="file" accept="application/json" onChange={handleFileChange} />
        </div>

        {loading ? <p className="info">Загружаем файл по умолчанию…</p> : null}
        {error ? <p className="error">{error}</p> : null}

        {rows.length ? (
          <div className="controls">
            <div className="field">
              <label htmlFor="expectedKey">Поле ожидаемого названия</label>
              <select
                id="expectedKey"
                value={expectedKey}
                onChange={(event) => setExpectedKey(event.target.value)}
              >
                {keys.map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="actualKey">Поле замапленного названия</label>
              <select
                id="actualKey"
                value={actualKey}
                onChange={(event) => setActualKey(event.target.value)}
              >
                {keys.map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : null}
      </section>

      {rows.length ? (
        <>
          <section className="summary">
            <div>
              <h2>Итог</h2>
              <p>Всего: {summary.total}</p>
              <p>Совпали: {summary.matched}</p>
              <p>Не совпали: {summary.mismatched}</p>
            </div>
          </section>

          <section className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Ожидаемое</th>
                  <th>Замапленное</th>
                  <th>Совпадение</th>
                </tr>
              </thead>
              <tbody>
                {results.map((row, index) => (
                  <tr key={`${row.expectedTitle}-${index}`} className={row.isExact ? "match" : "mismatch"}>
                    <td>
                      <div className="title">{row.expectedTitle}</div>
                      <div className="normalized">{row.expectedNorm}</div>
                    </td>
                    <td>
                      <div className="title">{row.actualTitle}</div>
                      <div className="normalized">{row.actualNorm}</div>
                    </td>
                    <td>{row.isExact ? "✅" : "❌"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      ) : null}
    </div>
  );
};

export default App;
