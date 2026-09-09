# Anatomy data provenance

## Intended production source

Human Atlas intends to use **BodyParts3D** geometry and anatomy identifiers from the Database Center for Life Science (DBCLS), subject to the license published by the official source archive at the time of import.

The production import pipeline must preserve the source version, source identifiers, license text, attribution, and transformation metadata.

## Required provenance fields

For every imported production structure, retain at minimum:

- source dataset and version;
- source structure/model identifier;
- canonical source name;
- transformation/import pipeline version;
- mesh checksum or reproducible artifact hash;
- applicable license and attribution statement.

## Current branch

`living-map-v1` uses deliberately simple procedural geometry only to develop the Human Atlas interaction system. It must not be described as the final anatomical dataset or as 2,234 medically modeled structures.

## Content policy

Educational descriptions and relationship claims should be sourced or curated separately from mesh geometry. Unsupported relationships must not be inferred merely from visual proximity.
