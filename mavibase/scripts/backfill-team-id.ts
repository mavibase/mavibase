/**
 * Backfill Script: Add team_id to all tables
 * 
 * This script fetches team_id from Platform-Auth API and updates all tables.
 * Run this AFTER migration 017 has been applied.
 * 
 * Usage:
 *   ts-node scripts/backfill-team-id.ts
 * 
 * Environment variables required:
 *   - PLATFORM_AUTH_API_URL (e.g., http://localhost:3000)
 *   - PLATFORM_AUTH_INTERNAL_SECRET (for internal API calls)
 *   - DATABASE_URL (PostgreSQL connection string)
 */

import { Pool } from "pg"
import axios from "axios"
import dotenv from "dotenv"

dotenv.config()
const PLATFORM_AUTH_API_URL = process.env.AUTH_PLATFORM_URL
const PLATFORM_AUTH_SECRET = process.env.INTERNAL_API_KEY
const DATABASE_URL = process.env.DATABASE_URL

if (!PLATFORM_AUTH_SECRET) {
  console.error("ERROR: PLATFORM_AUTH_INTERNAL_SECRET environment variable is required")
  process.exit(1)
}

if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable is required")
  process.exit(1)
}

const pool = new Pool({ connectionString: DATABASE_URL })

interface ProjectTeamMapping {
  project_id: string
  team_id: string
}

/**
 * Fetch team_id for a project from Platform-Auth
 */
async function getTeamIdForProject(projectId: string): Promise<string | null> {
  try {
    const response = await axios.get(
      `${PLATFORM_AUTH_API_URL}/api/platform/internal/projects/${projectId}`,
      {
        headers: {
          Authorization: `Bearer ${PLATFORM_AUTH_SECRET}`,
        },
      }
    )

    return response.data.team_id || null
  } catch (error: any) {
    console.error(`Failed to fetch team_id for project ${projectId}:`, error.message)
    return null
  }
}

/**
 * Get all unique project_ids from databases table
 */
async function getAllProjectIds(): Promise<string[]> {
  const result = await pool.query(`
    SELECT DISTINCT project_id 
    FROM databases 
    WHERE project_id IS NOT NULL 
    AND deleted_at IS NULL
  `)

  return result.rows.map((row) => row.project_id)
}

/**
 * Build project_id -> team_id mapping
 */
