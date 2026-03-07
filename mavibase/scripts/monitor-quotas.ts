/**
 * Quota Monitor Script
 * 
 * This script provides an overview of quota usage across all databases.
 * Useful for monitoring storage usage and identifying databases approaching limits.
 */

import dotenv from "dotenv"
dotenv.config()

import { pool } from "@mavibase/database"

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function getUsageBar(percentage: number, width = 30): string {
  const filled = Math.round((percentage / 100) * width)
  const empty = width - filled
  let color = ""

  if (percentage >= 90) color = "\x1b[31m" // Red
  else if (percentage >= 75) color = "\x1b[33m" // Yellow
  else color = "\x1b[32m" // Green

  const reset = "\x1b[0m"
  return `${color}[${"█".repeat(filled)}${" ".repeat(empty)}]${reset} ${percentage.toFixed(1)}%`
}

async function monitorQuotas() {
  const client = await pool.connect()

  try {
    console.log("\n" + "=".repeat(80))
    console.log("DATABASE QUOTA MONITOR")
    console.log("=".repeat(80) + "\n")

    // Get all databases with their quota information
    const result = await client.query(`
      SELECT 
        id,
        name,
        project_id,
        max_collections,
        max_documents_per_collection,
        max_storage_bytes,
        current_collections,
        current_documents,
        current_storage_bytes,
        size_documents_bytes,
        size_collections_bytes,
        size_indexes_bytes,
        size_schemas_bytes,
        size_relationships_bytes,
        size_versions_bytes,
        size_total_bytes,
        size_last_calculated_at,
        created_at
      FROM databases 
      WHERE deleted_at IS NULL
      ORDER BY size_total_bytes DESC
    `)

    if (result.rows.length === 0) {
      console.log("No databases found.\n")
      return
    }

    let totalStorageUsed = 0
    let totalDatabases = result.rows.length
    let databasesOverThreshold = 0

    for (const db of result.rows) {
      const storagePercentage = db.max_storage_bytes > 0 
        ? (Number(db.size_total_bytes) / Number(db.max_storage_bytes)) * 100 
        : 0

      const collectionsPercentage = db.max_collections > 0 
        ? (db.current_collections / db.max_collections) * 100 
        : 0

      const documentsPercentage = (db.max_documents_per_collection * 100) > 0 
        ? (db.current_documents / (db.max_documents_per_collection * 100)) * 100 
        : 0

      totalStorageUsed += Number(db.size_total_bytes)

      if (storagePercentage >= 75) {
        databasesOverThreshold++
      }

      // Alert indicator
      let alert = "  "
      if (storagePercentage >= 90) alert = "🔴"
      else if (storagePercentage >= 75) alert = "🟡"
      else if (storagePercentage >= 50) alert = "🟢"

      console.log(`${alert} ${db.name} (${db.id})`)
      console.log(`   Project: ${db.project_id}`)
      console.log(`   Created: ${new Date(db.created_at).toLocaleDateString()}`)
      console.log("")

      // Storage breakdown
      console.log(`   STORAGE: ${formatBytes(Number(db.size_total_bytes))} / ${formatBytes(Number(db.max_storage_bytes))}`)
      console.log(`   ${getUsageBar(storagePercentage)}`)
      console.log("")

      console.log(`   Size Breakdown:`)
      console.log(`     Documents:     ${formatBytes(Number(db.size_documents_bytes))} (${((Number(db.size_documents_bytes) / Number(db.size_total_bytes || 1)) * 100).toFixed(1)}%)`)
      console.log(`     Versions:      ${formatBytes(Number(db.size_versions_bytes))} (${((Number(db.size_versions_bytes) / Number(db.size_total_bytes || 1)) * 100).toFixed(1)}%)`)
      console.log(`     Collections:   ${formatBytes(Number(db.size_collections_bytes))} (${((Number(db.size_collections_bytes) / Number(db.size_total_bytes || 1)) * 100).toFixed(1)}%)`)
      console.log(`     Schemas:       ${formatBytes(Number(db.size_schemas_bytes))} (${((Number(db.size_schemas_bytes) / Number(db.size_total_bytes || 1)) * 100).toFixed(1)}%)`)
      console.log(`     Indexes:       ${formatBytes(Number(db.size_indexes_bytes))} (${((Number(db.size_indexes_bytes) / Number(db.size_total_bytes || 1)) * 100).toFixed(1)}%)`)
      console.log(`     Relationships: ${formatBytes(Number(db.size_relationships_bytes))} (${((Number(db.size_relationships_bytes) / Number(db.size_total_bytes || 1)) * 100).toFixed(1)}%)`)
      console.log("")

      // Collections
      console.log(`   COLLECTIONS: ${db.current_collections} / ${db.max_collections}`)
      console.log(`   ${getUsageBar(collectionsPercentage)}`)
      console.log("")

      // Documents
      console.log(`   DOCUMENTS: ${db.current_documents} / ${db.max_documents_per_collection * 100}`)
      console.log(`   ${getUsageBar(documentsPercentage)}`)
      console.log("")

      if (db.size_last_calculated_at) {
        const lastCalc = new Date(db.size_last_calculated_at)
        const now = new Date()
        const hoursSinceCalc = (now.getTime() - lastCalc.getTime()) / (1000 * 60 * 60)
        console.log(`   Last size calculation: ${lastCalc.toLocaleString()} (${hoursSinceCalc.toFixed(1)} hours ago)`)
      } else {
        console.log(`   Last size calculation: Never`)
      }

      console.log("")
      console.log("-".repeat(80))
      console.log("")
    }

    // Summary
    console.log("=".repeat(80))
    console.log("SUMMARY")
    console.log("=".repeat(80) + "\n")

    console.log(`Total Databases: ${totalDatabases}`)
    console.log(`Total Storage Used: ${formatBytes(totalStorageUsed)}`)
    console.log(`Average per Database: ${formatBytes(Math.round(totalStorageUsed / totalDatabases))}`)
    console.log(``)
    console.log(`Databases at 75%+ storage: ${databasesOverThreshold}`)
    
    if (databasesOverThreshold > 0) {
      console.log(`\n⚠️  WARNING: ${databasesOverThreshold} database(s) approaching storage limits`)
    } else {
      console.log(`\n✅ All databases within acceptable storage limits`)
    }

    console.log("")

    // Top 5 largest databases by category
    console.log("TOP 5 LARGEST BY DOCUMENT DATA:")
    const topDocs = result.rows
      .sort((a, b) => Number(b.size_documents_bytes) - Number(a.size_documents_bytes))
      .slice(0, 5)
    
    for (const db of topDocs) {
      console.log(`  ${db.name}: ${formatBytes(Number(db.size_documents_bytes))}`)
    }

    console.log("\nTOP 5 LARGEST BY VERSION HISTORY:")
    const topVersions = result.rows
      .sort((a, b) => Number(b.size_versions_bytes) - Number(a.size_versions_bytes))
      .slice(0, 5)
    
    for (const db of topVersions) {
      console.log(`  ${db.name}: ${formatBytes(Number(db.size_versions_bytes))}`)
    }

    console.log("")
    console.log("=".repeat(80) + "\n")

  } catch (error) {
    console.error("❌ Error monitoring quotas:", error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

// Run the monitor
monitorQuotas()
  .then(() => {
    console.log("Monitoring complete")
    process.exit(0)
  })
  .catch((error) => {
    console.error("Monitoring failed:", error)
    process.exit(1)
  })
