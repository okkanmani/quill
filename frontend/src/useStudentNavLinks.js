import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { getRevisionWorksheets, getTests, getWorksheets } from "./api";
import { buildStudentNavLinks } from "./adminNav";
import { filterLatestUndoneWorksheets } from "./worksheetUtils";

/** Shared worksheet + revision fetch and student nav links. */
export function useStudentNavLinks() {
  const location = useLocation();
  const [worksheets, setWorksheets] = useState([]);
  const [revisions, setRevisions] = useState([]);
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      getWorksheets(),
      getRevisionWorksheets(),
      getTests(),
    ])
      .then(([wsResult, revisionResult, testResult]) => {
        const errors = [];
        if (wsResult.status === "fulfilled") {
          setWorksheets(wsResult.value);
        } else {
          errors.push("worksheets");
          setWorksheets([]);
        }
        if (revisionResult.status === "fulfilled") {
          setRevisions(Array.isArray(revisionResult.value) ? revisionResult.value : []);
        } else {
          setRevisions([]);
        }
        if (testResult.status === "fulfilled") {
          setTests(Array.isArray(testResult.value) ? testResult.value : []);
        } else {
          setTests([]);
        }
        setError(errors.length > 0 ? "Could not load worksheets." : "");
      })
      .finally(() => setLoading(false));
  }, [location.key]);

  const latest = useMemo(
    () => filterLatestUndoneWorksheets(worksheets),
    [worksheets],
  );

  const navLinks = useMemo(
    () => buildStudentNavLinks(latest.length > 0, revisions.length > 0, tests.length > 0),
    [latest.length, revisions.length, tests.length],
  );

  return { worksheets, revisions, tests, latest, navLinks, loading, error };
}
