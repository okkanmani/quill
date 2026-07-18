import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { getRevisionWorksheets, getWorksheets } from "./api";
import { buildStudentNavLinks } from "./adminNav";
import { filterLatestUndoneWorksheets } from "./worksheetUtils";

/** Shared worksheet + revision fetch and student nav links. */
export function useStudentNavLinks() {
  const location = useLocation();
  const [worksheets, setWorksheets] = useState([]);
  const [revisions, setRevisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getWorksheets().catch(() => {
        throw new Error("worksheets");
      }),
      getRevisionWorksheets().catch(() => []),
    ])
      .then(([wsData, revisionData]) => {
        setError("");
        setWorksheets(wsData);
        setRevisions(Array.isArray(revisionData) ? revisionData : []);
      })
      .catch((err) => {
        if (err?.message === "worksheets") {
          setError("Could not load worksheets.");
        } else {
          setError("Could not load worksheets.");
        }
        setWorksheets([]);
        setRevisions([]);
      })
      .finally(() => setLoading(false));
  }, [location.key]);

  const latest = useMemo(
    () => filterLatestUndoneWorksheets(worksheets),
    [worksheets],
  );

  const navLinks = useMemo(
    () => buildStudentNavLinks(latest.length > 0, revisions.length > 0),
    [latest.length, revisions.length],
  );

  return { worksheets, revisions, latest, navLinks, loading, error };
}
