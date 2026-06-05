import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { getWorksheets } from "./api";
import { buildStudentNavLinks } from "./adminNav";
import { filterLatestUndoneWorksheets } from "./worksheetUtils";

/** Shared worksheet fetch + student nav links (Latest disabled when nothing new this week). */
export function useStudentNavLinks() {
  const location = useLocation();
  const [worksheets, setWorksheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    getWorksheets()
      .then((data) => {
        setError("");
        setWorksheets(data);
      })
      .catch(() => setError("Could not load worksheets."))
      .finally(() => setLoading(false));
  }, [location.key]);

  const latest = useMemo(
    () => filterLatestUndoneWorksheets(worksheets),
    [worksheets],
  );

  const navLinks = useMemo(
    () => buildStudentNavLinks(latest.length > 0),
    [latest.length],
  );

  return { worksheets, latest, navLinks, loading, error };
}