async function buildProjectTeamMapping(): Promise<ProjectTeamMapping[]> {
  console.log("Fetching all project IDs...")
  const projectIds = await getAllProjectIds()
  console.log(`Found ${projectIds.length} unique projects`)

  const mappings: ProjectTeamMapping[] = []

  for (let i = 0; i < projectIds.length; i++) {
    const projectId = projectIds[i]
    console.log(`[${i + 1}/${projectIds.length}] Fetching team_id for project: ${projectId}`)

    const teamId = await getTeamIdForProject(projectId)

    if (teamId) {
      mappings.push({ project_id: projectId, team_id: teamId })
      console.log(`  ✓ team_id: ${teamId}`)
    } else {
      console.log(`  ✗ Could not fetch team_id (project may be deleted)`)
    }

    // Rate limiting: wait 100ms between requests
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  return mappings
}

/**
 * Update databases table
 */
async function updateDatabases(mappings: ProjectTeamMapping[]): Promise<number> {
  console.log("\nUpdating databases table...")
  let updated = 0

  for (const { project_id, team_id } of mappings) {
    const result = await pool.query(
      `UPDATE databases SET team_id = $1 WHERE project_id = $2 AND team_id IS NULL`,
      [team_id, project_id]
    )
    updated += result.rowCount || 0
  }

  console.log(`  ✓ Updated ${updated} database records`)
  return updated
}

/**
 * Update collections table
 */
async function updateCollections(mappings: ProjectTeamMapping[]): Promise<number> {
  console.log("\nUpdating collections table...")
  let updated = 0

  for (const { project_id, team_id } of mappings) {
    const result = await pool.query(
      `UPDATE collections SET team_id = $1 WHERE project_id = $2 AND team_id IS NULL`,
      [team_id, project_id]
    )
    updated += result.rowCount || 0
  }

  console.log(`  ✓ Updated ${updated} collection records`)
  return updated
}

/**
 * Update documents table (via collections)
 */
async function updateDocuments(): Promise<number> {
  console.log("\nUpdating documents table...")

  const result = await pool.query(`
    UPDATE documents d
    SET team_id = c.team_id
    FROM collections c
    WHERE d.collection_id = c.id
    AND d.team_id IS NULL
    AND c.team_id IS NOT NULL
  `)

  const updated = result.rowCount || 0
  console.log(`  ✓ Updated ${updated} document records`)
  return updated
}



/**
 * Make team_id columns NOT NULL after backfill
 */
async function enforceNotNull(): Promise<void> {
  console.log("\nEnforcing NOT NULL constraints...")

  await pool.query(`ALTER TABLE databases ALTER COLUMN team_id SET NOT NULL`)
  console.log("  ✓ databases.team_id set to NOT NULL")

  await pool.query(`ALTER TABLE collections ALTER COLUMN team_id SET NOT NULL`)
  console.log("  ✓ collections.team_id set to NOT NULL")

  await pool.query(`ALTER TABLE documents ALTER COLUMN team_id SET NOT NULL`)
  console.log("  ✓ documents.team_id set to NOT NULL")

  console.log("\n✅ All constraints enforced!")
}

/**
 * Verify backfill
 */
async function verify(): Promise<void> {
  console.log("\nVerifying backfill...")

  const checks = [
    { table: "databases", query: "SELECT COUNT(*) FROM databases WHERE team_id IS NULL" },
    { table: "collections", query: "SELECT COUNT(*) FROM collections WHERE team_id IS NULL" },
    { table: "documents", query: "SELECT COUNT(*) FROM documents WHERE team_id IS NULL" },
  ]

  let allGood = true

  for (const check of checks) {
    const result = await pool.query(check.query)
    const nullCount = parseInt(result.rows[0].count)

    if (nullCount > 0) {
      console.log(`  ✗ ${check.table}: ${nullCount} records still have NULL team_id`)
      allGood = false
    } else {
      console.log(`  ✓ ${check.table}: All records have team_id`)
    }
  }

  if (allGood) {
    console.log("\n✅ Verification passed! All records have team_id.")
  } else {
    console.log("\n⚠️  Some records still have NULL team_id. Review manually.")
  }
}

/**
 * Main execution
 */
async function main() {
  console.log("=".repeat(60))
  console.log("Team ID Backfill Script")
  console.log("=".repeat(60))

  try {
    // Step 1: Build mapping
    const mappings = await buildProjectTeamMapping()
    console.log(`\n✓ Built mapping for ${mappings.length} projects`)

    if (mappings.length === 0) {
      console.log("\n⚠️  No projects found or all failed to fetch team_id")
      console.log("Please check Platform-Auth API connectivity and try again.")
      process.exit(1)
    }

    // Step 2: Update tables
    const dbUpdated = await updateDatabases(mappings)
    const collUpdated = await updateCollections(mappings)
    const docUpdated = await updateDocuments()

    console.log("\n" + "=".repeat(60))
    console.log("Summary:")
    console.log(`  - Databases updated: ${dbUpdated}`)
    console.log(`  - Collections updated: ${collUpdated}`)
    console.log(`  - Documents updated: ${docUpdated}`)
    console.log("=".repeat(60))

    // Step 3: Verify
    await verify()

    // Step 4: Ask for confirmation before enforcing NOT NULL
    console.log("\n" + "=".repeat(60))
    console.log("⚠️  IMPORTANT: About to make team_id columns NOT NULL")
    console.log("This will prevent any records without team_id from being created.")
    console.log("\nPress Ctrl+C to cancel, or wait 5 seconds to continue...")
    console.log("=".repeat(60))

    await new Promise((resolve) => setTimeout(resolve, 5000))

    // Step 5: Enforce NOT NULL
    await enforceNotNull()

    console.log("\n" + "=".repeat(60))
    console.log("✅ Backfill completed successfully!")
    console.log("=".repeat(60))
  } catch (error: any) {
    console.error("\n❌ Error during backfill:", error.message)
    console.error(error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

// Run the script
main()
