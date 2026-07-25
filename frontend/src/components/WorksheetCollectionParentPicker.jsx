import ExpandableCollectionPicker from "./ExpandableCollectionPicker";

/**
 * Parent for a new sub-collection. Top-level collections (Practice, Timed) are
 * valid parents for Math / English; nested collections can parent further nesting.
 */
export default function WorksheetCollectionParentPicker({
  sections,
  value,
  onChange,
  excludeSectionId = null,
  blockedIds = null,
  disabled = false,
  open = true,
}) {
  return (
    <ExpandableCollectionPicker
      open={open}
      sections={sections}
      value={value}
      onChange={onChange}
      excludeSectionId={excludeSectionId}
      blockedIds={blockedIds}
      disabled={disabled}
      ariaLabel="Parent section"
    />
  );
}
