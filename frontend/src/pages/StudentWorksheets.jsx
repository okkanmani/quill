import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getWorksheetCollections, logout } from "../api";
import AppShell from "../components/AppShell";
import QuillLoading from "../components/QuillLoading";
import WorksheetCollectionTree from "../components/WorksheetCollectionTree";
import WorksheetsByMode from "../components/WorksheetsByMode";
import { unassignedWorksheets } from "../worksheetCollectionTree";
import { useStudentNavLinks } from "../useStudentNavLinks";

export default function StudentWorksheets() {
  const navigate = useNavigate();
  const { worksheets, navLinks, loading, error } = useStudentNavLinks();
  const [collections, setCollections] = useState({ sections: [] });
  const [collectionsLoading, setCollectionsLoading] = useState(true);

  useEffect(() => {
    setCollectionsLoading(true);
    getWorksheetCollections()
      .then(setCollections)
      .catch(() => setCollections({ sections: [] }))
      .finally(() => setCollectionsLoading(false));
  }, []);

  const unassigned = useMemo(() => unassignedWorksheets(worksheets), [worksheets]);
  const useCollectionLayout = collections.sections?.length > 0;
  const pageLoading = loading || collectionsLoading;

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  return (
    <AppShell navLinks={navLinks} onLogout={handleLogout}>
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-slate-950 mb-1">Your worksheets</h1>
        <p className="text-slate-600 text-sm mb-6 leading-relaxed">
          Pick a worksheet to start. Finished ones move to Your Results.
        </p>

        {pageLoading && <QuillLoading label="Loading worksheets…" />}
        {error && <p className="text-red-500">{error}</p>}

        {!pageLoading && !error && worksheets.length === 0 && (
          <p className="text-slate-600">No worksheets yet. Check back soon!</p>
        )}

        {!pageLoading && !error && worksheets.length > 0 && useCollectionLayout ? (
          <>
            <WorksheetCollectionTree
              sections={collections.sections}
              worksheets={worksheets.filter((ws) => !ws.is_test)}
              onOpenWorksheet={(id) => navigate(`/student/worksheet/${id}`)}
            />
            {unassigned.length > 0 ? (
              <div className="mt-4">
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-3">
                  Other worksheets
                </h2>
                <WorksheetsByMode
                  worksheets={unassigned.filter((ws) => !ws.is_test)}
                  onOpenWorksheet={(id) => navigate(`/student/worksheet/${id}`)}
                />
              </div>
            ) : null}
          </>
        ) : null}

        {!pageLoading && !error && worksheets.length > 0 && !useCollectionLayout ? (
          <WorksheetsByMode
            worksheets={worksheets.filter((ws) => !ws.is_test)}
            onOpenWorksheet={(id) => navigate(`/student/worksheet/${id}`)}
          />
        ) : null}
      </div>
    </AppShell>
  );
}
