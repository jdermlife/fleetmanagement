// api/drivers.ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required')
}

const sql = neon(process.env.DATABASE_URL)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS if frontend & API are deployed separately
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    if (req.method === 'GET') {
      const drivers = await sql`
        SELECT 
          id, 
          first_name AS "firstName", 
          last_name AS "lastName", 
          license_number AS "licenseNumber", 
          phone, 
          email, 
          status, 
          created_at AS "createdAt"
        FROM drivers 
        ORDER BY created_at DESC
      `
      return res.status(200).json(drivers)
    }

    if (req.method === 'POST') {
      const { firstName, lastName, licenseNumber, phone, email, status } = req.body

      if (!firstName || !lastName || !licenseNumber || !phone || !email) {
        return res.status(400).json({ error: 'Missing required fields' })
      }

      const result = await sql`
        INSERT INTO drivers (first_name, last_name, license_number, phone, email, status)
        VALUES (${firstName}, ${lastName}, ${licenseNumber}, ${phone}, ${email}, ${status || 'Active'})
        RETURNING id, first_name AS "firstName", last_name AS "lastName", license_number AS "licenseNumber", phone, email, status, created_at AS "createdAt"
      `

      return res.status(201).json(result[0])
    }

    res.setHeader('Allow', ['GET', 'POST'])
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` })
  } catch (error) {
    console.error('API Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}