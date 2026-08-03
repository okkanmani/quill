export function testSittingStorageKey(worksheetId, compositeAttemptId = null) {
  return `quill-test-sitting:${worksheetId}:${compositeAttemptId || ""}`;
}

export function markTestSittingActive(worksheetId, compositeAttemptId = null) {
  sessionStorage.setItem(testSittingStorageKey(worksheetId, compositeAttemptId), "1");
}

export function clearTestSittingActive(worksheetId, compositeAttemptId = null) {
  sessionStorage.removeItem(testSittingStorageKey(worksheetId, compositeAttemptId));
}

export function isTestSittingActive(worksheetId, compositeAttemptId = null) {
  return sessionStorage.getItem(testSittingStorageKey(worksheetId, compositeAttemptId)) === "1";
}
