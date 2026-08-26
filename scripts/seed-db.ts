import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const PG_URI = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/tatkal_db';

const pool = new Pool({ connectionString: PG_URI });

async function seed() {
  console.log('🌱 Seeding Tatkal Fair-Booking Database with synthetic train inventory...');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Ensure Table Schema Exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS seat_inventory (
        id BIGSERIAL PRIMARY KEY,
        train_id TEXT NOT NULL,
        seat_class TEXT NOT NULL,
        travel_date DATE NOT NULL,
        total_seats INT NOT NULL,
        available_seats INT NOT NULL,
        version INT NOT NULL DEFAULT 0,
        UNIQUE (train_id, seat_class, travel_date)
      );
    `);

    // 2. Insert ~15 Synthetic Trains Tatkal Inventory
    const trains = [
      { trainId: '12002', seatClass: '3A', travelDate: '2026-08-26', totalSeats: 30, availableSeats: 30 },
      { trainId: '12002', seatClass: 'CC', travelDate: '2026-08-26', totalSeats: 50, availableSeats: 50 },
      { trainId: '12002', seatClass: '1A', travelDate: '2026-08-26', totalSeats: 10, availableSeats: 10 },
      { trainId: '12951', seatClass: '1A', travelDate: '2026-08-26', totalSeats: 12, availableSeats: 12 },
      { trainId: '12951', seatClass: '2A', travelDate: '2026-08-26', totalSeats: 25, availableSeats: 25 },
      { trainId: '12951', seatClass: '3A', travelDate: '2026-08-26', totalSeats: 40, availableSeats: 40 },
      { trainId: '20901', seatClass: 'EC', travelDate: '2026-08-26', totalSeats: 16, availableSeats: 16 },
      { trainId: '20901', seatClass: 'CC', travelDate: '2026-08-26', totalSeats: 60, availableSeats: 60 },
      { trainId: '12260', seatClass: '2A', travelDate: '2026-08-26', totalSeats: 20, availableSeats: 20 },
      { trainId: '12260', seatClass: '3A', travelDate: '2026-08-26', totalSeats: 45, availableSeats: 45 },
      { trainId: '12260', seatClass: 'SL', travelDate: '2026-08-26', totalSeats: 80, availableSeats: 80 },
      { trainId: '12626', seatClass: '2A', travelDate: '2026-08-26', totalSeats: 18, availableSeats: 18 },
      { trainId: '12626', seatClass: '3A', travelDate: '2026-08-26', totalSeats: 35, availableSeats: 35 },
      { trainId: '12626', seatClass: 'SL', travelDate: '2026-08-26', totalSeats: 90, availableSeats: 90 }
    ];

    for (const t of trains) {
      await client.query(
        `INSERT INTO seat_inventory (train_id, seat_class, travel_date, total_seats, available_seats)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (train_id, seat_class, travel_date)
         DO UPDATE SET available_seats = EXCLUDED.available_seats, total_seats = EXCLUDED.total_seats`,
        [t.trainId, t.seatClass, t.travelDate, t.totalSeats, t.availableSeats]
      );
    }

    await client.query('COMMIT');
    console.log('✅ Seed completed successfully! Synthetic train data loaded.');
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('❌ Seed error:', err.message);
  } finally {
    client.release();
    pool.end();
  }
}

seed();
