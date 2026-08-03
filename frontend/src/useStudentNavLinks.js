import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { getRevisionWorksheets, getTests, getWorksheets, getComposites } from "./api";
import { buildStudentNavLinks } from "./adminNav";
import { filterLatestUndoneWorksheets } from "./worksheetUtils";

/** Shared worksheet + revision fetch and student nav links. */
export function useStudentNavLinks() {
  const location = useLocation();
  const [worksheets, setWorksheets] = useState([]);
  const [revisions, setRevisions] = useState([]);
  const [tests, setTests] = useState([]);
  const [composites, setComposites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [testsError, setTestsError] = useState("");
  const [compositesError, setCompositesError] = useState("");

  useEffect(() => {
    setLoading(true);
    setTestsError("");
    setCompositesError("");
    Promise.allSettled([
      getWorksheets(),
      getRevisionWorksheets(),
      getTests(),
      getComposites(),
    ])
      .then(([wsResult, revisionResult, testResult, compositeResult]) => {
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
          setTestsError("Could not load tests.");
        }
        if (compositeResult.status === "fulfilled") {
          setComposites(Array.isArray(compositeResult.value) ? compositeResult.value : []);
        } else {
          setComposites([]);
          setCompositesError("Could not load composite tests.");
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
    () =>
      buildStudentNavLinks(
        latest.length > 0,
        revisions.length > 0,
        tests.length > 0 || composites.length > 0,
      ),
    [latest.length, revisions.length, tests.length, composites.length],
  );

  return {
    worksheets,
    revisions,
    tests,
    composites,
    latest,
    navLinks,
    loading,
    error,
    testsError,
    compositesError,
  };
}
