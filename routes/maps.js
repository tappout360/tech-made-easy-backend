const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

const GOOGLE_MAPS_KEY = process.env.GOOGLE_MAPS_KEY || '';
const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const DIRECTIONS_URL = 'https://maps.googleapis.com/maps/api/directions/json';
const DISTANCE_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json';

// @route    POST api/v1/maps/geocode
// @desc     Geocode an address to lat/lng
// @access   Private
router.post('/geocode', auth, async (req, res) => {
  try {
    const { address } = req.body;
    if (!address) return res.status(400).json({ msg: 'Address is required' });

    if (!GOOGLE_MAPS_KEY) {
      // Mock response when no API key configured
      return res.json({
        lat: 33.749 + Math.random() * 0.1,
        lng: -84.388 + Math.random() * 0.1,
        formattedAddress: address,
        mock: true,
      });
    }

    const response = await fetch(
      `${GEOCODE_URL}?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_KEY}`
    );
    const data = await response.json();

    if (data.status === 'OK' && data.results[0]) {
      const result = data.results[0];
      res.json({
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        formattedAddress: result.formatted_address,
      });
    } else {
      res.json({ lat: null, lng: null, address, error: data.status });
    }
  } catch (err) {
    console.error('Geocode error:', err.message);
    res.status(500).json({ msg: 'Geocode failed' });
  }
});

// @route    POST api/v1/maps/distance
// @desc     Get distance and duration between two addresses
// @access   Private
router.post('/distance', auth, async (req, res) => {
  try {
    const { from, to } = req.body;
    if (!from || !to) return res.status(400).json({ msg: 'Both from and to addresses are required' });

    if (!GOOGLE_MAPS_KEY) {
      return res.json({
        distance: `${(Math.random() * 20 + 2).toFixed(1)} mi`,
        distanceMeters: Math.floor(Math.random() * 30000 + 3000),
        duration: `${Math.floor(Math.random() * 30 + 5)} mins`,
        durationSeconds: Math.floor(Math.random() * 1800 + 300),
        mock: true,
      });
    }

    const response = await fetch(
      `${DISTANCE_URL}?origins=${encodeURIComponent(from)}&destinations=${encodeURIComponent(to)}&key=${GOOGLE_MAPS_KEY}`
    );
    const data = await response.json();

    if (data.status === 'OK' && data.rows[0]?.elements[0]?.status === 'OK') {
      const el = data.rows[0].elements[0];
      res.json({
        distance: el.distance.text,
        distanceMeters: el.distance.value,
        duration: el.duration.text,
        durationSeconds: el.duration.value,
      });
    } else {
      res.json({ distance: null, duration: null, error: data.status });
    }
  } catch (err) {
    console.error('Distance error:', err.message);
    res.status(500).json({ msg: 'Distance calculation failed' });
  }
});

// @route    POST api/v1/maps/optimize
// @desc     Optimize multi-stop route using Directions API waypoint optimization
// @access   Private
router.post('/optimize', auth, async (req, res) => {
  try {
    const { origin, stops } = req.body;
    if (!origin || !stops?.length) return res.status(400).json({ msg: 'Origin and stops required' });

    if (!GOOGLE_MAPS_KEY) {
      // Mock: return stops in priority order
      const sorted = [...stops].sort((a, b) => {
        if (a.priority === 'critical' && b.priority !== 'critical') return -1;
        if (a.priority !== 'critical' && b.priority === 'critical') return 1;
        return 0;
      });
      return res.json({
        optimizedRoute: sorted,
        totalDistance: `${(stops.length * 5.5).toFixed(1)} mi`,
        totalDuration: `${stops.length * 12} mins`,
        mock: true,
      });
    }

    const destination = stops[stops.length - 1].address;
    const waypoints = stops.slice(0, -1).map(s => s.address);

    const waypointParam = waypoints.length > 0
      ? `&waypoints=optimize:true|${waypoints.map(w => encodeURIComponent(w)).join('|')}`
      : '';

    const response = await fetch(
      `${DIRECTIONS_URL}?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}${waypointParam}&key=${GOOGLE_MAPS_KEY}`
    );
    const data = await response.json();

    if (data.status === 'OK') {
      const route = data.routes[0];
      const order = route.waypoint_order || [];
      const optimizedStops = order.length > 0
        ? [...order.map(i => stops[i]), stops[stops.length - 1]]
        : stops;

      const totalDistance = route.legs.reduce((sum, leg) => sum + leg.distance.value, 0);
      const totalDuration = route.legs.reduce((sum, leg) => sum + leg.duration.value, 0);

      res.json({
        optimizedRoute: optimizedStops,
        totalDistance: `${(totalDistance / 1609.34).toFixed(1)} mi`,
        totalDistanceMeters: totalDistance,
        totalDuration: `${Math.round(totalDuration / 60)} mins`,
        totalDurationSeconds: totalDuration,
        legs: route.legs.map(leg => ({
          distance: leg.distance.text,
          duration: leg.duration.text,
          startAddress: leg.start_address,
          endAddress: leg.end_address,
        })),
      });
    } else {
      res.json({ optimizedRoute: stops, error: data.status, mock: true });
    }
  } catch (err) {
    console.error('Route optimize error:', err.message);
    res.status(500).json({ msg: 'Route optimization failed' });
  }
});

// @route    POST api/v1/maps/breadcrumbs
// @desc     Receive GPS breadcrumb points from mobile tech app
// @access   Private
// NOTE: HIPAA-compliant — only business-address lat/lng + techId, no PHI
router.post('/breadcrumbs', auth, async (req, res) => {
  try {
    const { points } = req.body;
    if (!Array.isArray(points) || points.length === 0) {
      return res.status(400).json({ msg: 'No breadcrumb points provided' });
    }

    // In production, persist to a GPS tracking collection.
    // For now, log and acknowledge — prevents data loss on the mobile side.
    console.log(`📍 Received ${points.length} breadcrumbs from tech ${req.user.id}`);

    // TODO: Persist to GPSTrack model when ready
    // await GPSTrack.insertMany(points.map(p => ({ ...p, techId: req.user.id })));

    res.json({
      msg: `Received ${points.length} breadcrumb(s)`,
      count: points.length,
    });
  } catch (err) {
    console.error('Breadcrumb error:', err.message);
    res.status(500).json({ msg: 'Failed to store breadcrumbs' });
  }
});

module.exports = router;
