/**
 * Backfill Size Tracking Script
 * 
 * This script calculates and sets the initial size values for all existing
 * databases, collections, documents, schemas, indexes, relationships, and versions.
 * 
 * Run this after applying the size tracking migration to populate initial data.
 * 
 * Usage: npx tsx scripts/backfill-sizes.ts
 */

import dotenv from "dotenv"
dotenv.config()

import { pool } from "@mavibase/database"


async function backfillSizes() {
  const client = await pool.connect()

  try {
    console.log("Starting size backfill process...")

    await client.query("BEGIN")

    // 1. Update document sizes
    console.log("Calculating document sizes...")
    const docResult = await client.query(`
      UPDATE documents
      SET size_bytes = LENGTH(data::text) + LENGTH(id::text) + 100
      WHERE size_bytes = 0 OR size_bytes IS NULL
    `)
    console.log(`Updated ${docResult.rowCount} documents`)

    // 2. Update collection sizes
    console.log("Calculating collection sizes...")
    const colResult = await client.query(`
      UPDATE collections
      SET size_bytes = LENGTH(name) + LENGTH(key) + COALESCE(LENGTH(description), 0) + 200
      WHERE size_bytes = 0 OR size_bytes IS NULL
    `)
    console.log(`Updated ${colResult.rowCount} collections`)

    // 3. Update schema sizes
    console.log("Calculating schema sizes...")
    const schemaResult = await client.query(`
      UPDATE collection_schemas
      SET size_bytes = LENGTH(definition::text) + 100
      WHERE size_bytes = 0 OR size_bytes IS NULL
    `)
    console.log(`Updated ${schemaResult.rowCount} schemas`)

    // 4. Update index sizes
    console.log("Calculating index metadata sizes...")
    const indexResult = await client.query(`
      UPDATE index_metadata
      SET size_bytes = LENGTH(field_name) + LENGTH(index_name) + 150
      WHERE size_bytes = 0 OR size_bytes IS NULL
    `)
    console.log(`Updated ${indexResult.rowCount} indexes`)

    // 5. Update relationship sizes
    console.log("Calculating relationship sizes...")
    const relResult = await client.query(`
      UPDATE relationships
      SET size_bytes = LENGTH(source_attribute) + COALESCE(LENGTH(target_attribute), 0) + LENGTH(type) + 150
      WHERE size_bytes = 0 OR size_bytes IS NULL
    `)
    console.log(`Updated ${relResult.rowCount} relationships`)

    // 6. Update document version sizes
    console.log("Calculating document version sizes...")
    const versionResult = await client.query(`
      UPDATE document_versions
      SET size_bytes = LENGTH(data::text) + 50
      WHERE size_bytes = 0 OR size_bytes IS NULL
    `)
    console.log(`Updated ${versionResult.rowCount} document versions`)

    // 7. Get all databases and calculate aggregated sizes
    console.log("Aggregating sizes per database...")
    const databases = await client.query(`
      SELECT id FROM databases WHERE deleted_at IS NULL
    `)

    let databasesUpdated = 0

    for (const db of databases.rows) {
      const databaseId = db.id

      // Calculate sizes for this database
      const sizeResult = await client.query(
        `
        SELECT 
          COALESCE(SUM(d.size_bytes), 0) as documents,
          COALESCE((SELECT SUM(size_bytes) FROM collections WHERE database_id = $1 AND deleted_at IS NULL), 0) as collections,
          COALESCE((SELECT SUM(im.size_bytes) FROM index_metadata im JOIN collections c ON im.collection_id = c.id WHERE c.database_id = $1), 0) as indexes,
          COALESCE((SELECT SUM(cs.size_bytes) FROM collection_schemas cs JOIN collections c ON cs.collection_id = c.id WHERE c.database_id = $1), 0) as schemas,
          COALESCE((SELECT SUM(r.size_bytes) FROM relationships r JOIN collections c ON r.source_collection_id = c.id WHERE c.database_id = $1), 0) as relationships,
          COALESCE((SELECT SUM(dv.size_bytes) FROM document_versions dv JOIN collections c ON dv.collection_id = c.id WHERE c.database_id = $1), 0) as versions
         FROM documents d
         JOIN collections c ON d.collection_id = c.id
         WHERE c.database_id = $1 AND d.deleted_at IS NULL
        `,
        [databaseId],
      )

      const sizes = sizeResult.rows[0]
      const documentsSize = Number(sizes.documents)
      const collectionsSize = Number(sizes.collections)
      const indexesSize = Number(sizes.indexes)
      const schemasSize = Number(sizes.schemas)
      const relationshipsSize = Number(sizes.relationships)
      const versionsSize = Number(sizes.versions)
      const totalSize = documentsSize + collectionsSize + indexesSize + schemasSize + relationshipsSize + versionsSize

      await client.query(
        `
        UPDATE databases 
        SET 
          size_documents_bytes = $2,
          size_collections_bytes = $3,
          size_indexes_bytes = $4,
          size_schemas_bytes = $5,
          size_relationships_bytes = $6,
          size_versions_bytes = $7,
          size_total_bytes = $8,
          size_last_calculated_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        `,
        [databaseId, documentsSize, collectionsSize, indexesSize, schemasSize, relationshipsSize, versionsSize, totalSize],
      )

      databasesUpdated++

      // Format bytes for display
      const formatBytes = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
      }

      console.log(`Database ${databaseId}:`)
      console.log(`  Documents: ${formatBytes(documentsSize)}`)
      console.log(`  Collections: ${formatBytes(collectionsSize)}`)
      console.log(`  Indexes: ${formatBytes(indexesSize)}`)
      console.log(`  Schemas: ${formatBytes(schemasSize)}`)
      console.log(`  Relationships: ${formatBytes(relationshipsSize)}`)
      console.log(`  Versions: ${formatBytes(versionsSize)}`)
      console.log(`  Total: ${formatBytes(totalSize)}`)
      console.log("")
    }

    console.log(`Updated ${databasesUpdated} databases with aggregated sizes`)

    await client.query("COMMIT")

    console.log("✅ Size backfill completed successfully!")
    console.log("")
    console.log("Summary:")
    console.log(`  - Documents: ${docResult.rowCount}`)
    console.log(`  - Collections: ${colResult.rowCount}`)
    console.log(`  - Schemas: ${schemaResult.rowCount}`)
    console.log(`  - Indexes: ${indexResult.rowCount}`)
    console.log(`  - Relationships: ${relResult.rowCount}`)
    console.log(`  - Document Versions: ${versionResult.rowCount}`)
    console.log(`  - Databases: ${databasesUpdated}`)
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("❌ Error during size backfill:", error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

// Run the backfill
backfillSizes()
  .then(() => {
    console.log("Backfill process finished")
    process.exit(0)
  })
  .catch((error) => {
    console.error("Backfill process failed:", error)
    process.exit(1)
  })
