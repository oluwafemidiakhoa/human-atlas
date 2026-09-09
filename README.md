# Human Atlas — Living Map

Human Atlas is an independently designed interactive anatomy-learning experience focused on spatial understanding: explore, reveal, x-ray, relate, and trace structures through the human body.

## Product principles

- Original interface and interaction language — not a reproduction of any third-party anatomy viewer.
- Anatomical provenance and licensing are explicit.
- Every modeled structure is addressable by name, but labels are rendered adaptively to avoid visual overload.
- Selected anatomy should remain spatially understandable; Reveal and X-Ray preserve context instead of simply hiding everything else.
- Educational content must distinguish source data from Human Atlas-authored interpretation.

## Signature interactions

**Explore** — free spatial navigation.

**Reveal** — uncover a selected structure while preserving anatomical context.

**X-Ray** — make surrounding anatomy translucent while keeping the selected structure solid.

**Relate** — show nearby, parent/child, and connected structures when supported by curated data.

**Trace** — follow anatomical or physiological pathways.

## First build

The first implementation sprint is the Living Map shell, adaptive labels, Depth control, Reveal v1, X-Ray v1, and a source/provenance panel.

## Anatomy data

The intended geometry source is BodyParts3D. Any imported geometry, identifiers, or ontology mappings must retain the applicable attribution and license notices. Human Atlas must not claim medical completeness beyond what the underlying source actually represents.

## Status

Early development.
