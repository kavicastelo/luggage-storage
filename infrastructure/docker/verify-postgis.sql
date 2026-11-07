-- PostGIS Capability & Spatial Verification Script
-- Run against local PostgreSQL container:
-- docker compose -f infrastructure/docker/docker-compose.yml exec postgres psql -U postgres -d luggage_storage_dev -f /docker-entrypoint-initdb.d/verify-postgis.sql
-- or via psql:
-- psql -h localhost -p 5432 -U postgres -d luggage_storage_dev -f infrastructure/docker/verify-postgis.sql

SELECT 'Testing PostgreSQL version...' AS step;
SELECT version();

SELECT 'Testing PostGIS extension version...' AS step;
SELECT PostGIS_Full_Version();

SELECT 'Testing WGS84 Spatial Geography creation (Colombo, Sri Lanka)...' AS step;
SELECT ST_AsText(ST_SetSRID(ST_MakePoint(79.861244, 6.927079), 4326)::geography) AS colombo_geography_point;

SELECT 'Testing Spatial Distance Query (Distance from Colombo Fort to Galle Face in meters)...' AS step;
SELECT ST_Distance(
  ST_SetSRID(ST_MakePoint(79.8436, 6.9344), 4326)::geography, -- Colombo Fort
  ST_SetSRID(ST_MakePoint(79.8450, 6.9214), 4326)::geography  -- Galle Face
) AS distance_meters;

SELECT 'PostGIS Spatial Engine Verified Successfully' AS result;
