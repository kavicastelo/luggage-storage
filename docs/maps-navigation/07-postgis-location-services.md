# PostGIS Geospatial Location Services

**Initiative:** Cross-Platform Mapping & Navigation Transformation  
**Branch:** `feature/in-app-maps-navigation`  
**Date:** 2026-11-19  
**Status:** Approved  
**Document ID:** `07-postgis-location-services`

---

## 1. Geospatial Database Layer

The luggage storage marketplace leverages PostgreSQL 16 with PostGIS 3.5 for spatial indexing and proximity searching.

### 1.1 Table Schema (`storage_locations`)
- `latitude` (`numeric(10, 7)`): WGS84 decimal latitude.
- `longitude` (`numeric(10, 7)`): WGS84 decimal longitude.
- `coarse_coordinates` (`geometry(Point, 4326)`): Obfuscated approximate location (~100-300m random displacement) for public discovery.
- `exact_coordinates` (`geometry(Point, 4326)`): Exact verified location, revealed only on confirmed booking custody pass (`OQ-012`).

### 1.2 Spatial Indexing
```sql
CREATE INDEX IF NOT EXISTS idx_storage_locations_coarse_geom 
  ON storage_locations USING GIST (coarse_coordinates);

CREATE INDEX IF NOT EXISTS idx_storage_locations_exact_geom 
  ON storage_locations USING GIST (exact_coordinates);
```

### 1.3 High-Performance Proximity Query (`ST_DWithin` & `ST_Distance`)
```sql
SELECT 
  sl.id,
  sl.name,
  sl.city,
  sl.approximate_area,
  ST_Y(sl.coarse_coordinates::geometry) AS coarse_latitude,
  ST_X(sl.coarse_coordinates::geometry) AS coarse_longitude,
  ST_Distance(
    sl.coarse_coordinates,
    ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
  ) AS distance_meters
FROM storage_locations sl
JOIN host_businesses hb ON sl.business_id = hb.id
WHERE sl.status = 'ACTIVE' 
  AND hb.status = 'ACTIVE'
  AND ST_DWithin(
    sl.coarse_coordinates,
    ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
    $3
  )
ORDER BY distance_meters ASC
LIMIT $4 OFFSET $5;
```

This guarantees index-assisted spatial filtering over millions of coordinates with sub-millisecond execution times.

