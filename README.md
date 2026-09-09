# Human Atlas — Living Map

Human Atlas is an independently designed interactive anatomy-learning experience focused on spatial understanding: **Explore, Reveal, X-Ray, Relate, and Trace** structures through the human body.

## Anatomy source

The production anatomy pipeline imports the official **BodyParts3D 4.0** adult male reference geometry from the Database Center for Life Science (DBCLS). The official download page publishes the 99% polygon-reduction IS-A mesh archive and the accompanying IS-A name, inclusion, and element tables used by this repository.

Required attribution:

> BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International

Official source pages:
- https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html
- https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html

The import workflow requires exactly **2,234 source OBJ meshes** before it will generate the browser package. Generated files preserve source element IDs, FMA concept mappings where available, source-release metadata, archive checksum, per-chunk checksums, and the required attribution.

## Product principles

- Original interface and interaction language — not a reproduction of any third-party anatomy viewer.
- Anatomical provenance and licensing are explicit.
- Every imported source mesh is addressable by name; Living Labels are rendered adaptively to avoid visual overload.
- Reveal and X-Ray preserve spatial context instead of simply hiding everything around the selected structure.
- Educational claims must distinguish source data from Human Atlas-authored interpretation.

## Signature interactions

**Explore** — free spatial navigation.

**Reveal** — uncover a selected structure while preserving anatomical context.

**X-Ray** — make surrounding anatomy translucent while keeping the selected structure solid.

**Relate** — use BodyParts3D/FMA hierarchy links where supported; do not fabricate unsupported biological relationships.

**Trace** — reserved for separately curated anatomical or physiological pathways.

## Reproducible import

The workflow `.github/workflows/import-bodyparts3d.yml` downloads the official files, runs `scripts/build-bodyparts3d.py`, validates the generated package with `scripts/verify-bodyparts3d.py`, and commits only a package that passes the 2,234-part and provenance gates.

Human Atlas-added system and region classifications are explicitly marked as heuristics; they are not claimed to be official BodyParts3D fields.

## Originality

See `docs/ORIGINALITY.md`. Broad ideas such as 3D anatomy, labels, search, transparency, and orbit controls are commonplace. Human Atlas must keep its own visual expression, terminology, layout, animations, and interaction design.
